'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from '@/components/ui';
import { Sidebar, Header } from '@/components/layout';
import { cn } from '@/lib/utils';
import { Modal } from '@/components/modal';
import {
  Building2,
  LayoutGrid,
  GitBranch,
  Shield,
  Save,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

type Tab = 'general' | 'modules' | 'branches' | 'roles';

interface TenantSettings {
  id: string;
  businessName: string;
  slug: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

interface TenantModule {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  isWarehouse: boolean;
}

interface BranchFormData {
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
  isWarehouse: boolean;
}

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

const initialBranchFormData: BranchFormData = {
  name: '',
  code: '',
  address: '',
  phone: '',
  isActive: true,
  isWarehouse: false,
};

const moduleDescriptions: Record<string, string> = {
  products: 'Manage product catalog, pricing, and SKUs',
  inventory: 'Track stock levels, transfers, and adjustments',
  customers: 'Customer database and purchase history',
  suppliers: 'Supplier management and purchase orders',
  sales: 'Point of sale, invoices, and transactions',
  repairs: 'Repair ticket tracking and workflow management',
  employees: 'Staff accounts, roles, and scheduling',
  expenses: 'Business expense tracking and categories',
  reports: 'Analytics dashboards and custom reports',
};

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const isAdmin = user?.roles?.some(
    (role) => role === 'ADMIN' || role === 'TENANT_OWNER'
  );

  const tabs: { key: Tab; label: string; icon: any; adminOnly: boolean }[] = [
    { key: 'general', label: 'General', icon: Building2, adminOnly: false },
    { key: 'modules', label: 'Modules', icon: LayoutGrid, adminOnly: true },
    { key: 'branches', label: 'Branches', icon: GitBranch, adminOnly: true },
    { key: 'roles', label: 'Roles', icon: Shield, adminOnly: true },
  ];

  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || isAdmin);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Manage your tenant configuration and preferences.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? 'primary' : 'outline'}
                  onClick={() => setActiveTab(tab.key)}
                  className="gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Button>
              );
            })}
          </div>

          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'modules' && <ModulesTab />}
          {activeTab === 'branches' && <BranchesTab />}
          {activeTab === 'roles' && <RolesTab />}
        </main>
      </div>
    </div>
  );
}

function GeneralTab() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<TenantSettings>({
    queryKey: ['tenant-settings'],
    queryFn: () => api.get('/tenants/settings').then((res) => res.data?.data || res.data),
  });

  const [formData, setFormData] = useState<Partial<TenantSettings>>({});
  const [isDirty, setIsDirty] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<TenantSettings>) =>
      api.patch('/tenants/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setIsDirty(false);
    },
  });

  const handleChange = (field: keyof TenantSettings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const currentData = { ...settings, ...formData };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Business Name"
            value={currentData?.businessName || ''}
            onChange={(e) => handleChange('businessName', e.target.value)}
            placeholder="Your business name"
          />
          <Input
            label="Slug"
            value={currentData?.slug || ''}
            disabled
            className="bg-muted"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Phone"
            value={currentData?.phone || ''}
            onChange={(e) => handleChange('phone', e.target.value)}
            placeholder="Phone number"
          />
          <Input
            label="Email"
            type="email"
            value={currentData?.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="Email address"
          />
        </div>
        <div>
          <Input
            label="Address"
            value={currentData?.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Street address"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="City"
            value={currentData?.city || ''}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="City"
          />
          <Input
            label="State"
            value={currentData?.state || ''}
            onChange={(e) => handleChange('state', e.target.value)}
            placeholder="State / Province"
          />
          <Input
            label="Country"
            value={currentData?.country || ''}
            onChange={(e) => handleChange('country', e.target.value)}
            placeholder="Country"
          />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setFormData({});
              setIsDirty(false);
            }}
            disabled={!isDirty}
          >
            Discard
          </Button>
          <Button onClick={handleSave} disabled={!isDirty || updateMutation.isPending}>
            {updateMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ModulesTab() {
  const queryClient = useQueryClient();

  const { data: modules = [], isLoading } = useQuery<TenantModule[]>({
    queryKey: ['tenant-modules'],
    queryFn: () => api.get('/tenants/modules').then((res) => res.data?.data || res.data),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/tenants/modules/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-modules'] });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modules</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module) => (
            <div
              key={module.id}
              className={cn(
                'flex items-center justify-between rounded-xl border p-4 transition-colors',
                module.enabled
                  ? 'bg-primary/5 border-primary/20'
                  : 'bg-muted/50 border-border'
              )}
            >
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold capitalize">
                    {module.name}
                  </h3>
                  <Badge variant={module.enabled ? 'default' : 'secondary'}>
                    {module.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {module.description || moduleDescriptions[module.key] || `Manage ${module.name} module`}
                </p>
              </div>
              <button
                onClick={() =>
                  toggleMutation.mutate({
                    id: module.id,
                    enabled: !module.enabled,
                  })
                }
                disabled={toggleMutation.isPending}
                className="flex-shrink-0"
              >
                {module.enabled ? (
                  <ToggleRight className="h-8 w-8 text-primary" />
                ) : (
                  <ToggleLeft className="h-8 w-8 text-muted-foreground" />
                )}
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BranchesTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<BranchFormData>(initialBranchFormData);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then((res) => res.data?.data || res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: BranchFormData) => api.post('/branches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: BranchFormData }) =>
      api.patch(`/branches/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setShowDeleteConfirm(null);
    },
  });

  function openAddForm() {
    setEditingBranch(null);
    setFormData(initialBranchFormData);
    setShowForm(true);
  }

  function openEditForm(branch: Branch) {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phone: branch.phone || '',
      isActive: branch.isActive,
      isWarehouse: branch.isWarehouse,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingBranch(null);
    setFormData(initialBranchFormData);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingBranch) {
      updateMutation.mutate({ id: editingBranch.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Branches</CardTitle>
            <Button onClick={openAddForm} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Branch
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : branches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No branches configured</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">Code</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">Address</th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">Phone</th>
                    <th className="pb-3 text-center font-medium text-muted-foreground">Warehouse</th>
                    <th className="pb-3 text-center font-medium text-muted-foreground">Status</th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((branch) => (
                    <tr key={branch.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{branch.name}</td>
                      <td className="py-3 font-mono text-muted-foreground">{branch.code}</td>
                      <td className="py-3 text-muted-foreground">{branch.address || '-'}</td>
                      <td className="py-3 text-muted-foreground">{branch.phone || '-'}</td>
                      <td className="py-3 text-center">
                        {branch.isWarehouse && (
                          <Badge variant="secondary">Warehouse</Badge>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                            branch.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          )}
                        >
                          {branch.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditForm(branch)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDeleteConfirm(branch)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Branch Modal */}
      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingBranch ? 'Edit Branch' : 'Add Branch'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Branch Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Main Branch"
          />
          <Input
            label="Branch Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            required
            placeholder="BR-001"
            disabled={!!editingBranch}
            className={editingBranch ? 'bg-muted' : ''}
          />
          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="Branch address"
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="Phone number"
          />
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) =>
                  setFormData({ ...formData, isActive: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium">Active</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isWarehouse}
                onChange={(e) =>
                  setFormData({ ...formData, isWarehouse: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium">Warehouse</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingBranch ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Delete Branch"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete branch{' '}
            <strong>{showDeleteConfirm?.name}</strong>? This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(showDeleteConfirm!.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function RolesTab() {
  const [viewingRole, setViewingRole] = useState<Role | null>(null);

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((res) => res.data?.data || res.data),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : roles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No roles configured</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left font-medium text-muted-foreground">
                      Role
                    </th>
                    <th className="pb-3 text-left font-medium text-muted-foreground">
                      Description
                    </th>
                    <th className="pb-3 text-center font-medium text-muted-foreground">
                      Permissions
                    </th>
                    <th className="pb-3 text-right font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-b last:border-0">
                      <td className="py-3 font-medium">{role.name}</td>
                      <td className="py-3 text-muted-foreground">
                        {role.description || '-'}
                      </td>
                      <td className="py-3 text-center">
                        <Badge variant="secondary">
                          {role.permissions?.length || 0} permissions
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingRole(role)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Permissions Modal */}
      <Modal
        isOpen={!!viewingRole}
        onClose={() => setViewingRole(null)}
        title={`Permissions — ${viewingRole?.name || ''}`}
      >
        <div className="space-y-4">
          {viewingRole?.description && (
            <p className="text-sm text-muted-foreground">
              {viewingRole.description}
            </p>
          )}
          <div className="max-h-80 overflow-y-auto rounded-lg border">
            {viewingRole?.permissions && viewingRole.permissions.length > 0 ? (
              <div className="divide-y">
                {viewingRole.permissions.map((permission) => (
                  <div
                    key={permission}
                    className="flex items-center gap-2 px-4 py-2 text-sm"
                  >
                    <Badge variant="outline" className="font-mono text-xs">
                      {permission}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No permissions assigned
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setViewingRole(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
