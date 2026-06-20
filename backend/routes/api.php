<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\AuthController;

use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\UploadController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

Route::post('/upload/profile', [UploadController::class, 'uploadProfile']);
Route::post('/upload/product', [UploadController::class, 'uploadProduct']);

Route::get('/products', [ProductController::class, 'index']);
Route::get('/labels/preview/{id}', [DashboardController::class, 'previewLabel']);

Route::get('/dashboard/staff', [DashboardController::class, 'staff'])->middleware('auth:sanctum');
Route::get('/dashboard/vendor', [DashboardController::class, 'vendor'])->middleware('auth:sanctum');
Route::get('/dashboard/admin', [\App\Http\Controllers\Api\SuperAdminController::class, 'dashboard'])->middleware('auth:sanctum');
Route::get('/admin/companies', [\App\Http\Controllers\Api\SuperAdminController::class, 'companies'])->middleware('auth:sanctum');
Route::get('/admin/users', [\App\Http\Controllers\Api\SuperAdminController::class, 'users'])->middleware('auth:sanctum');

Route::delete('/admin/companies/{id}', [\App\Http\Controllers\Api\SuperAdminController::class, 'deleteCompany'])->middleware('auth:sanctum');
Route::post('/admin/companies/{id}/status', [\App\Http\Controllers\Api\SuperAdminController::class, 'updateCompanyStatus'])->middleware('auth:sanctum');
Route::delete('/admin/users/{id}', [\App\Http\Controllers\Api\SuperAdminController::class, 'deleteUser'])->middleware('auth:sanctum');
Route::post('/admin/users/{id}/status', [\App\Http\Controllers\Api\SuperAdminController::class, 'updateUserStatus'])->middleware('auth:sanctum');
Route::post('/admin/users/{id}/role', [\App\Http\Controllers\Api\SuperAdminController::class, 'updateUserRole'])->middleware('auth:sanctum');

Route::post('/admin/companies/save', [\App\Http\Controllers\Api\SuperAdminController::class, 'saveCompany'])->middleware('auth:sanctum');
Route::post('/admin/users/save', [\App\Http\Controllers\Api\SuperAdminController::class, 'saveUser'])->middleware('auth:sanctum');


Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/user/update', [AuthController::class, 'updateProfile'])->middleware('auth:sanctum');
Route::post('/company/update', [DashboardController::class, 'updateCompany'])->middleware('auth:sanctum');

// Google Authentication
Route::post('/google-login', [AuthController::class, 'googleLogin']);

Route::middleware('auth:sanctum')->group(function () {
    // Products
    Route::post('/products/save', [ProductController::class, 'save']);
    Route::delete('/products/{id}', [ProductController::class, 'delete']);

    // Categories
    Route::post('/categories/save', [DashboardController::class, 'saveCategory']);
    Route::delete('/categories/{id}', [DashboardController::class, 'deleteCategory']);

    // Staff
    Route::post('/staff/save', [DashboardController::class, 'saveStaff']);
    Route::delete('/staff/{id}', [DashboardController::class, 'deleteStaff']);

    // Labels
    Route::post('/labels/link', [DashboardController::class, 'linkProductToLabel']);
    Route::post('/labels/unlink', [DashboardController::class, 'unlinkProductFromLabel']);
    Route::post('/labels/sync', [DashboardController::class, 'syncLabel']);
    Route::delete('/labels/{id}', [DashboardController::class, 'deleteLabel']);
    Route::post('/labels/discount', [DashboardController::class, 'applyDiscount']);

    // Branch Products Stock
    Route::post('/branch-products/update-stock', [DashboardController::class, 'updateStock']);

    // Promotions
    Route::post('/promotions/save', [DashboardController::class, 'savePromotion']);
    Route::delete('/promotions/{id}', [DashboardController::class, 'deletePromotion']);

    // Maintenance Issues
    Route::post('/issues/report', [DashboardController::class, 'reportIssue']);
    Route::post('/issues/{id}/status', [DashboardController::class, 'updateIssueStatus']);
    Route::post('/issues/{id}/note', [DashboardController::class, 'addIssueNote']);
});
