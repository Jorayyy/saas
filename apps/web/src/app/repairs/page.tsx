'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Select, Badge } from '@/components/ui';
import { Sidebar, Header } from '@/components/layout';
import { formatDate, getStatusColor, getPriorityColor } from '@/lib/utils';
import { Plus, Wrench, Search, Eye, Edit, Trash2 } from 'lucide-react';

const REPAIR_STATUSES = [
  'RECEIVED',
  'DIAGNOSING',
  'WAITING_FOR_APPROVAL',
  'WAITING_FOR_PARTS',
  'IN_REPAIR',
  'COMPLETED',
  'CANCELLED',
] as const;

const PRIORITY_OPTIONS = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

const REPAIR_STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Received',
  DIAGNOSING: 'Diagnosing',
  WAITING_FOR_APPROVAL: 'Waiting for Approval',
  WAITING_FOR_PARTS: 'Waiting for Parts',
  IN_REPAIR: 'In Repair',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function RepairsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const { data: repairs, isLoading } = useQuery({
    queryKey: ['repairs', search, statusFilter, priorityFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      const queryString = params.toString();
      return api.get(`/repairs${queryString ? `?${queryString}` : ''}`).then((res) => res.data);
    },
  });

  const filteredRepairs = Array.isArray(repairs) ? repairs : repairs?.data || [];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Repairs</h1>
              <p className="text-muted-foreground">Manage repair tickets and track progress.</p>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Repair
            </Button>
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
                      placeholder="Search by ticket number or customer..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </div>
                <div className="w-full md:w-48">
                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All Statuses</option>
                    {REPAIR_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {REPAIR_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-full md:w-48">
                  <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                    <option value="">All Priorities</option>
                    {PRIORITY_OPTIONS.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority.charAt(0) + priority.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Repairs Table */}
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : filteredRepairs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Wrench className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No repairs found</p>
                  <p className="text-sm">Create a new repair ticket to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-3 text-left font-medium text-muted-foreground">Ticket#</th>
                        <th className="pb-3 text-left font-medium text-muted-foreground">Customer</th>
                        <th className="pb-3 text-left font-medium text-muted-foreground">Device</th>
                        <th className="pb-3 text-left font-medium text-muted-foreground">Issue</th>
                        <th className="pb-3 text-left font-medium text-muted-foreground">Status</th>
                        <th className="pb-3 text-left font-medium text-muted-foreground">Priority</th>
                        <th className="pb-3 text-left font-medium text-muted-foreground">Technician</th>
                        <th className="pb-3 text-right font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRepairs.map((repair: any) => (
                        <tr key={repair.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3 font-medium">{repair.ticketNumber}</td>
                          <td className="py-3">{repair.customer?.name || 'N/A'}</td>
                          <td className="py-3">
                            {repair.deviceType} - {repair.deviceBrand}
                          </td>
                          <td className="py-3 max-w-[200px] truncate" title={repair.issueDescription}>
                            {repair.issueDescription}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(repair.status)}`}>
                              {REPAIR_STATUS_LABELS[repair.status] || repair.status}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityColor(repair.priority)}`}>
                              {repair.priority}
                            </span>
                          </td>
                          <td className="py-3">{repair.technician?.name || 'Unassigned'}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button className="rounded-lg p-1.5 hover:bg-accent">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button className="rounded-lg p-1.5 hover:bg-accent">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button className="rounded-lg p-1.5 hover:bg-accent text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </button>
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
        </main>
      </div>
    </div>
  );
}
