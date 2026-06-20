/**
 * Laravel API Bridge
 * This library handles all communication with the Laravel PHP Backend.
 */

export const API_BASE_URL = typeof window !== 'undefined'
  ? '/api'
  : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1/api');

export const laravelApi = {
  /**
   * Fetch all products for a company
   */
  async getProducts(companyId: string) {
    try {
      // In a real app, we'd add ?companyId=... to the URL
      const response = await fetch(`${API_BASE_URL}/products`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return await response.json();
    } catch (error) {
      console.error('Laravel API Error (getProducts):', error);
      return [];
    }
  },

  /**
   * Create a new product
   */
  async createProduct(data: any) {
    try {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error) {
      console.error('Laravel API Error (createProduct):', error);
      throw error;
    }
  },

  /**
   * Get all data for the staff dashboard
   */
  async getStaffDashboard(token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/staff`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return await response.json();
    } catch (error) {
      console.error('Laravel API Error (getStaffDashboard):', error);
      throw error;
    }
  },

  /**
   * Get all data for the vendor dashboard
   */
  async getVendorDashboard(token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/vendor`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Laravel API Error Details:', response.status, errorData);
        throw new Error('Failed to fetch dashboard data');
      }
      return await response.json();
    } catch (error) {
      console.error('Laravel API Error (getVendorDashboard):', error);
      throw error;
    }
  },

  async getAdminDashboard(token: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/admin`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch admin dashboard');
      return await response.json();
    } catch (error) {
      console.error('Laravel API Error (getAdminDashboard):', error);
      throw error;
    }
  },

  async getAdminCompanies(token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/companies`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await response.json();
  },

  async getAdminUsers(token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return await response.json();
  },

  // Auth Methods
  async login(credentials: any) {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json' // 👈 This tells Laravel we are an API
        },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Laravel Login Error Details:', response.status, errorData);
        throw new Error(errorData.message || 'Login failed');
      }
      return await response.json();
    } catch (error) {
      console.error('Laravel Auth Error (login):', error);
      throw error;
    }
  },

  async register(data: any) {
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json' 
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Registration failed');
      }
      return await response.json();
    } catch (error) {
      console.error('Laravel Auth Error (register):', error);
      throw error;
    }
  },

  async deleteCompany(id: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/companies/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete company');
    return await response.json();
  },

  async updateCompanyStatus(id: string, status: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/companies/${id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Failed to update company status');
    return await response.json();
  },

  async deleteUser(id: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete user');
    return await response.json();
  },

  async updateUserStatus(id: string, status: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Failed to update user status');
    return await response.json();
  },

  async updateUserRole(id: string, role: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/users/${id}/role`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role })
    });
    if (!response.ok) throw new Error('Failed to update user role');
    return await response.json();
  },

  async saveCompany(data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/companies/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to save company');
    }
    return await response.json();
  },

  async saveUser(data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/admin/users/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Failed to save user');
    }
    return await response.json();
  },

  async googleLogin(payload: { email: string; name: string; photo_url: string | null; uid: string }) {
    const response = await fetch(`${API_BASE_URL}/google-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Google authentication failed');
    }
    return await response.json();
  },

  async saveProduct(data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/products/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to save product');
    return await response.json();
  },

  async deleteProduct(id: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/products/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete product');
    return await response.json();
  },

  async saveCategory(name: string, id: string | null, token: string) {
    const response = await fetch(`${API_BASE_URL}/categories/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, id })
    });
    if (!response.ok) throw new Error('Failed to save category');
    return await response.json();
  },

  async deleteCategory(id: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/categories/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete category');
    return await response.json();
  },

  async saveStaff(data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/staff/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save staff');
    }
    return await response.json();
  },

  async deleteStaff(id: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/staff/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete staff');
    return await response.json();
  },

  async linkProductToLabel(labelId: string, productId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/labels/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ labelId, productId })
    });
    if (!response.ok) throw new Error('Failed to link label');
    return await response.json();
  },

  async unlinkProductFromLabel(labelId: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/labels/unlink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ labelId })
    });
    if (!response.ok) throw new Error('Failed to unlink label');
    return await response.json();
  },

  async getLabelPreview(id: string) {
    const response = await fetch(`${API_BASE_URL}/labels/preview/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch label preview');
    }
    return await response.json();
  },


  async syncLabel(labelId: string, status: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/labels/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ labelId, status })
    });
    if (!response.ok) throw new Error('Failed to sync label');
    return await response.json();
  },

  async deleteLabel(id: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/labels/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete label');
    return await response.json();
  },

  async applyDiscount(payload: { labelId?: string; productId?: string; percent: number }, token: string) {
    const response = await fetch(`${API_BASE_URL}/labels/discount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Failed to apply discount');
    return await response.json();
  },

  async updateStock(payload: { productId: string; branchId: string; value: number; mode: string }, token: string) {
    const response = await fetch(`${API_BASE_URL}/branch-products/update-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Failed to update stock');
    return await response.json();
  },

  async reportIssue(payload: { labelId: string; productId?: string; issue: string; priority: string }, token: string) {
    const response = await fetch(`${API_BASE_URL}/issues/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Failed to report issue');
    return await response.json();
  },

  async updateIssueStatus(id: string, status: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/issues/${id}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Failed to update issue status');
    return await response.json();
  },

  async addIssueNote(id: string, note: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/issues/${id}/note`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ note })
    });
    if (!response.ok) throw new Error('Failed to add issue note');
    return await response.json();
  },

  async savePromotion(data: any, token: string) {
    const response = await fetch(`${API_BASE_URL}/promotions/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to save promotion');
    return await response.json();
  },

  async deletePromotion(id: string, token: string) {
    const response = await fetch(`${API_BASE_URL}/promotions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to delete promotion');
    return await response.json();
  }
};
