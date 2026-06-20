<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Branch;
use App\Models\BranchProduct;
use App\Models\Label;
use App\Models\Category;
use App\Models\Company;
use App\Models\Product;
use App\Models\User;
use App\Models\Promotion;
use App\Models\IssueReport;

class DashboardController extends Controller
{
    public function staff(Request $request)
    {
        $user = $request->user();
        
        if (!$user->branch_id) {
            return response()->json(['message' => 'User not assigned to a branch'], 400);
        }

        $branch = Branch::select('id', 'name', 'address', 'phone', 'manager_id', 'company_id', 'location', 'status')
            ->find($user->branch_id);
            
        $company = Company::select('id', 'name', 'code', 'logo_url', 'status')
            ->find($user->company_id);

        $branchProducts = BranchProduct::select('id', 'branch_id', 'product_id', 'company_id', 'current_price', 'stock', 'min_stock', 'status')
            ->with('product:id,name,sku,price,category,image_url')
            ->where('branch_id', $user->branch_id)
            ->get();

        $labels = Label::select('id', 'label_id', 'label_code', 'product_id', 'branch_id', 'company_id', 'current_price', 'base_price', 'final_price', 'discount_percent', 'battery', 'status', 'location', 'last_sync')
            ->with('product:id,name,sku,price,category')
            ->where('branch_id', $user->branch_id)
            ->get();

        $categories = Category::select('id', 'name', 'company_id')
            ->where('company_id', $user->company_id)
            ->get();

        $issues = IssueReport::where('branch_id', $user->branch_id)->latest()->get();

        return response()->json([
            'branch' => $branch,
            'company' => $company,
            'branchProducts' => $branchProducts,
            'labels' => $labels,
            'categories' => $categories,
            'issues' => $issues
        ]);
    }

    public function vendor(Request $request)
    {
        $user = $request->user();
        $companyId = $user->company_id;

        // Eagerly select columns to maintain high database speed and low memory impact
        $company = Company::select('id', 'name', 'code', 'logo_url', 'status', 'subscription')
            ->find($companyId);
            
        $branches = Branch::select('id', 'name', 'address', 'phone', 'manager_id', 'company_id', 'location', 'status')
            ->where('company_id', $companyId)
            ->get();
            
        $products = Product::select('id', 'name', 'sku', 'price', 'category', 'description', 'image_url', 'company_id')
            ->where('company_id', $companyId)
            ->get();
            
        $branchProducts = BranchProduct::select('id', 'branch_id', 'product_id', 'company_id', 'current_price', 'stock', 'min_stock', 'status')
            ->where('company_id', $companyId)
            ->get();
            
        $labels = Label::select('id', 'label_id', 'label_code', 'product_id', 'branch_id', 'company_id', 'current_price', 'base_price', 'final_price', 'discount_percent', 'battery', 'status', 'location', 'last_sync')
            ->with('product:id,name,sku,price,category')
            ->where('company_id', $companyId)
            ->get();
            
        $categories = Category::select('id', 'name', 'company_id')
            ->where('company_id', $companyId)
            ->get();

        $promotions = Promotion::where('company_id', $companyId)->latest()->get();
        $issues = IssueReport::where('company_id', $companyId)->latest()->get();

        $staffMembers = User::select('id', 'name', 'email', 'role', 'company_id', 'branch_id', 'position', 'photo_url', 'status')
            ->where('company_id', $companyId)
            ->where('role', '!=', 'admin')
            ->latest()
            ->get();

        return response()->json([
            'company' => $company,
            'branches' => $branches,
            'products' => $products,
            'branchProducts' => $branchProducts,
            'labels' => $labels,
            'categories' => $categories,
            'promotions' => $promotions,
            'issues' => $issues,
            'staffMembers' => $staffMembers
        ]);
    }

    public function updateCompany(Request $request)
    {
        $user = $request->user();
        
        if (!$user->company_id) {
            return response()->json(['message' => 'User does not belong to a company'], 400);
        }

        $company = Company::find($user->company_id);
        if (!$company) {
            return response()->json(['message' => 'Company not found'], 404);
        }

        $request->validate([
            'name' => 'nullable|string',
            'logo_url' => 'nullable|string',
        ]);

        if ($request->has('name')) {
            $company->name = $request->name;
        }

        if ($request->has('logo_url')) {
            $company->logo_url = $request->logo_url;
        }

        $company->save();

        return response()->json([
            'success' => true,
            'company' => $company
        ]);
    }

    public function saveCategory(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'name' => 'required|string|max:255',
            'id' => 'nullable'
        ]);

        if ($request->has('id') && $request->id) {
            $category = Category::where('company_id', $user->company_id)->find($request->id);
            if (!$category) {
                return response()->json(['message' => 'Category not found'], 404);
            }
        } else {
            $category = new Category();
            $category->company_id = $user->company_id;
        }

        $category->name = $request->name;
        $category->save();

        return response()->json(['success' => true, 'category' => $category]);
    }

    public function deleteCategory($id, Request $request)
    {
        $user = $request->user();
        $category = Category::where('company_id', $user->company_id)->find($id);
        
        if (!$category) {
            return response()->json(['message' => 'Category not found'], 404);
        }

        $category->delete();

        return response()->json(['success' => true, 'message' => 'Category deleted']);
    }

    public function saveStaff(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email',
            'password' => 'nullable|string|min:6',
            'branchId' => 'required',
            'position' => 'required|string',
            'id' => 'nullable'
        ]);

        if ($request->has('id') && $request->id) {
            $staff = User::where('company_id', $user->company_id)->find($request->id);
            if (!$staff) {
                return response()->json(['message' => 'Staff not found'], 404);
            }
        } else {
            $exists = User::where('email', $request->email)->exists();
            if ($exists) {
                return response()->json(['message' => 'Email already registered'], 400);
            }
            
            $staff = new User();
            $staff->company_id = $user->company_id;
            $staff->email = $request->email;
        }

        $staff->name = $request->name;
        $staff->branch_id = $request->branchId;
        $staff->position = $request->position;
        $staff->role = $request->position === 'Stock Controller' ? 'stock' : 
                       ($request->position === 'Inventory Manager' ? 'inventory_manager' : 'staff');
        
        if ($request->password) {
            $staff->password = \Illuminate\Support\Facades\Hash::make($request->password);
        }

        $staff->status = 'active';
        $staff->save();

        return response()->json(['success' => true, 'staff' => $staff]);
    }

    public function deleteStaff($id, Request $request)
    {
        $user = $request->user();
        $staff = User::where('company_id', $user->company_id)->find($id);
        
        if (!$staff) {
            return response()->json(['message' => 'Staff not found'], 404);
        }

        $staff->delete();

        return response()->json(['success' => true, 'message' => 'Staff deleted']);
    }

    public function linkProductToLabel(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'labelId' => 'required',
            'productId' => 'required'
        ]);

        $label = Label::where('company_id', $user->company_id)->find($request->labelId);
        if (!$label) {
            return response()->json(['message' => 'Label not found'], 404);
        }

        $product = Product::where('company_id', $user->company_id)->find($request->productId);
        if (!$product) {
            return response()->json(['message' => 'Product not found'], 404);
        }

        $label->product_id = $product->id;
        $label->current_price = $product->price;
        $label->base_price = $product->price;
        $label->final_price = $product->price;
        $label->status = 'active';
        $label->last_sync = now();
        $label->save();

        return response()->json(['success' => true, 'label' => $label]);
    }

    public function unlinkProductFromLabel(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'labelId' => 'required'
        ]);

        $label = Label::where('company_id', $user->company_id)->find($request->labelId);
        if (!$label) {
            return response()->json(['message' => 'Label not found'], 404);
        }

        $label->product_id = null;
        $label->current_price = null;
        $label->base_price = null;
        $label->final_price = null;
        $label->discount_percent = null;
        $label->discount_price = null;
        $label->status = 'inactive';
        $label->last_sync = now();
        $label->save();

        return response()->json(['success' => true, 'label' => $label]);
    }

    public function previewLabel($id)
    {
        $label = \App\Models\Label::with(['product', 'branch'])
            ->where('id', $id)
            ->orWhere('label_id', $id)
            ->orWhere('label_code', $id)
            ->first();

        if (!$label) {
            return response()->json(['message' => 'Label not found'], 404);
        }

        return response()->json([
            'id' => (string)$label->id,
            'labelId' => $label->label_id,
            'labelCode' => $label->label_code,
            'status' => $label->status,
            'battery' => $label->battery,
            'location' => $label->location,
            'basePrice' => $label->base_price,
            'currentPrice' => $label->current_price,
            'finalPrice' => $label->final_price,
            'discountPercent' => $label->discount_percent,
            'productId' => (string)$label->product_id,
            'branchId' => (string)$label->branch_id,
            'companyId' => (string)$label->company_id,
            'productSku' => $label->product ? $label->product->sku : null,
            'productName' => $label->product ? $label->product->name : null,
            'productCode' => $label->product ? $label->product->product_code : null,
            'stock' => $label->product ? $label->product->stock : 0,
            'branchName' => $label->branch ? $label->branch->name : null,
            'lastSync' => $label->last_sync
        ]);
    }

    public function syncLabel(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'labelId' => 'required',
            'status' => 'required|string'
        ]);

        $label = Label::where('company_id', $user->company_id)->find($request->labelId);
        if (!$label) {
            return response()->json(['message' => 'Label not found'], 404);
        }

        $label->status = $request->status;
        $label->last_sync = now();
        $label->save();

        return response()->json(['success' => true, 'label' => $label]);
    }

    public function deleteLabel($id, Request $request)
    {
        $user = $request->user();
        $label = Label::where('company_id', $user->company_id)->find($id);
        
        if (!$label) {
            return response()->json(['message' => 'Label not found'], 404);
        }

        $label->delete();

        return response()->json(['success' => true, 'message' => 'Label deleted']);
    }

    public function applyDiscount(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'labelId' => 'nullable',
            'productId' => 'nullable',
            'percent' => 'required|numeric'
        ]);

        $percent = $request->percent;

        if ($request->labelId) {
            $label = Label::where('company_id', $user->company_id)->find($request->labelId);
            if (!$label) {
                return response()->json(['message' => 'Label not found'], 404);
            }

            $basePrice = $label->base_price ?? $label->current_price ?? 0;
            $discountPrice = round($basePrice * (1 - $percent / 100), 2);

            $label->discount_percent = $percent;
            $label->discount_price = $discountPrice;
            $label->final_price = $discountPrice;
            $label->status = 'syncing';
            $label->last_sync = now();
            $label->save();
        } elseif ($request->productId) {
            $labels = Label::where('company_id', $user->company_id)
                ->where('product_id', $request->productId)
                ->get();

            foreach ($labels as $label) {
                $basePrice = $label->base_price ?? $label->current_price ?? 0;
                $discountPrice = round($basePrice * (1 - $percent / 100), 2);

                $label->discount_percent = $percent;
                $label->discount_price = $discountPrice;
                $label->final_price = $discountPrice;
                $label->status = 'syncing';
                $label->last_sync = now();
                $label->save();
            }
        }

        return response()->json(['success' => true]);
    }

    public function updateStock(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'productId' => 'required',
            'branchId' => 'required',
            'value' => 'required|numeric',
            'mode' => 'required|string|in:adjust,set'
        ]);

        $bp = BranchProduct::where('company_id', $user->company_id)
            ->where('product_id', $request->productId)
            ->where('branch_id', $request->branchId)
            ->first();

        if (!$bp) {
            return response()->json(['message' => 'Branch product not found'], 404);
        }

        $currentStock = $bp->stock;
        $minStock = $bp->min_stock;
        
        if ($request->mode === 'set') {
            $newStock = max(0, intval($request->value));
        } else {
            $newStock = max(0, $currentStock + intval($request->value));
        }

        if ($newStock == 0) {
            $status = 'out-of-stock';
        } elseif ($newStock <= $minStock) {
            $status = 'low-stock';
        } else {
            $status = 'in-stock';
        }

        $bp->stock = $newStock;
        $bp->status = $status;
        $bp->save();

        return response()->json(['success' => true, 'branchProduct' => $bp]);
    }

    public function reportIssue(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'labelId' => 'required|string',
            'productId' => 'nullable',
            'issue' => 'required|string',
            'priority' => 'required|string'
        ]);

        $label = Label::where('company_id', $user->company_id)
            ->where('label_id', $request->labelId)
            ->first();

        if (!$label) {
            return response()->json(['message' => 'Label not found'], 404);
        }

        $report = IssueReport::create([
            'label_id' => $request->labelId,
            'product_id' => $request->productId ?? $label->product_id,
            'issue' => $request->issue,
            'priority' => $request->priority,
            'status' => 'open',
            'branch_id' => $user->branch_id ?? $label->branch_id,
            'company_id' => $user->company_id,
            'reported_by' => $user->id,
            'reported_by_name' => $user->name,
            'notes' => []
        ]);

        $label->status = 'error';
        $label->save();

        return response()->json(['success' => true, 'issue' => $report]);
    }

    public function updateIssueStatus($id, Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'status' => 'required|string|in:open,in-progress,resolved'
        ]);

        $report = IssueReport::where('company_id', $user->company_id)->find($id);
        if (!$report) {
            return response()->json(['message' => 'Issue report not found'], 404);
        }

        $report->status = $request->status;
        $report->save();

        if ($request->status === 'resolved') {
            $label = Label::where('company_id', $user->company_id)
                ->where('label_id', $report->label_id)
                ->first();
            if ($label) {
                $label->status = 'active';
                $label->save();
            }
        }

        return response()->json(['success' => true, 'issue' => $report]);
    }

    public function addIssueNote($id, Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'note' => 'required|string'
        ]);

        $report = IssueReport::where('company_id', $user->company_id)->find($id);
        if (!$report) {
            return response()->json(['message' => 'Issue report not found'], 404);
        }

        $notes = $report->notes ?? [];
        $notes[] = [
            'note' => $request->note,
            'author' => $user->name,
            'createdAt' => now()->toIso8601String()
        ];

        $report->notes = $notes;
        $report->save();

        return response()->json(['success' => true, 'notes' => $notes]);
    }

    public function savePromotion(Request $request)
    {
        $user = $request->user();
        
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'type' => 'required|string',
            'value' => 'required|numeric',
            'applyTo' => 'required|string',
            'selectedProducts' => 'nullable|array',
            'selectedBranches' => 'nullable|array',
            'startDate' => 'required',
            'endDate' => 'required',
            'branchId' => 'nullable',
            'id' => 'nullable'
        ]);

        if ($request->has('id') && $request->id) {
            $promotion = Promotion::where('company_id', $user->company_id)->find($request->id);
            if (!$promotion) {
                return response()->json(['message' => 'Promotion not found'], 404);
            }
        } else {
            $promotion = new Promotion();
            $promotion->company_id = $user->company_id;
        }

        $promotion->name = $request->name;
        $promotion->description = $request->description;
        $promotion->type = $request->type;
        $promotion->value = $request->value;
        $promotion->apply_to = $request->applyTo;
        $promotion->selected_products = $request->selectedProducts;
        $promotion->selected_branches = $request->selectedBranches;
        $promotion->start_date = date('Y-m-d H:i:s', strtotime($request->startDate));
        $promotion->end_date = date('Y-m-d H:i:s', strtotime($request->endDate));
        $promotion->branch_id = $request->branchId ?? 'all';
        $promotion->status = 'active';
        $promotion->save();

        return response()->json(['success' => true, 'promotion' => $promotion]);
    }

    public function deletePromotion($id, Request $request)
    {
        $user = $request->user();
        $promotion = Promotion::where('company_id', $user->company_id)->find($id);
        
        if (!$promotion) {
            return response()->json(['message' => 'Promotion not found'], 404);
        }

        $promotion->delete();

        return response()->json(['success' => true, 'message' => 'Promotion deleted']);
    }
}
