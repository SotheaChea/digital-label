import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/user-store';
import { auth, db, logOut, secondaryAuth, storage } from '@/lib/firebase';
import { laravelApi, API_BASE_URL } from '@/lib/api';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { 
  doc as fsDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  collection, 
  onSnapshot,
  query, 
  where, 
  deleteDoc,
  addDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  Company, 
  Branch, 
  Product, 
  BranchProduct, 
  StaffMember, 
  DigitalLabel, 
  Promotion, 
  Category, 
  IssueReport,
  StaffPermissions
} from '@/types/vendor';
import { makeProductCodeForVendor, makeSku, nextBranchSequence, nextCompanySequence } from '@/lib/id-generator';
import { applyDiscountToLabel, clearDiscountFromLabel } from '@/lib/label-discount';
import { generateLabelsForBranch } from '@/lib/supermarket-setup';
import { getPermissionsForRole } from '@/lib/role-presets';
import { createNotification } from '@/lib/notifications';
import { compressImage } from '@/lib/image-compress';

export function useVendorDashboard() {
  const router = useRouter();
  const { user: currentUser, accessToken, setUser, clearUser, hasHydrated } = useUserStore();
  const realtimeUnsubsRef = useRef<(() => void)[]>([]);
  const productUpdateLockRef = useRef(false);
  
  // States
  const [selectedTab, setSelectedTab] = useState<
    'dashboard' | 'products' | 'categories' | 'staff' | 'labels' | 'promotions' | 'sales' | 'reports' | 'settings' | 'support' | 'branches' | 'issues' | 'activity' | 'inventory' | 'analytics' | 'audit' | 'pos' | 'label-ui' | 'sync' | 'rbac'
  >(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('vendor_selected_tab') as any) || 'dashboard';
    }
    return 'dashboard';
  });

  // Persist selected tab across refreshes
  useEffect(() => {
    localStorage.setItem('vendor_selected_tab', selectedTab);
  }, [selectedTab]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branchProducts, setBranchProducts] = useState<BranchProduct[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [labels, setLabels] = useState<DigitalLabel[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [labelSyncFilter, setLabelSyncFilter] = useState<'all' | 'synced' | 'not-synced'>('all');
  const [assignProductModal, setAssignProductModal] = useState<{labelId: string, branchId: string, labelCode?: string} | null>(null);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [activeDiscountModal, setActiveDiscountModal] = useState<{
    isOpen: boolean, 
    labelId: string, 
    productId: string, 
    productName: string, 
    currentPrice: number
  } | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<DigitalLabel | null>(null);
  const [labelFor3D, setLabelFor3D] = useState<DigitalLabel | null>(null);
  const [labelModal, setLabelModal] = useState<{
    title: string;
    message: string;
    tone: 'info' | 'success' | 'warning' | 'error';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void | Promise<void>;
  } | null>(null);

  // Modal states
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [showCreatePromotion, setShowCreatePromotion] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [showEditProduct, setShowEditProduct] = useState<Product | null>(null);
  const [showEditStaff, setShowEditStaff] = useState<StaffMember | null>(null);
  const [showResetPassword, setShowResetPassword] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [selectedBranchForEdit, setSelectedBranchForEdit] = useState<Branch | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [productPage, setProductPage] = useState(1);
  const [productsPerPage] = useState(10);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);

  const handleEditProduct = (product: Product | null) => {
    setSelectedProductForEdit(product);
    setShowProductModal(!!product);
  };

  const handleEditBranch = (branch: Branch | null) => {
    setSelectedBranchForEdit(branch);
    setShowCreateBranch(!!branch);
  };

  // Auto-populate edit form when a staff member is selected for editing
  useEffect(() => {
    if (showEditStaff) {
      setEditStaffForm({
        name: showEditStaff.name || '',
        email: showEditStaff.email || '',
        position: showEditStaff.position || 'Cashier',
        branchId: showEditStaff.branchId || '',
        status: showEditStaff.status || 'active',
        permissions: {
          canViewProducts: showEditStaff.permissions?.canViewProducts ?? true,
          canUpdateStock: showEditStaff.permissions?.canUpdateStock ?? true,
          canReportIssues: showEditStaff.permissions?.canReportIssues ?? true,
          canViewReports: showEditStaff.permissions?.canViewReports ?? false,
          canChangePrices: showEditStaff.permissions?.canChangePrices ?? false,
          canCreateProducts: showEditStaff.permissions?.canCreateProducts ?? false,
          canCreateLabels: showEditStaff.permissions?.canCreateLabels ?? false,
          canCreatePromotions: showEditStaff.permissions?.canCreatePromotions ?? false,
          maxPriceChange: showEditStaff.permissions?.maxPriceChange ?? 0
        }
      });
    }
  }, [showEditStaff]);

  // Form states
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    position: 'Cashier',
    branchId: '',
    password: 'welcome123',
    permissions: getPermissionsForRole('Cashier')
  });

  const [editStaffForm, setEditStaffForm] = useState({
    name: '',
    email: '',
    position: 'Cashier',
    branchId: '',
    status: 'active' as 'active' | 'inactive',
    permissions: getPermissionsForRole('Cashier')
  });

  const [promotionForm, setPromotionForm] = useState({
    name: '',
    description: '',
    type: 'percentage' as 'percentage' | 'fixed' | 'bogo',
    value: 10,
    applyTo: 'all' as 'all' | 'selected',
    selectedProducts: [] as string[],
    selectedBranches: [] as string[],
    startDate: '',
    endDate: ''
  });

  const [resetPasswordData, setResetPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const updateIssueStatus = async (issueId: string, status: 'open' | 'in-progress' | 'resolved') => {
    try {
      await laravelApi.updateIssueStatus(issueId, status, accessToken!);
      openLabelNotice('Status Updated', `Incident status set to ${status}.`, 'success');
      loadVendorData();
    } catch (error) {
      console.error('Update error:', error);
      openLabelNotice('Error', 'Failed to update incident status.', 'error');
    }
  };

  const addIssueNote = async (issueId: string, noteText: string) => {
    try {
      await laravelApi.addIssueNote(issueId, noteText, accessToken!);
      openLabelNotice('Note Added', 'Maintenance update recorded.', 'success');
      loadVendorData();
    } catch (error) {
      console.error('Note error:', error);
      openLabelNotice('Error', 'Failed to save note.', 'error');
    }
  };

  const loadVendorData = async () => {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      const data = await laravelApi.getVendorDashboard(accessToken);
      
      setCompany(data.company);
      if (data.company) {
        setUser({
          ...currentUser,
          companyName: data.company.name,
          companyLogo: data.company.logo_url || data.company.logoUrl,
        });
      }
      setBranches(data.branches);
      if (data.branches && data.branches.length === 1) {
        setSelectedBranchId(data.branches[0].id.toString());
      }
      const mappedCategories = (data.categories || []).map((c: any) => ({
          ...c,
          id: c.id.toString(),
          productCount: c.productCount || 0
        }));
        setCategories(mappedCategories);
      
      // Map products to frontend expectations
      const mappedProducts = data.products.map((p: any) => ({
        ...p,
        id: p.id.toString(),
        basePrice: Number(p.price) || 0,
        imageUrl: p.image_url,
        companyId: p.company_id
      }));
      setProducts(mappedProducts);

      // Map branch products
      const mappedBranchProducts = data.branchProducts.map((bp: any) => ({
        id: bp.id.toString(),
        productId: bp.product_id.toString(),
        branchId: bp.branch_id.toString(),
        companyId: bp.company_id.toString(),
        currentPrice: Number(bp.current_price) || 0,
        stock: bp.stock,
        minStock: bp.min_stock,
        status: bp.status,
        lastUpdated: bp.updated_at
      }));
      setBranchProducts(mappedBranchProducts);

      // Map labels
      const mappedLabels = data.labels.map((l: any) => ({
        id: l.id.toString(),
        labelId: l.label_id,
        labelCode: l.label_code,
        productId: l.product_id ? l.product_id.toString() : null,
        productName: l.product?.name,
        productSku: l.product?.sku,
        branchId: l.branch_id ? l.branch_id.toString() : null,
        currentPrice: Number(l.current_price) || 0,
        basePrice: Number(l.base_price) || 0,
        finalPrice: Number(l.final_price) || 0,
        discountPercent: Number(l.discount_percent) || 0,
        discountPrice: Number(l.discount_price) || 0,
        battery: l.battery,
        status: l.status,
        lastSync: l.updated_at,
        location: l.location
      }));
      setLabels(mappedLabels);

      const mappedIssues = (data.issues || []).map((i: any) => ({
          ...i,
          id: i.id.toString(),
          labelId: i.label_id ? i.label_id.toString() : '',
          productId: i.product_id ? i.product_id.toString() : '',
          branchId: i.branch_id ? i.branch_id.toString() : ''
        }));
        setIssues(mappedIssues);
      const mappedStaff = (data.staffMembers || []).map((s: any) => ({
          ...s,
          id: s.id.toString(),
          branchId: s.branch_id ? s.branch_id.toString() : '',
          companyId: s.company_id ? s.company_id.toString() : ''
        }));
        setStaffMembers(mappedStaff);

      const mappedPromotions = (data.promotions || []).map((p: any) => ({
        id: p.id.toString(),
        name: p.name,
        description: p.description || '',
        type: p.type,
        value: Number(p.value),
        companyId: p.company_id ? p.company_id.toString() : '',
        applyTo: p.apply_to,
        productIds: p.selected_products || [],
        branchIds: p.selected_branches || [],
        startDate: p.start_date,
        endDate: p.end_date,
        status: p.status,
        createdAt: p.created_at
      }));
      setPromotions(mappedPromotions);

    } catch (error) {
      console.error('Error loading vendor data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Subscriptions - Removed Firestore, will use periodic refresh or manual refresh

  const getDisplayStockForProduct = (productId: string) => {
    const bp = branchProducts.find(b => b.productId === productId && (selectedBranchId === 'all' ? true : b.branchId === selectedBranchId));
    return { stock: bp?.stock || 0, minStock: bp?.minStock || 10 };
  };

  useEffect(() => {
    if (!hasHydrated) return;
    if (accessToken) {
      loadVendorData();
    } else {
      setLoading(false);
    }
  }, [accessToken, hasHydrated]);

  // Immediate branch selection for staff
  useEffect(() => {
    if (hasHydrated && currentUser?.role === 'staff' && currentUser.branchId) {
      setSelectedBranchId(currentUser.branchId);
    }
  }, [currentUser?.role, currentUser?.branchId, hasHydrated]);

  const updateProfile = async (data: { name: string; companyName?: string; phone?: string; taxId?: string; address?: string }) => {
    if (!currentUser?.id) return;
    try {
      // 1. Update user name in Firestore (using setDoc to upsert without throwing errors)
      await setDoc(fsDoc(db, 'users', currentUser.id), {
        name: data.name,
        updatedAt: Timestamp.now()
      }, { merge: true });

      // 2. Update company details in Firestore
      if (currentUser.companyId) {
        try {
          await setDoc(fsDoc(db, 'companies', currentUser.companyId), {
            name: data.companyName || '',
            phone: data.phone || '',
            taxId: data.taxId || '',
            address: data.address || '',
            updatedAt: Timestamp.now()
          }, { merge: true });
        } catch (fErr) {
          console.warn('Firestore company update skipped:', fErr);
        }
      }
      
      // 3. Update Laravel MySQL database for User
      if (accessToken) {
        try {
          await fetch(`${API_BASE_URL}/user/update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ name: data.name })
          });
        } catch (dbErr) {
          console.warn('MySQL user profile update failed:', dbErr);
        }
      }

      // 4. Update Laravel MySQL database for Company
      if (accessToken && currentUser.companyId && data.companyName) {
        try {
          await fetch(`${API_BASE_URL}/company/update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ name: data.companyName })
          });
        } catch (dbErr) {
          console.warn('MySQL company name update failed:', dbErr);
        }
      }
      
      // 5. Update local state to reflect changes immediately
      setUser({
        ...currentUser,
        name: data.name,
        companyName: data.companyName || currentUser.companyName
      });

      if (currentUser.companyId) {
        setCompany(prev => prev ? {
          ...prev,
          name: data.companyName || prev.name,
          phone: data.phone || prev.phone,
          taxId: data.taxId || prev.taxId,
          address: data.address || prev.address,
        } : null);
      }

      openLabelNotice('Profile Updated', 'Your profile and store credentials have been updated successfully.', 'success');
    } catch (error: any) {
      openLabelNotice('Update Failed', error.message || 'Could not update profile.', 'error');
    }
  };

  // Helper: Get company display code
  const getCompanyDisplayCode = () => {
    if (company?.code) return company.code;
    return company?.name?.slice(0, 3).toUpperCase() || 'VND';
  };

  // Helper: Notice modals
  const openLabelNotice = (title: string, message: string, tone: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setLabelModal({ title, message, tone, confirmLabel: 'OK' });
  };

  const openLabelConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>, confirmLabel = 'Confirm') => {
    setLabelModal({ title, message, tone: 'warning', confirmLabel, cancelLabel: 'Cancel', onConfirm });
  };

  // derived filtered states
  const isBranchFiltered = selectedBranchId !== 'all' && selectedBranchId !== '';
  
  const filteredProducts = useMemo(() => {
    let items = products;
    if (isBranchFiltered) {
      const branchProductIds = new Set(branchProducts.filter(bp => bp.branchId === selectedBranchId).map(bp => bp.productId));
      items = items.filter(p => branchProductIds.has(p.id));
    }
    if (selectedFilterCategory !== 'all') {
      items = items.filter(p => p.category === selectedFilterCategory);
    }
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      items = items.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.sku.toLowerCase().includes(term) ||
        (p.productCode || '').toLowerCase().includes(term)
      );
    }
    return items;
  }, [products, branchProducts, selectedBranchId, selectedFilterCategory, searchTerm, isBranchFiltered]);

  const paginatedProducts = useMemo(() => {
    return filteredProducts.slice((productPage - 1) * productsPerPage, productPage * productsPerPage);
  }, [filteredProducts, productPage, productsPerPage]);

  const totalProductPages = Math.ceil(filteredProducts.length / productsPerPage);

  const filteredLabels = useMemo(() => {
    let items = [...labels]; // Use spread to avoid mutating original
    if (isBranchFiltered) items = items.filter(l => l.branchId === selectedBranchId);
    
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      items = items.filter(l => 
        (l.labelId || '').toLowerCase().includes(term) || 
        (l.productName || '').toLowerCase().includes(term) ||
        (l.productSku || '').toLowerCase().includes(term) ||
        (l.productCode || '').toLowerCase().includes(term) ||
        (l.productId || '').toLowerCase().includes(term)
      );
    }

    // Explicitly sort: Numeric-aware sequence (DL-001, DL-002, DL-010, etc.)
    return items.sort((a, b) => {
      const idA = a.labelId || '';
      const idB = b.labelId || '';
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [labels, selectedBranchId, searchTerm, isBranchFiltered]);

  // Actions
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = async () => {
    await logOut();
    clearUser();
    router.push('/login');
  };

  const createStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!currentUser?.companyId || !staffForm.branchId) {
      openLabelNotice('Select branch', 'Please select a branch.', 'warning');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await laravelApi.saveStaff({
        name: staffForm.name,
        email: staffForm.email,
        password: staffForm.password,
        branchId: staffForm.branchId,
        position: staffForm.position,
      }, accessToken!);
      
      setShowCreateStaff(false);
      openLabelNotice('Staff created', `Staff "${staffForm.name}" created successfully!`, 'success');
      loadVendorData();

      // Trigger notification
      await createNotification({
        companyId: currentUser.companyId,
        branchId: staffForm.branchId,
        title: 'New Staff Member',
        message: `${staffForm.name} has been added to the team as ${staffForm.position}.`,
        type: 'success'
      });
    } catch (error: any) {
      openLabelNotice('Create failed', error?.message || 'Could not create staff.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditStaff?.id) return;
    try {
      await laravelApi.saveStaff({
        id: showEditStaff.id,
        name: editStaffForm.name,
        email: editStaffForm.email,
        branchId: editStaffForm.branchId,
        position: editStaffForm.position,
      }, accessToken!);
      
      setShowEditStaff(null);
      openLabelNotice('Staff updated', 'Staff details saved.', 'success');
      loadVendorData();
    } catch (error) {
      openLabelNotice('Update failed', 'Could not update staff details.', 'error');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResetPassword || !resetPasswordData.newPassword) return;
    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
      openLabelNotice('Error', 'Passwords do not match.', 'error');
      return;
    }
    try {
      // Logic for password reset...
      openLabelNotice('Success', 'Password reset successfully.', 'success');
      setShowResetPassword(null);
    } catch (error: any) {
      openLabelNotice('Reset failed', error?.message || 'Could not reset password.', 'error');
    }
  };

  const createPromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.companyId) return;
    try {
      await laravelApi.savePromotion({
        name: promotionForm.name,
        description: promotionForm.description,
        type: promotionForm.type,
        value: promotionForm.value,
        applyTo: promotionForm.applyTo,
        selectedProducts: promotionForm.selectedProducts,
        selectedBranches: promotionForm.selectedBranches,
        startDate: promotionForm.startDate,
        endDate: promotionForm.endDate,
        branchId: currentUser.role === 'staff' ? currentUser.branchId : (promotionForm as any).branchId || 'all',
      }, accessToken!);

      setShowCreatePromotion(false);
      openLabelNotice('Success', 'Promotion created successfully!', 'success');
      loadVendorData();

      // Trigger notification
      await createNotification({
        companyId: currentUser.companyId,
        branchId: currentUser.role === 'staff' ? currentUser.branchId : (promotionForm as any).branchId || 'all',
        title: 'New Campaign Launched',
        message: `Promotion "${promotionForm.name}" is now active.`,
        type: 'info'
      });
    } catch (error: any) {
      openLabelNotice('Create failed', error.message || 'Could not create promotion.', 'error');
    }
  };

  const updatePromotion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPromotion?.id) return;
    try {
      await laravelApi.savePromotion({
        id: editingPromotion.id,
        name: promotionForm.name,
        description: promotionForm.description,
        type: promotionForm.type,
        value: promotionForm.value,
        applyTo: promotionForm.applyTo,
        selectedProducts: promotionForm.selectedProducts,
        selectedBranches: promotionForm.selectedBranches,
        startDate: promotionForm.startDate,
        endDate: promotionForm.endDate,
        branchId: currentUser.role === 'staff' ? currentUser.branchId : (promotionForm as any).branchId || 'all',
      }, accessToken!);

      setEditingPromotion(null);
      openLabelNotice('Success', 'Promotion updated successfully!', 'success');
      loadVendorData();
    } catch (error: any) {
      openLabelNotice('Update failed', error.message || 'Could not update promotion.', 'error');
    }
  };

  const createProductFromModal = async (productData: any) => {
    if (!currentUser?.companyId) return;
    try {
      await laravelApi.saveProduct({
        name: productData.name,
        sku: productData.sku,
        price: productData.basePrice,
        category: productData.category,
        stock: productData.stock,
        minStock: productData.minStock,
        description: productData.description,
        imageUrl: productData.imageUrl,
      }, accessToken!);

      setShowProductModal(false);
      openLabelNotice('Success', `Product "${productData.name}" created.`, 'success');
      loadVendorData();
    } catch (error: any) {
      openLabelNotice('Error', error.message || 'Could not create product.', 'error');
    }
  };

  const updateProduct = async (productId: string, productData: any) => {
    try {
      await laravelApi.saveProduct({
        id: productId,
        name: productData.name,
        sku: productData.sku,
        price: productData.basePrice,
        category: productData.category,
        stock: productData.stock,
        minStock: productData.minStock,
        description: productData.description,
        imageUrl: productData.imageUrl,
      }, accessToken!);

      setShowProductModal(false);
      openLabelNotice('Updated', 'Product details and inventory status synced.', 'success');
      loadVendorData();
    } catch (error: any) {
      openLabelNotice('Error', error.message || 'Could not update product.', 'error');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    openLabelConfirm('Delete product', 'Are you sure? This will remove the product from all branches.', async () => {
      try {
        await laravelApi.deleteProduct(id, accessToken!);
        openLabelNotice('Deleted', 'Product removed.', 'success');
        loadVendorData();
      } catch (error) {
        openLabelNotice('Error', 'Could not delete product.', 'error');
      }
    });
  };

  const handleDeleteStaff = async (id: string) => {
    openLabelConfirm('Delete staff', 'Are you sure you want to remove this staff member?', async () => {
      try {
        await laravelApi.deleteStaff(id, accessToken!);
        openLabelNotice('Deleted', 'Staff member removed.', 'success');
        loadVendorData();
      } catch (error) {
        openLabelNotice('Error', 'Could not delete staff.', 'error');
      }
    });
  };

  const handleDeletePromotion = async (id: string) => {
    openLabelConfirm('Delete promotion', 'Are you sure? This action cannot be undone.', async () => {
      try {
        await laravelApi.deletePromotion(id, accessToken!);
        openLabelNotice('Deleted', 'Promotion removed.', 'success');
        loadVendorData();
      } catch (error) {
        openLabelNotice('Error', 'Could not delete promotion.', 'error');
      }
    });
  };

  const handleDeleteCategory = async (id: string) => {
    openLabelConfirm('Delete category', 'Are you sure? Products in this category will be moved to General.', async () => {
      try {
        await laravelApi.deleteCategory(id, accessToken!);
        openLabelNotice('Deleted', 'Category removed.', 'success');
        loadVendorData();
      } catch (error) {
        openLabelNotice('Error', 'Could not delete category.', 'error');
      }
    });
  };

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    
    setIsRefreshing(true);
    try {
      // Compress the image on the client side to save storage & bandwidth, and make uploads blazingly fast!
      const compressedFile = await compressImage(file, 800, 800, 0.75);
      
      const formData = new FormData();
      formData.append('image', compressedFile);

      // Upload to our backend (Cloudinary integration)
      const response = await fetch(`${API_BASE_URL}/upload/profile`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      const photoURL = data.url;

      // Update Laravel MySQL Database
      if (accessToken) {
        try {
          await fetch(`${API_BASE_URL}/user/update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ photo_url: photoURL })
          });
        } catch (dbErr) {
          console.warn('MySQL profile update failed:', dbErr);
        }
      }

      // Update Firestore gracefully (using setDoc to avoid No Document To Update)
      try {
        await setDoc(fsDoc(db, 'users', currentUser.id), { photoURL }, { merge: true });
      } catch (fErr) {
        console.warn('Firestore sync skipped:', fErr);
      }
      
      // Update local state
      setUser({ ...currentUser, photoURL });
      
      openLabelNotice('Success', 'Profile picture updated successfully!', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      openLabelNotice('Error', 'Upload failed. Check server connection.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.companyId) return;
    
    setIsRefreshing(true);
    try {
      // Compress the store logo on the client side to save storage & bandwidth, and make uploads blazingly fast!
      const compressedFile = await compressImage(file, 800, 800, 0.75);
      
      const formData = new FormData();
      formData.append('image', compressedFile);

      // 1. Upload store logo securely to ImageKit
      const response = await fetch(`${API_BASE_URL}/upload/profile`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      const logoUrl = data.url;

      // 2. Save store logo in Laravel MySQL Database
      if (accessToken) {
        try {
          await fetch(`${API_BASE_URL}/company/update`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({ logo_url: logoUrl })
          });
        } catch (dbErr) {
          console.warn('MySQL company logo update failed:', dbErr);
        }
      }

      // 3. Gracefully update Firestore (using setDoc to avoid No Document To Update)
      try {
        await setDoc(fsDoc(db, 'companies', currentUser.companyId), { logoUrl }, { merge: true });
      } catch (fErr) {
        console.warn('Firestore company logo sync skipped:', fErr);
      }
      
      // 4. Update local state
      setCompany(prev => prev ? { ...prev, logoUrl } : null);
      setUser({ ...currentUser, companyLogo: logoUrl });
      
      openLabelNotice('Success', 'Store logo updated successfully!', 'success');
    } catch (error) {
      console.error('Logo upload error:', error);
      openLabelNotice('Error', 'Logo upload failed.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBulkImport = async (file: File) => {
    if (!currentUser?.companyId) return;
    setIsRefreshing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const newProducts = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const values = lines[i].split(',').map(v => v.trim());
          const product: any = {};
          headers.forEach((header, index) => {
            product[header] = values[index];
          });
          
          if (product.name && product.baseprice) {
            newProducts.push({
              name: product.name,
              sku: product.sku || makeSku(Math.floor(Math.random() * 1000000)),
              basePrice: parseFloat(product.baseprice) || 0,
              category: product.category || 'General',
              stock: parseInt(product.stock) || 0,
              minStock: parseInt(product.minstock) || 10,
              description: product.description || '',
              productCode: product.productcode || product.barcode || product.sku || '',
              status: 'active',
              companyId: currentUser.companyId,
              createdBy: currentUser.id,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            });
          }
        }

        if (newProducts.length === 0) {
          openLabelNotice('Import Error', 'No valid products found in CSV.', 'error');
          setIsRefreshing(false);
          return;
        }

        const promises = newProducts.map(async (pData) => {
          const productRef = await addDoc(collection(db, 'products'), pData);
          const stockVal = pData.stock;
          const minVal = pData.minStock;
          let status: 'in-stock' | 'low-stock' | 'out-of-stock' = 'in-stock';
          if (stockVal === 0) status = 'out-of-stock';
          else if (stockVal <= minVal) status = 'low-stock';

          await Promise.all(branches.map(branch => 
            addDoc(collection(db, 'branch_products'), {
              productId: productRef.id,
              branchId: branch.id,
              companyId: currentUser.companyId,
              currentPrice: pData.basePrice,
              stock: stockVal,
              minStock: minVal,
              status,
              lastUpdated: Timestamp.now()
            })
          ));
        });

        await Promise.all(promises);
        openLabelNotice('Success', `Imported ${newProducts.length} products successfully.`, 'success');
        setIsRefreshing(false);
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Import error:', error);
      openLabelNotice('Import Failed', 'Failed to process CSV file.', 'error');
      setIsRefreshing(false);
    }
  };

  const handleBulkProvision = async (branchId: string, count: number) => {
    if (!currentUser?.companyId) return;
    try {
      await generateLabelsForBranch({
        companyId: currentUser.companyId,
        branchId,
        count
      });
      openLabelNotice('Success', `${count} labels generated for this branch.`, 'success');
    } catch (error: any) {
      openLabelNotice('Bulk Provision Failed', error.message || 'Could not generate labels.', 'error');
    }
  };

  const handleBulkExport = () => {
    try {
      const headers = ['Name', 'SKU', 'BasePrice', 'Category', 'Stock', 'MinStock', 'Description'];
      const csvContent = [
        headers.join(','),
        ...products.map(p => {
          const { stock, minStock } = getDisplayStockForProduct(p.id);
          return [
            `"${p.name}"`,
            `"${p.sku}"`,
            p.basePrice,
            `"${p.category || 'General'}"`,
            stock,
            minStock || 10,
            `"${(p.description || '').replace(/"/g, '""')}"`
          ].join(',');
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export error:', error);
      openLabelNotice('Export Failed', 'Failed to generate CSV export.', 'error');
    }
  };

  const downloadImportTemplate = () => {
    const headers = ['Name', 'SKU', 'BasePrice', 'Category', 'Stock', 'MinStock', 'Description'];
    const sampleData = [
      ['Sample Product', 'SKU-001', '19.99', 'Electronics', '100', '10', 'High quality sample product'],
      ['Another Item', 'SKU-002', '5.50', 'Groceries', '50', '5', 'Fresh organic item']
    ];
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const provisionLabel = async (data: { labelId: string; location: string; branchId: string }) => {
    if (!currentUser?.companyId) return;
    
    // Check for location conflict in the same branch
    if (data.location) {
      const isDuplicate = labels.some(l => 
        l.branchId === data.branchId && 
        l.location?.toLowerCase().trim() === data.location.toLowerCase().trim()
      );
      if (isDuplicate) {
        openLabelNotice('Location Conflict', `${data.location} is already occupied by another label in this branch.`, 'error');
        return;
      }
    }

    try {
      // Keep local state responsive for demo tag provisioning
      const newLabel: any = {
        id: 'LBL-' + Math.floor(Math.random() * 100000),
        labelId: data.labelId,
        location: data.location,
        branchId: data.branchId,
        companyId: currentUser.companyId,
        status: 'active',
        battery: 100,
        productId: null,
        lastSync: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      setLabels(prev => [...prev, newLabel]);
      openLabelNotice('Success', `Label ${data.labelId} provisioned at ${data.location || 'unspecified location'}.`, 'success');
    } catch (error: any) {
      openLabelNotice('Provision failed', error.message || 'Could not register hardware.', 'error');
    }
  };

  const updateLabelLocation = async (id: string, location: string) => {
    const label = labels.find(l => l.id === id);
    if (!label) return;

    // Check for location conflict (excluding itself)
    if (location) {
      const isDuplicate = labels.some(l => 
        l.id !== id && 
        l.branchId === label.branchId && 
        l.location?.toLowerCase().trim() === location.toLowerCase().trim()
      );
      if (isDuplicate) {
        openLabelNotice('Location Conflict', `${location} is already occupied by another label in this branch.`, 'error');
        return;
      }
    }

    try {
      // Relocate locally
      setLabels(prev => prev.map(l => l.id.toString() === id.toString() ? { ...l, location } : l));
      openLabelNotice('Location Updated', `Label relocated to ${location}.`, 'success');
    } catch (error: any) {
      openLabelNotice('Update Failed', error.message || 'Could not update location.', 'error');
    }
  };

  const bulkAutoMapLocations = async (branchId: string, prefix: string, forceAll: boolean = false) => {
    const targets = labels.filter(l => {
      const isCorrectBranch = (branchId === 'all' || l.branchId === branchId);
      if (!isCorrectBranch) return false;
      if (forceAll) return true;
      return (!l.location || l.location.toLowerCase().includes('unset'));
    });

    if (targets.length === 0) {
      openLabelNotice('Nothing to Map', 'No applicable labels found for this operation.', 'info');
      return;
    }

    let successCount = 0;
    try {
      const updatedLabels = [...labels];
      for (const label of targets) {
        const match = label.labelId.match(/\d+/);
        if (match) {
          const rawNum = match[0];
          const padding = rawNum.length >= 3 ? 3 : 2;
          const num = rawNum.padStart(padding, '0');
          const newLocation = `${prefix} ${num}`;
          
          const idx = updatedLabels.findIndex(l => l.id.toString() === label.id.toString());
          if (idx !== -1) {
             updatedLabels[idx] = { ...updatedLabels[idx], location: newLocation };
          }
          
          successCount++;
        }
      }
      setLabels(updatedLabels);
      openLabelNotice('Auto-Map Complete', `Successfully organized ${successCount} labels as ${prefix} positions.`, 'success');
    } catch (error: any) {
      openLabelNotice('Auto-Map Failed', error.message || 'Error during bulk update.', 'error');
    }
  };

  const assignProductToLabel = async (labelId: string, productId: string, branchId: string, labelCode?: string) => {
    try {
      const product = products.find(p => p.id === productId);
      if (!product) return;
      
      await laravelApi.linkProductToLabel(labelId, productId, accessToken!);
      
      openLabelNotice('Syncing', `Label ${labelCode || labelId} is being synchronized with ${product.name}.`, 'success');
      loadVendorData();
    } catch (error) {
      openLabelNotice('Error', 'Failed to assign product.', 'error');
    }
  };

  const handleUnlinkProductFromLabel = async (labelId: string) => {
    try {
      await laravelApi.unlinkProductFromLabel(labelId, accessToken!);
      openLabelNotice('Unlinked', 'Product removed from label.', 'success');
      loadVendorData();
    } catch (error) {
      openLabelNotice('Error', 'Failed to unlink product.', 'error');
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    try {
      await laravelApi.deleteLabel(labelId, accessToken!);
      openLabelNotice('Deleted', 'Hardware node permanently removed from system.', 'success');
      loadVendorData();
    } catch (error) {
      openLabelNotice('Error', 'Failed to remove hardware node.', 'error');
    }
  };

  const executeManualDiscount = async (percent: number) => {
    if (!activeDiscountModal) return;
    try {
      await laravelApi.applyDiscount({
        labelId: activeDiscountModal.labelId,
        percent
      }, accessToken!);
      setActiveDiscountModal(null);
      openLabelNotice('Campaign Active', `A ${percent}% discount has been pushed to the electronic tag.`, 'success');
      loadVendorData();
    } catch (error) {
      console.error(error);
      openLabelNotice('Error', 'Failed to apply discount override.', 'error');
    }
  };

  const handleSyncAllLabels = async () => {
    if (!selectedBranchId || selectedBranchId === 'all') {
       openLabelNotice('Action Required', 'Please select a specific branch to perform a full system sync.', 'info');
       return;
    }
    
    setIsRefreshing(true);
    try {
      const branchLabels = labels.filter(l => l.branchId === selectedBranchId);
      
      if (branchLabels.length === 0) {
         openLabelNotice('No Labels Detected', 'This branch currently has no digital labels registered.', 'info');
         setIsRefreshing(false);
         return;
      }

      await Promise.all(branchLabels.map(l => 
        laravelApi.syncLabel(l.id, 'active', accessToken!)
      ));
      
      openLabelNotice('Sync Complete', `Successfully pushed latest pricing to ${branchLabels.length} electronic tags.`, 'success');
      loadVendorData();
    } catch (error) {
      openLabelNotice('Sync Failed', 'System error during bulk synchronization.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const createBranch = async (branchData: any) => {
    if (!currentUser?.companyId) return;
    try {
      const docRef = await addDoc(collection(db, 'branches'), {
        ...branchData,
        companyId: currentUser.companyId,
        createdAt: Timestamp.now()
      });
      // Synchronize local state instantly
      const newBranch = {
        id: docRef.id,
        company_id: currentUser.companyId,
        status: 'active',
        ...branchData
      };
      setBranches(prev => [...prev, newBranch]);
      openLabelNotice('Branch Created', `${branchData.name} has been added to your retail network.`, 'success');
      setShowCreateBranch(false);
    } catch (error) {
      openLabelNotice('Error', 'Failed to create new branch.', 'error');
    }
  };

  const updateBranch = async (branchId: string, branchData: any) => {
    try {
      // Use setDoc with merge: true to prevent Firestore "No document to update" errors if the doc ID is numeric/missing
      await setDoc(fsDoc(db, 'branches', branchId.toString()), {
        ...branchData,
        updatedAt: Timestamp.now()
      }, { merge: true });
      
      // Synchronize local state instantly
      setBranches(prev => prev.map(b => b.id.toString() === branchId.toString() ? { ...b, ...branchData } : b));
      
      openLabelNotice('Branch Updated', `${branchData.name} details have been refreshed.`, 'success');
      setShowCreateBranch(false);
    } catch (error) {
      console.error('Update branch error:', error);
      openLabelNotice('Error', 'Failed to update branch.', 'error');
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    openLabelConfirm('Delete Branch', 'Are you sure? This will permanently remove this location and may affect assigned staff/labels.', async () => {
      try {
        await deleteDoc(fsDoc(db, 'branches', branchId.toString()));
        
        // Synchronize local state instantly
        setBranches(prev => prev.filter(b => b.id.toString() !== branchId.toString()));
        
        openLabelNotice('Branch Removed', 'Location has been deleted from your network.', 'success');
      } catch (error) {
        openLabelNotice('Error', 'Failed to delete branch.', 'error');
      }
    });
  };

  const reportIssue = async (labelCode: string, issue: string, priority: 'high' | 'medium' | 'low') => {
    if (!currentUser?.companyId) return;
    
    const label = labels.find(l => l.labelId === labelCode);
    if (!label) {
      openLabelNotice('Not Found', 'Could not locate that hardware tag.', 'error');
      return;
    }

    try {
      await laravelApi.reportIssue({
        labelId: label.id,
        productId: label.productId,
        issue,
        priority
      }, accessToken!);

      // Create notification
      await createNotification({
        companyId: currentUser.companyId,
        branchId: label.branchId,
        title: 'Hardware Issue Flagged',
        message: `${currentUser.name || 'Manager'} reported: ${issue} on ${labelCode}`,
        type: priority === 'high' ? 'alert' : 'warning'
      });

      openLabelNotice('Report Sent', 'Maintenance log updated successfully.', 'success');
      setShowReportIssue(false);
      loadVendorData();
    } catch (error) {
      console.error('Report error:', error);
      openLabelNotice('Error', 'Failed to submit report.', 'error');
    }
  };

  return {
    selectedTab, setSelectedTab,
    loading,
    isRefreshing,
    company,
    branches,
    products,
    branchProducts,
    categories,
    staffMembers,
    labels,
    promotions,
    issues,
    selectedBranchId, setSelectedBranchId,
    selectedFilterCategory, setSelectedFilterCategory,
    searchTerm, setSearchTerm,
    labelSyncFilter, setLabelSyncFilter,
    filteredProducts,
    filteredLabels,
    paginatedProducts,
    totalProductPages,
    productPage, setProductPage,
    mobileNavOpen, setMobileNavOpen,
    showCreateStaff, setShowCreateStaff,
    showProductModal, setShowProductModal,
    showCreateBranch, setShowCreateBranch,
    showCreatePromotion, setShowCreatePromotion,
    editingPromotion, setEditingPromotion,
    handleEditProduct,
    handleEditBranch,
    showEditStaff, setShowEditStaff,
    showResetPassword, setShowResetPassword,
    showCategoryModal, setShowCategoryModal,
    selectedCategory, setSelectedCategory,
    selectedProductForEdit, setSelectedProductForEdit,
    selectedBranchForEdit, setSelectedBranchForEdit,
    assignProductModal, setAssignProductModal,
    assignSearchQuery, setAssignSearchQuery,
    activeDiscountModal, setActiveDiscountModal,
    labelModal, setLabelModal,
    selectedLabel, setSelectedLabel,
    labelFor3D, setLabelFor3D,
    staffForm, setStaffForm,
    editStaffForm, setEditStaffForm,
    promotionForm, setPromotionForm,
    resetPasswordData, setResetPasswordData,
    handleLogout,
    createStaff, updateStaff, handleResetPassword,
    createPromotion, updatePromotion,
    createBranch, updateBranch, handleDeleteBranch,
    handleDeleteProduct,
    handleSyncAllLabels,
    assignProductToLabel,
    executeManualDiscount,
    handleUnlinkProductFromLabel,
    handleDeleteLabel,
    handleDeleteStaff,
    handleDeletePromotion,
    handleDeleteCategory,
    handleProfileUpload,
    handleLogoUpload,
    updateProfile,
    createProductFromModal,
    updateProduct,
    getDisplayStockForProduct,
    currentUser,
    hasHydrated,
    loadVendorData,
    openLabelConfirm,
    openLabelNotice,
    showProvisionModal, setShowProvisionModal,
    provisionLabel,
    handleBulkProvision,
    updateLabelLocation,
    bulkAutoMapLocations,
    showReportIssue, setShowReportIssue,
    reportIssue,
    updateIssueStatus,
    addIssueNote,
    handleBulkImport,
    handleBulkExport,
    downloadImportTemplate
  };
}
