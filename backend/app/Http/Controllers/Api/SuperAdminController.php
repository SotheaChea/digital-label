<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Company;
use App\Models\Branch;
use App\Models\Product;
use App\Models\Label;
use Illuminate\Support\Facades\DB;

use Illuminate\Support\Facades\Cache;

class SuperAdminController extends Controller
{
    public function dashboard(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Cache total metrics for 10 seconds to drastically reduce database load on frequent refreshes
        $metrics = Cache::remember('superadmin_metrics', 10, function () {
            return [
                'totalCompanies' => Company::count(),
                'totalUsers' => User::count(),
                'totalLabels' => Label::count(),
                'totalProducts' => Product::count(),
                'systemHealth' => 99.9,
                'databaseLoad' => 8,
                'apiResponseTime' => 22
            ];
        });

        // Optimize queries by selecting ONLY columns required by the UI to reduce memory and payload size
        $companies = Company::select('id', 'name', 'code', 'logo_url', 'status', 'subscription', 'phone', 'address', 'owner_id', 'created_at')
            ->withCount([
                'branches',
                'labels',
                'products',
                'categories',
                'users as staff_count'
            ])
            ->with('users')
            ->latest()
            ->get()->map(function($company) {
                $company->email = $company->users->first()->email ?? '';
                unset($company->users); // avoid sending huge user lists
                return $company;
            });

        $users = User::select('id', 'name', 'email', 'role', 'company_id', 'branch_id', 'position', 'photo_url', 'created_at')
            ->with([
                'company:id,name,logo_url',
                'branch:id,name'
            ])
            ->latest()
            ->get();

        $labelStats = Cache::remember('superadmin_label_stats', 10, function () {
            return Label::select('status', DB::raw('count(*) as total'))
                ->groupBy('status')
                ->get();
        });

        return response()->json([
            'metrics' => $metrics,
            'companies' => $companies,
            'users' => $users,
            'labelStats' => $labelStats
        ]);
    }

    public function companies(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $companies = Company::select('id', 'name', 'code', 'logo_url', 'status', 'subscription', 'phone', 'address', 'owner_id', 'created_at')
            ->withCount(['branches', 'users'])
            ->with('users')
            ->latest()
            ->get()->map(function($company) {
                $company->email = $company->users->first()->email ?? '';
                unset($company->users);
                return $company;
            });

        return response()->json($companies);
    }

    public function users(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $users = User::select('id', 'name', 'email', 'role', 'company_id', 'branch_id', 'position', 'photo_url', 'created_at')
            ->with([
                'company:id,name,logo_url',
                'branch:id,name'
            ])
            ->latest()
            ->get();

        return response()->json($users);
    }

    public function deleteCompany($id, Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $company = Company::find($id);
        if (!$company) {
            return response()->json(['message' => 'Company not found'], 404);
        }

        $company->delete();

        return response()->json(['success' => true, 'message' => 'Company deleted successfully']);
    }

    public function updateCompanyStatus($id, Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'status' => 'required|string|in:active,suspended,pending'
        ]);

        $company = Company::find($id);
        if (!$company) {
            return response()->json(['message' => 'Company not found'], 404);
        }

        $company->status = $request->status;
        $company->save();

        if ($company->owner_id) {
            $owner = User::find($company->owner_id);
            if ($owner) {
                $owner->status = $request->status;
                $owner->save();
            }
        }

        return response()->json(['success' => true, 'message' => 'Company and Owner status updated successfully', 'company' => $company]);
    }

    public function deleteUser($id, Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $targetUser = User::find($id);
        if (!$targetUser) {
            return response()->json(['message' => 'User not found'], 404);
        }

        if ($targetUser->role === 'admin') {
            return response()->json(['message' => 'Cannot delete administrator accounts for security compliance'], 403);
        }

        $targetUser->delete();

        return response()->json(['success' => true, 'message' => 'User deleted successfully']);
    }

    public function updateUserStatus($id, Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'status' => 'required|string|in:active,suspended,pending'
        ]);

        $targetUser = User::find($id);
        if (!$targetUser) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $targetUser->status = $request->status;
        $targetUser->save();

        if ($targetUser->company_id && $targetUser->id === $targetUser->company->owner_id) {
            $company = $targetUser->company;
            $company->status = $request->status;
            $company->save();
        }

        return response()->json(['success' => true, 'message' => 'User status updated successfully', 'user' => $targetUser]);
    }

    public function updateUserRole($id, Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'role' => 'required|string|in:admin,vendor,staff'
        ]);

        $targetUser = User::find($id);
        if (!$targetUser) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $targetUser->role = $request->role;
        $targetUser->save();

        return response()->json(['success' => true, 'message' => 'User role updated successfully', 'user' => $targetUser]);
    }

    public function saveCompany(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'code' => 'required|string|max:50',
            'address' => 'required|string|max:255',
            'subscription' => 'required|string|in:basic,pro,enterprise',
            'status' => 'required|string|in:active,suspended,pending',
            'id' => 'nullable'
        ]);

        if ($request->has('id') && $request->id) {
            $company = Company::find($request->id);
            if (!$company) {
                return response()->json(['message' => 'Company not found'], 404);
            }
        } else {
            $company = new Company();
        }

        $company->name = $request->name;
        $company->code = $request->code;
        $company->address = $request->address;
        $company->subscription = $request->subscription;
        $company->status = $request->status;
        
        if (!$company->exists) {
            $company->owner_id = $user->id; // Assign to creator admin only for new companies
        }
        
        $company->phone = $request->phone ?? '';
        $company->save();

        if ($company->owner_id) {
            $owner = User::find($company->owner_id);
            if ($owner) {
                $owner->email = $request->email;
                $owner->status = $request->status; // Keep owner status perfectly synced
                $owner->save();
            }
        }

        return response()->json(['success' => true, 'company' => $company]);
    }

    public function saveUser(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'companyId' => 'required|string', // Company code
            'status' => 'required|string|in:active,suspended,pending,inactive',
            'password' => 'nullable|string|min:6',
            'id' => 'nullable'
        ]);

        // Find company by its code
        $company = Company::where('code', $request->companyId)->first();
        if (!$company) {
            return response()->json(['message' => 'Company with code ' . $request->companyId . ' not found'], 404);
        }

        if ($request->has('id') && $request->id) {
            $targetUser = User::find($request->id);
            if (!$targetUser) {
                return response()->json(['message' => 'User not found'], 404);
            }
        } else {
            $targetUser = new User();
            $targetUser->role = 'vendor';
        }

        $targetUser->name = $request->name;
        $targetUser->email = $request->email;
        $targetUser->status = $request->status === 'inactive' ? 'pending' : $request->status;
        $targetUser->company_id = $company->id;

        if ($request->password) {
            $targetUser->password = \Illuminate\Support\Facades\Hash::make($request->password);
        }

        $targetUser->save();

        return response()->json(['success' => true, 'user' => $targetUser]);
    }
}
