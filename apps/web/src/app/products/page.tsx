'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Select,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from '@/components/ui';
import { Modal } from '@/components/modal';
import { Sidebar, Header } from '@/components/layout';
import { formatCurrency, getStatusColor } from '@/lib/utils';
import { Plus, Pencil, Trash2, Search, Loader2, Package } from 'lucide-react';

interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  purchaseCost: number;
  sellingPrice: number;
  currentStock: number;
  minimumStock: number;
  status: string;
  unit: string;
  category?: { id: string; name: string };
  brand?: { id: string; name: string };
  createdAt: string;
}

interface ProductFormData {
  sku: string;
  barcode: string;
  name: string;
  description: string;
  categoryId: string;
  purchaseCost: string;
  sellingPrice: string;
  wholesalePrice: string;
  taxRate: string;
  minimumStock: string;
  currentStock: string;
  unit: string;
}

const initialFormData: ProductFormData = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  categoryId: '',
  purchaseCost: '',
  sellingPrice: '',
  wholesalePrice: '',
  taxRate: '',
  minimumStock: '',
  currentStock: '',
  unit: 'PIECE',
};

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(initialFormData);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      params.append('limit', '50');
      return api.get(`/products?${params.toString()}`).then((res) => res.data);
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((res) => res.data?.data || res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: ProductFormData) =>
      api.post('/products', {
        sku: data.sku,
        barcode: data.barcode || undefined,
        name: data.name,
        description: data.description || undefined,
        categoryId: data.categoryId || undefined,
        purchaseCost: parseFloat(data.purchaseCost),
        sellingPrice: parseFloat(data.sellingPrice),
        wholesalePrice: data.wholesalePrice ? parseFloat(data.wholesalePrice) : undefined,
        taxRate: data.taxRate ? parseFloat(data.taxRate) : undefined,
        minimumStock: data.minimumStock ? parseInt(data.minimumStock) : undefined,
        currentStock: data.currentStock ? parseInt(data.currentStock) : undefined,
        unit: data.unit,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false);
      setFormData(initialFormData);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductFormData }) =>
      api.put(`/products/${id}`, {
        sku: data.sku,
        barcode: data.barcode || undefined,
        name: data.name,
        description: data.description || undefined,
        categoryId: data.categoryId || undefined,
        purchaseCost: parseFloat(data.purchaseCost),
        sellingPrice: parseFloat(data.sellingPrice),
        wholesalePrice: data.wholesalePrice ? parseFloat(data.wholesalePrice) : undefined,
        taxRate: data.taxRate ? parseFloat(data.taxRate) : undefined,
        minimumStock: data.minimumStock ? parseInt(data.minimumStock) : undefined,
        currentStock: data.currentStock ? parseInt(data.currentStock) : undefined,
        unit: data.unit,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false);
      setEditingProduct(null);
      setFormData(initialFormData);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowDeleteConfirm(null);
    },
  });

  const products: Product[] = productsData?.data || [];
  const categoryList: { id: string; name: string }[] = Array.isArray(categories) ? categories : [];

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      barcode: product.barcode || '',
      name: product.name,
      description: product.description || '',
      categoryId: product.category?.id || '',
      purchaseCost: product.purchaseCost.toString(),
      sellingPrice: product.sellingPrice.toString(),
      wholesalePrice: '',
      taxRate: '',
      minimumStock: product.minimumStock.toString(),
      currentStock: product.currentStock.toString(),
      unit: product.unit,
    });
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Products</h1>
              <p className="text-muted-foreground">Manage your product inventory.</p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    placeholder="Search products..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Products ({products.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No products found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono text-sm">
                          {product.sku}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.brand && (
                              <p className="text-xs text-muted-foreground">{product.brand.name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {product.category?.name || '-'}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(product.sellingPrice)}
                        </TableCell>
                        <TableCell>
                          <span className={product.currentStock <= product.minimumStock ? 'text-red-600 font-medium' : ''}>
                            {product.currentStock}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(product.status)}`}>
                            {product.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowDeleteConfirm(product)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Add/Edit Modal */}
          <Modal
            isOpen={showForm}
            onClose={handleCloseForm}
            title={editingProduct ? 'Edit Product' : 'Add Product'}
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="SKU"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  required
                />
                <Input
                  label="Barcode"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
              <Input
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <Select
                label="Category"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">No Category</option>
                {categoryList.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Purchase Cost"
                  type="number"
                  step="0.01"
                  value={formData.purchaseCost}
                  onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                  required
                />
                <Input
                  label="Selling Price"
                  type="number"
                  step="0.01"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Wholesale Price"
                  type="number"
                  step="0.01"
                  value={formData.wholesalePrice}
                  onChange={(e) => setFormData({ ...formData, wholesalePrice: e.target.value })}
                />
                <Input
                  label="Tax Rate (%)"
                  type="number"
                  step="0.01"
                  value={formData.taxRate}
                  onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Min Stock"
                  type="number"
                  value={formData.minimumStock}
                  onChange={(e) => setFormData({ ...formData, minimumStock: e.target.value })}
                />
                <Input
                  label="Current Stock"
                  type="number"
                  value={formData.currentStock}
                  onChange={(e) => setFormData({ ...formData, currentStock: e.target.value })}
                />
                <Select
                  label="Unit"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                >
                  <option value="PIECE">Piece</option>
                  <option value="KG">Kilogram</option>
                  <option value="GRAM">Gram</option>
                  <option value="LITER">Liter</option>
                  <option value="METER">Meter</option>
                  <option value="BOX">Box</option>
                  <option value="PACK">Pack</option>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingProduct ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal
            isOpen={!!showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(null)}
            title="Delete Product"
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete <strong>{showDeleteConfirm?.name}</strong>? This action cannot be undone.
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
                  {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete
                </Button>
              </div>
            </div>
          </Modal>
        </main>
      </div>
    </div>
  );
}
