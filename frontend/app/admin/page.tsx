'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw
} from 'lucide-react';

// Admin Components
import { DashboardSidebar } from '@/components/admin/DashboardSidebar';
import { DashboardHeader } from '@/components/admin/DashboardHeader';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { AdminCompanies } from '@/components/admin/AdminCompanies';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminAnalytics } from '@/components/admin/AdminAnalytics';
import { AdminLabelUI } from '@/components/admin/AdminLabelUI';
import { AdminSettings } from '@/components/admin/AdminSettings';
import { AdminAudit } from '@/components/admin/AdminAudit';
import { AdminSync } from '@/components/admin/AdminSync';
import { CompanyModal } from '@/components/admin/CompanyModal';
import { VendorModal } from '@/components/admin/VendorModal';

// Hooks & Lib
import { laravelApi } from '@/lib/api';
import { useUserStore } from '@/lib/user-store';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export default function SuperAdminDashboard() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'companies' | 'users' | 'analytics' | 'settings' | 'label-ui' | 'audit' | 'sync'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('admin_selected_tab') as any) || 'overview';
    }
    return 'overview';
  });

  // Persist selected tab across refreshes
  useEffect(() => {
    localStorage.setItem('admin_selected_tab', selectedTab);
  }, [selectedTab]);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [dashboardData, setDashboardData] = useState<{
    metrics: any;
    companies: any[];
    users: any[];
    recentLogs: any[];
  } | null>(null);

  const { user: currentUser, accessToken, clearUser, hasHydrated } = useUserStore();
  const { t } = useLanguage();
  const router = useRouter();

  // Redirect if not admin
  const redirecting = useRef(false);
  useEffect(() => {
    if (!hasHydrated || redirecting.current) return;
    
    if (!currentUser || !accessToken) {
      redirecting.current = true;
      router.replace('/login');
    } else if (currentUser.role !== 'admin') {
      redirecting.current = true;
      router.replace('/login');
    }
  }, [currentUser, accessToken, hasHydrated, router]);

  const loadAdminData = async (silent = false) => {
    if (!accessToken) return;
    
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    
    try {
      const data = await laravelApi.getAdminDashboard(accessToken);
      
      // Map Laravel data to component expectations if necessary
      const mappedCompanies = data.companies.map((c: any) => ({
        ...c,
        id: c.id.toString(),
        branchesCount: c.branches_count,
        labelsCount: c.labels_count,
        productsCount: c.products_count,
        categoriesCount: c.categories_count,
        staffCount: c.staff_count
      }));

      const mappedUsers = data.users.map((u: any) => ({
        ...u,
        id: u.id.toString(),
        companyId: u.company?.name || 'N/A',
        companyLogo: u.company?.logo_url || u.company?.logoUrl || null
      }));

      setDashboardData({
        metrics: data.metrics,
        companies: mappedCompanies,
        users: mappedUsers,
        recentLogs: data.recentLogs || []
      });
    } catch (err) {
      console.error('Failed to fetch admin dashboard', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // 1. Fully-functional CRUD Handlers for Company Deletion and Suspension
  const handleDeleteCompany = async (id: string) => {
    if (!accessToken) return;
    if (!confirm('Are you absolutely sure you want to delete this company? This action cannot be undone.')) return;
    try {
      setLoading(true);
      await laravelApi.deleteCompany(id, accessToken);
      await loadAdminData(true);
    } catch (err) {
      console.error('Failed to delete company', err);
      alert('Failed to delete company. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendCompany = async (id: string, currentStatus: string) => {
    if (!accessToken) return;
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    const actionText = currentStatus === 'suspended' ? 'activate' : 'suspend';
    if (!confirm(`Are you sure you want to ${actionText} this company?`)) return;
    try {
      setLoading(true);
      await laravelApi.updateCompanyStatus(id, newStatus, accessToken);
      await loadAdminData(true);
    } catch (err) {
      console.error('Failed to change company status', err);
      alert('Failed to update company status.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fully-functional CRUD Handlers for User/Vendor Deletion and Moderation
  const handleDeleteUser = async (id: string) => {
    if (!accessToken) return;
    if (id === currentUser?.id?.toString()) {
      alert('For security compliance, you cannot delete your own logged-in admin account.');
      return;
    }
    if (!confirm('Are you absolutely sure you want to delete this user? This action cannot be undone.')) return;
    try {
      setLoading(true);
      await laravelApi.deleteUser(id, accessToken);
      await loadAdminData(true);
    } catch (err) {
      console.error('Failed to delete user', err);
      alert('Failed to delete user.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatusChange = async (id: string, newStatus: string) => {
    if (!accessToken) return;
    try {
      setLoading(true);
      await laravelApi.updateUserStatus(id, newStatus, accessToken);
      await loadAdminData(true);
    } catch (err) {
      console.error('Failed to update user status', err);
      alert('Failed to update user status.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserRoleChange = async (id: string, newRole: string) => {
    if (!accessToken) return;
    try {
      setLoading(true);
      await laravelApi.updateUserRole(id, newRole, accessToken);
      await loadAdminData(true);
    } catch (err) {
      console.error('Failed to update user role', err);
      alert('Failed to update user role.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasHydrated && accessToken && currentUser?.role === 'admin') {
      loadAdminData();
    }
  }, [accessToken, hasHydrated, currentUser]);

  const handleLogout = async () => {
    clearUser();
    router.push('/login');
  };

  if (!hasHydrated || !currentUser) return null;

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#111928] overflow-hidden transition-colors duration-300">
      {/* Loading Bar */}
      {(loading || isRefreshing) && (
        <div className="fixed top-0 left-0 right-0 z-[1000] h-0.5 bg-transparent overflow-hidden">
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="h-full w-1/3 bg-gradient-to-r from-transparent via-[#5750F1] to-transparent shadow-[0_0_10px_#5750F1]"
          />
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileNavOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="absolute top-0 bottom-0 left-0 w-64 shadow-2xl bg-white dark:bg-[#1C2434] z-10"
            >
              <DashboardSidebar
                currentUser={currentUser as any}
                selectedTab={selectedTab}
                setSelectedTab={(tab: any) => {
                  setSelectedTab(tab);
                  setMobileNavOpen(false); // Close sidebar on mobile when tab is clicked
                }}
                onLogout={handleLogout}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0 relative z-10">
        <DashboardSidebar
          currentUser={currentUser as any}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab as any}
          onLogout={handleLogout}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <DashboardHeader
          onMenuOpen={() => setMobileNavOpen(true)}
          onRefresh={() => loadAdminData(true)}
          title={t(selectedTab) || selectedTab}
          isRefreshing={isRefreshing || loading}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onTabChange={setSelectedTab as any}
        />

        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] dark:bg-[#111928] p-4 lg:p-8 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {!dashboardData && loading ? (
                <div className="flex items-center justify-center h-64">
                  <RefreshCw className="h-8 w-8 animate-spin text-[#5750F1]" />
                </div>
              ) : (
                <>
                  {selectedTab === 'overview' && dashboardData && (
                    <AdminOverview 
                      metrics={dashboardData.metrics} 
                      onTabChange={setSelectedTab as any} 
                    />
                  )}

                  {selectedTab === 'companies' && dashboardData && (
                    <AdminCompanies
                      companies={dashboardData.companies}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      onEdit={(c) => {
                        setSelectedCompany(c);
                        setShowCompanyModal(true);
                      }}
                      onDelete={handleDeleteCompany}
                      onSuspend={handleSuspendCompany}
                    />
                  )}

                  {selectedTab === 'users' && dashboardData && (
                    <AdminUsers
                      users={dashboardData.users}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      onEdit={(u) => {
                        setSelectedUser(u);
                        setShowVendorModal(true);
                      }}
                      onDelete={handleDeleteUser}
                      onSuspend={(id, s) => handleUserStatusChange(id, s === 'suspended' ? 'active' : 'suspended')}
                      onStatusChange={handleUserStatusChange}
                      onRoleChange={(id, r) => {
                        const nextRole = r === 'admin' ? 'vendor' : 'admin';
                        handleUserRoleChange(id, nextRole);
                      }}
                      onCreate={() => {
                        setSelectedUser(null);
                        setShowVendorModal(true);
                      }}
                    />
                  )}

                  {selectedTab === 'analytics' && dashboardData && (
                    <AdminAnalytics 
                      metrics={dashboardData.metrics} 
                      companies={dashboardData.companies} 
                    />
                  )}

                  {selectedTab === 'label-ui' && (
                    <AdminLabelUI />
                  )}

                  {selectedTab === 'audit' && (
                    <AdminAudit />
                  )}

                  {selectedTab === 'sync' && (
                    <AdminSync />
                  )}

                  {selectedTab === 'settings' && (
                    <AdminSettings />
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Admin Modals */}
      <CompanyModal
        isOpen={showCompanyModal}
        onClose={() => {
          setShowCompanyModal(false);
          setSelectedCompany(null);
        }}
        editingCompany={selectedCompany}
        onSave={async (data) => {
          if (!accessToken) return;
          try {
            const payload = {
              ...data,
              id: selectedCompany?.id ? parseInt(selectedCompany.id) : null
            };
            await laravelApi.saveCompany(payload, accessToken);
            await loadAdminData(true);
          } catch (err: any) {
            console.error('Failed to save company', err);
            alert(err.message || 'Failed to save company. Please verify company details.');
            throw err;
          }
        }}
      />

      <VendorModal
        isOpen={showVendorModal}
        onClose={() => {
          setShowVendorModal(false);
          setSelectedUser(null);
        }}
        editingUser={selectedUser}
        onSave={async (data) => {
          if (!accessToken) return;
          try {
            const payload = {
              ...data,
              id: selectedUser?.id ? parseInt(selectedUser.id) : null
            };
            await laravelApi.saveUser(payload, accessToken);
            await loadAdminData(true);
          } catch (err: any) {
            console.error('Failed to save vendor', err);
            alert(err.message || 'Failed to save vendor user. Please make sure the company code exists.');
            throw err;
          }
        }}
      />
    </div>
  );
}