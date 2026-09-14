'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge, Select } from '@/components/ui';
import { Sidebar, Header } from '@/components/layout';
import { formatCurrency, formatDate, getStatusColor, cn } from '@/lib/utils';
import {
  Plus,
  Search,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'RENT',
  'UTILITIES',
  'SALARIES',
  'EQUIPMENT',
  'SUPPLIES',
  'MARKETING',
  'TRAVEL',
  'MAINTENANCE',
  'OTHER',
];

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'OTHER',
    description: '',
    amount: '',
  });
  const [formError, setFormError] = useState('');

  const isManager = user?.roles?.includes('MANAGER') || user?.roles?.includes('ADMIN');

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => api.get('/expenses').then((res) => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setShowModal(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        category: 'OTHER',
        description: '',
        amount: '',
      });
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to create expense');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/expenses/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    createMutation.mutate({
      date: formData.date,
      category: formData.category,
      description: formData.description,
      amount: parseFloat(formData.amount),
    });
  };

  const filteredExpenses = expenses?.filter((expense: Expense) => {
    const matchesSearch =
      !search ||
      expense.description.toLowerCase().includes(search.toLowerCase()) ||
      expense.category.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || expense.status === statusFilter;
    const matchesCategory = !categoryFilter || expense.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const totalExpenses = expenses?.reduce((sum: number, e: Expense) => sum + e.amount, 0) || 0;
  const pendingTotal = expenses
    ?.filter((e: Expense) => e.status === 'PENDING')
    .reduce((sum: number, e: Expense) => sum + e.amount, 0) || 0;
  const approvedTotal = expenses
    ?.filter((e: Expense) => e.status === 'APPROVED')
    .reduce((sum: number, e: Expense) => sum + e.amount, 0) || 0;

  const stats = [
    {
      title: 'Total Expenses',
      value: formatCurrency(totalExpenses),
      icon: CreditCard,
    },
    {
      title: 'Pending',
      value: formatCurrency(pendingTotal),
      icon: Clock,
    },
    {
      title: 'Approved',
      value: formatCurrency(approvedTotal),
      icon: CheckCircle,
    },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Expenses</h1>
              <p className="text-muted-foreground">Track and manage business expenses</p>
            </div>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
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
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent>
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search by description or category..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-10 w-full rounded-lg border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </Select>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Expenses Table */}
          <Card>
            <CardHeader>
              <CardTitle>Expense Records</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredExpenses?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">No expenses found</p>
                  <p className="text-sm text-muted-foreground">
                    {search || statusFilter || categoryFilter
                      ? 'Try adjusting your filters'
                      : 'Get started by adding an expense'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Date
                        </th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Category
                        </th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Description
                        </th>
                        <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                          Amount
                        </th>
                        <th className="pb-3 text-center text-sm font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                          Approved By
                        </th>
                        {isManager && (
                          <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses?.map((expense: Expense) => (
                        <tr key={expense.id} className="border-b last:border-0">
                          <td className="py-3 text-sm">{formatDate(expense.date)}</td>
                          <td className="py-3 text-sm">
                            <Badge variant="outline">{expense.category}</Badge>
                          </td>
                          <td className="py-3 text-sm max-w-xs truncate">{expense.description}</td>
                          <td className="py-3 text-sm text-right font-medium">
                            {formatCurrency(expense.amount)}
                          </td>
                          <td className="py-3 text-center">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                                getStatusColor(expense.status)
                              )}
                            >
                              {expense.status}
                            </span>
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">
                            {expense.approvedBy?.name || '-'}
                          </td>
                          {isManager && (
                            <td className="py-3 text-right">
                              {expense.status === 'PENDING' && (
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        id: expense.id,
                                        status: 'APPROVED',
                                      })
                                    }
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateStatusMutation.mutate({
                                        id: expense.id,
                                        status: 'REJECTED',
                                      })
                                    }
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    <XCircle className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Expense Modal */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>Add Expense</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {formError && (
                      <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                        {formError}
                      </div>
                    )}

                    <Input
                      label="Date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />

                    <Select
                      label="Category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </Select>

                    <Input
                      label="Description"
                      placeholder="Enter expense description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    />

                    <Input
                      label="Amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowModal(false);
                          setFormError('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'Creating...' : 'Create Expense'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
