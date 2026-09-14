'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select } from '@/components/ui';
import { Sidebar, Header } from '@/components/layout';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  BarChart3,
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  Wrench,
  Download,
  Calendar,
  Building2,
  FileText,
} from 'lucide-react';

const reportTypes = [
  { id: 'sales', name: 'Sales Report', description: 'Revenue, transactions, and sales performance', icon: ShoppingCart },
  { id: 'inventory', name: 'Inventory Report', description: 'Stock levels, product movement, and valuation', icon: Package },
  { id: 'customers', name: 'Customer Report', description: 'Customer activity, demographics, and retention', icon: Users },
  { id: 'financial', name: 'Financial Report', description: 'Expenses, profits, and financial summaries', icon: DollarSign },
  { id: 'repairs', name: 'Repair Report', description: 'Repair jobs, turnaround times, and technician performance', icon: Wrench },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branchId, setBranchId] = useState('');
  const [generated, setGenerated] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then((res) => res.data),
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['reports', selectedReport, dateFrom, dateTo, branchId],
    queryFn: () => {
      const params: Record<string, string> = { type: selectedReport };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (branchId) params.branchId = branchId;
      return api.get('/reports', { params }).then((res) => res.data);
    },
    enabled: generated,
  });

  const handleGenerate = () => {
    setGenerated(true);
  };

  const summaryStats = [
    {
      sales: { title: 'Total Revenue', value: reportData?.totalRevenue ? formatCurrency(reportData.totalRevenue) : '$0', icon: DollarSign },
      inventory: { title: 'Total Products', value: reportData?.totalProducts || 0, icon: Package },
      customers: { title: 'Total Customers', value: reportData?.totalCustomers || 0, icon: Users },
      financial: { title: 'Net Profit', value: reportData?.netProfit ? formatCurrency(reportData.netProfit) : '$0', icon: DollarSign },
      repairs: { title: 'Open Repairs', value: reportData?.openRepairs || 0, icon: Wrench },
    },
    {
      sales: { title: 'Total Orders', value: reportData?.totalOrders || 0, icon: ShoppingCart },
      inventory: { title: 'Low Stock Items', value: reportData?.lowStockItems || 0, icon: Package },
      customers: { title: 'New Customers', value: reportData?.newCustomers || 0, icon: Users },
      financial: { title: 'Total Expenses', value: reportData?.totalExpenses ? formatCurrency(reportData.totalExpenses) : '$0', icon: DollarSign },
      repairs: { title: 'Completed Repairs', value: reportData?.completedRepairs || 0, icon: Wrench },
    },
    {
      sales: { title: 'Average Order', value: reportData?.averageOrder ? formatCurrency(reportData.averageOrder) : '$0', icon: BarChart3 },
      inventory: { title: 'Inventory Value', value: reportData?.inventoryValue ? formatCurrency(reportData.inventoryValue) : '$0', icon: Package },
      customers: { title: 'Top Customer', value: reportData?.topCustomer || 'N/A', icon: Users },
      financial: { title: 'Gross Margin', value: reportData?.grossMargin ? `${reportData.grossMargin}%` : '0%', icon: DollarSign },
      repairs: { title: 'Avg Turnaround', value: reportData?.avgTurnaround || '0 days', icon: Wrench },
    },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Reports</h1>
            <p className="text-muted-foreground">Generate and analyze business reports.</p>
          </div>

          {/* Report Type Selector */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
            {reportTypes.map((report) => (
              <Card
                key={report.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedReport === report.id ? 'border-primary ring-2 ring-primary/20' : ''
                }`}
                onClick={() => setSelectedReport(report.id)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <report.icon className="h-5 w-5 text-muted-foreground" />
                  {selectedReport === report.id && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </CardHeader>
                <CardContent>
                  <h3 className="text-sm font-semibold">{report.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{report.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Report Parameters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 items-end">
                <Input
                  label="From Date"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <Input
                  label="To Date"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
                <Select
                  label="Branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  <option value="">All Branches</option>
                  {branches?.map((branch: any) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
                <Button onClick={handleGenerate} disabled={isLoading}>
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Generating...
                    </div>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          {generated && (
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              {summaryStats.map((statGroup, index) => {
                const stat = statGroup[selectedReport as keyof typeof statGroup];
                return (
                  <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </CardTitle>
                      <stat.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Report Results */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Report Results</CardTitle>
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </Button>
            </CardHeader>
            <CardContent>
              {!generated ? (
                <div className="h-64 flex flex-col items-center justify-center border rounded-lg">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select a report type and click Generate Report to view results</p>
                </div>
              ) : isLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-muted-foreground">Generating report...</p>
                  </div>
                </div>
              ) : reportData ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground border-b pb-4">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      <span className="font-medium capitalize">{selectedReport} Report</span>
                    </div>
                    {dateFrom && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>From: {formatDate(dateFrom)}</span>
                      </div>
                    )}
                    {dateTo && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>To: {formatDate(dateTo)}</span>
                      </div>
                    )}
                    {branchId && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>Branch: {branches?.find((b: any) => b.id === branchId)?.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="h-64 flex items-center justify-center border rounded-lg">
                    <p className="text-muted-foreground">
                      {selectedReport} report data will be rendered here
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center border rounded-lg">
                  <p className="text-muted-foreground">No data available for the selected filters</p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
