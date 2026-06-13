<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Company;
use App\Models\Branch;
use App\Models\Product;
use App\Models\BranchProduct;
use App\Models\Category;
use App\Models\Label;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Create Company
        $company = Company::create([
            'name' => 'Kitzu-Tech',
            'code' => 'KITZU001',
            'status' => 'active',
        ]);

        // 2. Create Branch
        $branch = Branch::create([
            'name' => 'Phnom Penh Main',
            'address' => 'PP, Cambodia',
            'phone' => '012345678',
            'company_id' => $company->id,
            'status' => 'active',
            'location' => 'Main Street',
        ]);

        User::create([
            'name' => 'Super Admin',
            'email' => 'kitzuadmin@gmail.com',
            'password' => Hash::make('kitzuadmin9080@@'),
            'role' => 'admin',
            'position' => 'System Administrator'
        ]);

        // 3. Create Vendor User and assign to branch
        User::create([
            'name' => 'Test Vendor',
            'email' => 'test@example.com',
            'password' => Hash::make('password'),
            'role' => 'vendor',
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'position' => 'Manager'
        ]);

        // 3.5 Create Staff Demo User
        User::create([
            'name' => 'Staff Demo',
            'email' => 'staff.demo@store.com',
            'password' => Hash::make('staffdemo123'),
            'role' => 'staff',
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'position' => 'Sales Associate'
        ]);

        // 4. Create Category
        $category = Category::create([
            'name' => 'Beverage',
            'company_id' => $company->id,
        ]);

        // 5. Create Products
        $p1 = Product::create([
            'name' => 'Vital Water 500ml',
            'sku' => 'VITAL001',
            'price' => 0.50,
            'category' => 'Beverage',
            'description' => 'Clean mineral water',
            'company_id' => $company->id,
        ]);

        $p2 = Product::create([
            'name' => 'Coca Cola 330ml',
            'sku' => 'COKE001',
            'price' => 1.00,
            'category' => 'Beverage',
            'description' => 'Refreshing soft drink',
            'company_id' => $company->id,
        ]);

        // 6. Assign Products to Branch
        BranchProduct::create([
            'branch_id' => $branch->id,
            'product_id' => $p1->id,
            'company_id' => $company->id,
            'current_price' => 0.50,
            'stock' => 100,
            'min_stock' => 10,
            'status' => 'in-stock',
        ]);

        BranchProduct::create([
            'branch_id' => $branch->id,
            'product_id' => $p2->id,
            'company_id' => $company->id,
            'current_price' => 1.00,
            'stock' => 50,
            'min_stock' => 5,
            'status' => 'in-stock',
        ]);

        // 7. Create Labels
        Label::create([
            'label_id' => 'TAG-001',
            'branch_id' => $branch->id,
            'product_id' => $p1->id,
            'company_id' => $company->id,
            'current_price' => 0.50,
            'battery' => 95,
            'status' => 'active',
            'location' => 'Aisle 1',
        ]);

        Label::create([
            'label_id' => 'TAG-002',
            'branch_id' => $branch->id,
            'product_id' => $p2->id,
            'company_id' => $company->id,
            'current_price' => 1.00,
            'battery' => 88,
            'status' => 'active',
            'location' => 'Aisle 2',
        ]);
    }
}
