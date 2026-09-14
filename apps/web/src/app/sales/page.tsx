'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Badge } from '@/components/ui';
import { Sidebar, Header } from '@/components/layout';
import { formatCurrency, formatDate, getStatusColor, cn } from '@/lib/utils';
import {
  ShoppingCart,
  Eye,
  Search,
  Filter,
  X,
  Loader2,
  Package,
} from 'lucide-react';

interface SaleItem {
  id: string;
  product: {
    id: string;
    name: string;
  };
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Sale {
  id: string;
  saleNumber: string;
  customer: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'COMPLETED' | 'PENDING' | 'REFUNDED' | 'CANCELLED';
  paymentMethod: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export default function SalesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      const queryString = params.toString();
      return api.get(`/sales${queryString ? `?${queryString}` : ''}`).then((res) => res.data);
    },
  });

  const { data: saleDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['sale', selectedSale?.id],
    queryFn: () => api.get(`/sales/${selectedSale?.id}`).then((res) => res.data),
    enabled: !!selectedSale?.id,
  });

  const handleViewSale = (sale: Sale) => {
    setSelectedSale(sale);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSale(null);
  };

  const filteredSales = sales?.data || sales || [];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Sales</h1>
            <p className="text-muted-foreground">Manage your sales transactions</p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by sale number or customer..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus:ring-ring focus-visible:ring-offset-2"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-full md:w-48">
                  <Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="ALL">All Status</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="PENDING">Pending</option>
                    <option value="REFUNDED">Refunded</option>
                    <option value="CANCELLED">Cancelled</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sales Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sales List</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredSales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground">No sales found</h3>
                  <p className="text-sm text-muted-foreground">
                    {search || statusFilter !== 'ALL'
                      ? 'Try adjusting your search or filter criteria'
                      : 'Sales will appear here once you create them'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Sale#
                        </th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Customer
                        </th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Date
                        </th>
                        <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                          Total
                        </th>
                        <th className="pb-3 text-center text-sm font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="pb-3 text-center text-sm font-medium text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map((sale: Sale) => (
                        <tr
                          key={sale.id}
                          className="border-b last:border-0 hover:bg-muted/50"
                        >
                          <td className="py-4">
                            <span className="font-medium">{sale.saleNumber}</span>
                          </td>
                          <td className="py-4">
                            <div>
                              <p className="font-medium">
                                {sale.customer?.name || 'Walk-in Customer'}
                              </p>
                              {sale.customer?.email && (
                                <p className="text-xs text-muted-foreground">
                                  {sale.customer.email}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 text-sm text-muted-foreground">
                            {formatDate(sale.createdAt)}
                          </td>
                          <td className="py-4 text-right font-medium">
                            {formatCurrency(sale.total)}
                          </td>
                          <td className="py-4 text-center">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                getStatusColor(sale.status)
                              )}
                            >
                              {sale.status}
                            </span>
                          </td>
                          <td className="py-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewSale(sale)}
                            >
                              <Eye className="h-4 w-4" />
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

          {/* Sale Details Modal */}
          {showModal && selectedSale && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="fixed inset-0 bg-black/50"
                onClick={handleCloseModal}
              />
              <div className="relative z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border bg-card shadow-lg">
                <div className="sticky top-0 flex items-center justify-between border-b bg-card p-6">
                  <h2 className="text-lg font-semibold">Sale Details</h2>
                  <button
                    onClick={handleCloseModal}
                    className="rounded-lg p-2 hover:bg-accent"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="p-6">
                  {isLoadingDetails ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Sale Info */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm text-muted-foreground">Sale Number</p>
                          <p className="font-medium">{selectedSale.saleNumber}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Date</p>
                          <p className="font-medium">{formatDate(selectedSale.createdAt)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Customer</p>
                          <p className="font-medium">
                            {selectedSale.customer?.name || 'Walk-in Customer'}
                          </p>
                          {selectedSale.customer?.email && (
                            <p className="text-xs text-muted-foreground">
                              {selectedSale.customer.email}
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                              getStatusColor(selectedSale.status)
                            )}
                          >
                            {selectedSale.status}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Payment Method</p>
                          <p className="font-medium">{selectedSale.paymentMethod || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Sale Items */}
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-3">
                          Items
                        </h3>
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
                                  Price
                                </th>
                                <th className="px-4 py-2 text-right text-sm font-medium text-muted-foreground">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {(saleDetails?.items || selectedSale.items)?.map(
                                (item: SaleItem) => (
                                  <tr key={item.id} className="border-b last:border-0">
                                    <td className="px-4 py-3">
                                      <p className="font-medium">{item.product?.name}</p>
                                    </td>
                                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                                    <td className="px-4 py-3 text-right">
                                      {formatCurrency(item.unitPrice)}
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
                            <span>{formatCurrency(selectedSale.subtotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tax</span>
                            <span>{formatCurrency(selectedSale.tax)}</span>
                          </div>
                          {selectedSale.discount > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Discount</span>
                              <span className="text-red-600">
                                -{formatCurrency(selectedSale.discount)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between border-t pt-2 font-medium">
                            <span>Total</span>
                            <span>{formatCurrency(selectedSale.total)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Notes */}
                      {selectedSale.notes && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Notes</p>
                          <p className="text-sm">{selectedSale.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="sticky bottom-0 flex justify-end gap-3 border-t bg-card p-6">
                  <Button variant="outline" onClick={handleCloseModal}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
