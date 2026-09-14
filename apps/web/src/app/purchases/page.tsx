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
import { formatCurrency, formatDate, getStatusColor, cn } from '@/lib/utils';
import {
  Plus,
  Eye,
  Search,
  ShoppingCart,
  Loader2,
  CheckCircle,
  Trash2,
  Package,
} from 'lucide-react';

interface PurchaseItem {
  id?: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitCost: number;
  total: number;
}

interface Purchase {
  id: string;
  poNumber: string;
  supplier: {
    id: string;
    name: string;
  };
  items: PurchaseItem[];
  expectedDelivery: string;
  subtotal: number;
  tax: number;
  total: number;
  status: 'DRAFT' | 'PENDING' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  purchaseCost: number;
}

interface Supplier {
  id: string;
  name: string;
}

interface LineItem {
  productId: string;
  quantity: string;
  unitCost: string;
}

const initialLineItem: LineItem = { productId: '', quantity: '1', unitCost: '0' };

export default function PurchasesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [formData, setFormData] = useState({
    supplierId: '',
    expectedDelivery: '',
    tax: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([{ ...initialLineItem }]);

  const { data: purchasesData, isLoading } = useQuery({
    queryKey: ['purchases', search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      params.append('limit', '50');
      return api.get(`/purchases?${params.toString()}`).then((res) => res.data);
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then((res) => res.data?.data || res.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products-list'],
    queryFn: () => api.get('/products?limit=200').then((res) => res.data?.data || res.data),
  });

  const { data: purchaseDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['purchase', selectedPurchase?.id],
    queryFn: () => api.get(`/purchases/${selectedPurchase?.id}`).then((res) => res.data),
    enabled: !!selectedPurchase?.id && showDetails,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/purchases', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setShowForm(false);
      setFormData({ supplierId: '', expectedDelivery: '', tax: '', notes: '' });
      setLineItems([{ ...initialLineItem }]);
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/purchases/${id}/status`, { status: 'RECEIVED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase', selectedPurchase?.id] });
    },
  });

  const purchases: Purchase[] = purchasesData?.data || [];
  const supplierList: Supplier[] = Array.isArray(suppliers) ? suppliers : [];
  const productList: Product[] = Array.isArray(products) ? products : [];

  const calculatedSubtotal = lineItems.reduce((sum, item) => {
    const qty = parseInt(item.quantity) || 0;
    const cost = parseFloat(item.unitCost) || 0;
    return sum + qty * cost;
  }, 0);
  const calculatedTax = parseFloat(formData.tax) || 0;
  const calculatedTotal = calculatedSubtotal + calculatedTax;

  const addLineItem = () => {
    setLineItems([...lineItems, { ...initialLineItem }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'productId') {
      const product = productList.find((p) => p.id === value);
      if (product) {
        updated[index].unitCost = product.purchaseCost.toString();
      }
    }

    setLineItems(updated);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setFormData({ supplierId: '', expectedDelivery: '', tax: '', notes: '' });
    setLineItems([{ ...initialLineItem }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = lineItems.filter((item) => item.productId && parseInt(item.quantity) > 0);
    if (validItems.length === 0) return;

    createMutation.mutate({
      supplierId: formData.supplierId,
      expectedDelivery: formData.expectedDelivery || undefined,
      tax: formData.tax ? parseFloat(formData.tax) : 0,
      notes: formData.notes || undefined,
      items: validItems.map((item) => ({
        productId: item.productId,
        quantity: parseInt(item.quantity),
        unitCost: parseFloat(item.unitCost),
      })),
    });
  };

  const handleViewPurchase = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedPurchase(null);
  };

  const isSubmitting = createMutation.isPending;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Purchases</h1>
              <p className="text-muted-foreground">Manage purchase orders and supplier transactions.</p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Purchase Order
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
                    placeholder="Search by PO number or supplier..."
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
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING">Pending</option>
                  <option value="ORDERED">Ordered</option>
                  <option value="RECEIVED">Received</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Purchases Table */}
          <Card>
            <CardHeader>
              <CardTitle>Purchase Orders ({purchases.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : purchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No purchase orders found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO#</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Expected Delivery</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-mono text-sm">
                          {purchase.poNumber}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{purchase.supplier?.name || 'N/A'}</p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(purchase.createdAt)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {purchase.expectedDelivery ? formatDate(purchase.expectedDelivery) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(purchase.total)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                              getStatusColor(purchase.status)
                            )}
                          >
                            {purchase.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewPurchase(purchase)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {purchase.status === 'PENDING' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => receiveMutation.mutate(purchase.id)}
                                disabled={receiveMutation.isPending}
                                title="Mark as Received"
                              >
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* New Purchase Order Modal */}
          <Modal
            isOpen={showForm}
            onClose={handleCloseForm}
            title="New Purchase Order"
            className="max-w-2xl"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                label="Supplier"
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                required
              >
                <option value="">Select a supplier</option>
                {supplierList.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>

              <Input
                label="Expected Delivery"
                type="date"
                value={formData.expectedDelivery}
                onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })}
              />

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-foreground">Line Items</label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((item, index) => (
                    <div key={index} className="flex items-end gap-2">
                      <div className="flex-1">
                        {index === 0 && (
                          <label className="text-xs text-muted-foreground mb-1 block">Product</label>
                        )}
                        <select
                          value={item.productId}
                          onChange={(e) => updateLineItem(index, 'productId', e.target.value)}
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          required
                        >
                          <option value="">Select product</option>
                          {productList.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20">
                        {index === 0 && (
                          <label className="text-xs text-muted-foreground mb-1 block">Qty</label>
                        )}
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          required
                        />
                      </div>
                      <div className="w-28">
                        {index === 0 && (
                          <label className="text-xs text-muted-foreground mb-1 block">Unit Cost</label>
                        )}
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitCost}
                          onChange={(e) => updateLineItem(index, 'unitCost', e.target.value)}
                          className="h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          required
                        />
                      </div>
                      <div className="w-28">
                        {index === 0 && (
                          <label className="text-xs text-muted-foreground mb-1 block">Total</label>
                        )}
                        <div className="h-10 flex items-center px-3 text-sm font-medium">
                          {formatCurrency(
                            (parseInt(item.quantity) || 0) * (parseFloat(item.unitCost) || 0)
                          )}
                        </div>
                      </div>
                      <div className={index === 0 ? 'pt-5' : ''}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLineItem(index)}
                          disabled={lineItems.length === 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(calculatedSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.tax}
                        onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                        className="h-8 w-24 rounded border border-input bg-background px-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="flex justify-between border-t pt-2 font-medium">
                      <span>Total</span>
                      <span>{formatCurrency(calculatedTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Input
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes..."
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Purchase Order
                </Button>
              </div>
            </form>
          </Modal>

          {/* Purchase Details Modal */}
          <Modal
            isOpen={showDetails}
            onClose={handleCloseDetails}
            title="Purchase Order Details"
            className="max-w-2xl"
          >
            {isLoadingDetails ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : selectedPurchase ? (
              <div className="space-y-6">
                {/* Purchase Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">PO Number</p>
                    <p className="font-medium font-mono">{selectedPurchase.poNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Supplier</p>
                    <p className="font-medium">{selectedPurchase.supplier?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDate(selectedPurchase.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Delivery</p>
                    <p className="font-medium">
                      {selectedPurchase.expectedDelivery
                        ? formatDate(selectedPurchase.expectedDelivery)
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        getStatusColor(selectedPurchase.status)
                      )}
                    >
                      {selectedPurchase.status}
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">Items</h3>
                  <div className="rounded-lg border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-4 py-2 text-left text-sm font-medium text-muted-foreground">
                            Product
                          </th>
                          <th className="px-4 py-2 text-center text-sm font-medium text-muted-foreground">
                            Qty
                          </th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-muted-foreground">
                            Unit Cost
                          </th>
                          <th className="px-4 py-2 text-right text-sm font-medium text-muted-foreground">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(purchaseDetails?.items || selectedPurchase.items)?.map(
                          (item: PurchaseItem, index: number) => (
                            <tr key={item.id || index} className="border-b last:border-0">
                              <td className="px-4 py-3">
                                <p className="font-medium">
                                  {item.productName || `Product ${index + 1}`}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-center">{item.quantity}</td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(item.unitCost)}
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {formatCurrency(item.total)}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(selectedPurchase.subtotal)}</span>
                    </div>
                    {selectedPurchase.tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span>{formatCurrency(selectedPurchase.tax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t pt-2 font-medium">
                      <span>Total</span>
                      <span>{formatCurrency(selectedPurchase.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedPurchase.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{selectedPurchase.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={handleCloseDetails}>
                    Close
                  </Button>
                  {selectedPurchase.status === 'PENDING' && (
                    <Button
                      onClick={() => {
                        receiveMutation.mutate(selectedPurchase.id, {
                          onSuccess: () => {
                            setSelectedPurchase({
                              ...selectedPurchase,
                              status: 'RECEIVED',
                            });
                          },
                        });
                      }}
                      disabled={receiveMutation.isPending}
                    >
                      {receiveMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Received
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </Modal>
        </main>
      </div>
    </div>
  );
}
