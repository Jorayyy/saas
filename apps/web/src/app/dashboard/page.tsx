'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { Sidebar, Header } from '@/components/layout';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import {
  DollarSign,
  ShoppingCart,
  Users,
  Wrench,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get('/dashboard/summary').then((res) => res.data),
  });

  const { data: salesChart } = useQuery({
    queryKey: ['dashboard-sales-chart'],
    queryFn: () => api.get('/dashboard/sales-chart').then((res) => res.data),
  });

  const { data: topProducts } = useQuery({
    queryKey: ['dashboard-top-products'],
    queryFn: () => api.get('/dashboard/top-products').then((res) => res.data),
  });

  const { data: recentSales } = useQuery({
    queryKey: ['dashboard-recent-sales'],
    queryFn: () => api.get('/dashboard/recent-sales').then((res) => res.data),
  });

  const stats = [
    {
      title: 'Today\'s Sales',
      value: summary?.todaySales ? formatCurrency(summary.todaySales) : '$0',
      icon: DollarSign,
      change: '+12%',
      changeType: 'positive',
    },
    {
      title: 'Transactions',
      value: summary?.todayTransactions || 0,
      icon: ShoppingCart,
      change: '+8%',
      changeType: 'positive',
    },
    {
      title: 'Active Customers',
      value: summary?.activeCustomers || 0,
      icon: Users,
      change: '+5%',
      changeType: 'positive',
    },
    {
      title: 'Open Repairs',
      value: summary?.openRepairs || 0,
      icon: Wrench,
      change: '-2%',
      changeType: 'negative',
    },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            {stats.map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className={`text-xs ${stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.change} from yesterday
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Sales Chart Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border rounded-lg">
                  <p className="text-muted-foreground">Sales chart will be rendered here</p>
                </div>
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle>Top Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topProducts?.slice(0, 5).map((item: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground">
                          #{index + 1}
                        </span>
                        <span className="text-sm">{item.product?.name}</span>
                      </div>
                      <span className="text-sm font-medium">
                        {formatCurrency(item.revenue)}
                      </span>
                    </div>
                  ))}
                  {(!topProducts || topProducts.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">No data yet</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Sales */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentSales?.slice(0, 5).map((sale: any) => (
                    <div key={sale.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <ShoppingCart className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{sale.saleNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {sale.customer?.name || 'Walk-in'} • {formatDate(sale.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatCurrency(sale.total)}</p>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(sale.status)}`}>
                          {sale.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!recentSales || recentSales.length === 0) && (
                    <p className="text-center text-muted-foreground py-4">No sales yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
