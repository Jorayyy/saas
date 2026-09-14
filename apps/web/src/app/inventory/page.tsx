'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Select } from '@/components/ui';
import { Sidebar, Header } from '@/components/layout';
import { formatDate, getStatusColor, cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRightLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Package,
} from 'lucide-react';

type Tab = 'adjustments' | 'transfers';

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('adjustments');
  const [adjustmentTypeFilter, setAdjustmentTypeFilter] = useState<string>('all');

  const { data: lowStockProducts, isLoading: lowStockLoading } = useQuery({
    queryKey: ['inventory-low-stock'],
    queryFn: () => api.get('/inventory/low-stock').then((res) => res.data),
  });

  const { data: adjustments, isLoading: adjustmentsLoading } = useQuery({
    queryKey: ['inventory-adjustments'],
    queryFn: () => api.get('/inventory/adjustments').then((res) => res.data),
  });

  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ['inventory-transfers'],
    queryFn: () => api.get('/inventory/transfers').then((res) => res.data),
  });

  const filteredAdjustments = adjustments?.filter((adj: any) => {
    if (adjustmentTypeFilter === 'all') return true;
    return adj.type === adjustmentTypeFilter;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'IN':
        return <ArrowDownCircle className="h-4 w-4 text-green-600" />;
      case 'OUT':
        return <ArrowUpCircle className="h-4 w-4 text-red-600" />;
      case 'ADJUSTMENT':
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      IN: 'default',
      OUT: 'destructive',
      ADJUSTMENT: 'secondary',
    };
    return <Badge variant={variants[type] || 'outline'}>{type}</Badge>;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Inventory Management</h1>
            <p className="text-muted-foreground">Track stock adjustments and transfers across branches.</p>
          </div>

          {/* Low Stock Alerts */}
          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <CardTitle className="text-lg">Low Stock Alerts</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {lowStockLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-10 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : lowStockProducts?.length > 0 ? (
                <div className="space-y-3">
                  {lowStockProducts.slice(0, 5).map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.product?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {item.product?.sku} • Branch: {item.branch?.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-red-600">
                          {item.quantity} remaining
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Min: {item.minStock}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-4">
                  All stock levels are healthy
                </p>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b">
            <button
              onClick={() => setActiveTab('adjustments')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'adjustments'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Stock Adjustments
            </button>
            <button
              onClick={() => setActiveTab('transfers')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'transfers'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Stock Transfers
            </button>
          </div>

          {/* Stock Adjustments Tab */}
          {activeTab === 'adjustments' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Stock Adjustments</CardTitle>
                <div className="flex items-center gap-3">
                  <Select
                    value={adjustmentTypeFilter}
                    onChange={(e) => setAdjustmentTypeFilter(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="IN">Stock In</option>
                    <option value="OUT">Stock Out</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                  </Select>
                  <Button size="sm">New Adjustment</Button>
                </div>
              </CardHeader>
              <CardContent>
                {adjustmentsLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : filteredAdjustments?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Product</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Quantity</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Reference</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAdjustments.map((adjustment: any) => (
                          <tr key={adjustment.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-3 px-4">{formatDate(adjustment.createdAt)}</td>
                            <td className="py-3 px-4 font-medium">{adjustment.product?.name}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {getTypeIcon(adjustment.type)}
                                {getTypeBadge(adjustment.type)}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={cn(
                                'font-medium',
                                adjustment.type === 'IN' && 'text-green-600',
                                adjustment.type === 'OUT' && 'text-red-600'
                              )}>
                                {adjustment.type === 'OUT' ? '-' : '+'}{adjustment.quantity}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">{adjustment.reference || '-'}</td>
                            <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate">{adjustment.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No stock adjustments found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Stock Transfers Tab */}
          {activeTab === 'transfers' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Stock Transfers</CardTitle>
                <Button size="sm">New Transfer</Button>
              </CardHeader>
              <CardContent>
                {transfersLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : transfers?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">From Branch</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">To Branch</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Items</th>
                          <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transfers.map((transfer: any) => (
                          <tr key={transfer.id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="py-3 px-4">{formatDate(transfer.createdAt)}</td>
                            <td className="py-3 px-4">{transfer.fromBranch?.name}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                                {transfer.toBranch?.name}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(transfer.status)}`}>
                                {transfer.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-muted-foreground">
                                {transfer.items?.length || 0} item(s)
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <Button variant="ghost" size="sm">View</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ArrowRightLeft className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No stock transfers found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
