'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge, Select } from '@/components/ui';
import { Sidebar, Header } from '@/components/layout';
import { formatDate, getStatusColor, cn } from '@/lib/utils';
import {
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Calendar,
  Clock,
} from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

interface ScheduleEntry {
  id: string;
  employeeId: string;
  employee?: Employee;
  day: string;
  shift: string;
  startTime: string;
  endTime: string;
}

export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'employees' | 'schedule'>('employees');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then((res) => res.data),
  });

  const { data: schedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => api.get('/schedules').then((res) => res.data),
    enabled: activeTab === 'schedule',
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const filteredEmployees = employees.filter((emp: Employee) =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this employee?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const shifts = ['Morning', 'Afternoon', 'Evening'];

  const getScheduleForDayAndShift = (day: string, shift: string) => {
    return schedules.filter((s: ScheduleEntry) => s.day === day && s.shift === shift);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Header />
        <main className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Employees</h1>
            <p className="text-muted-foreground">Manage your staff and schedules.</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={activeTab === 'employees' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('employees')}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Employees
            </Button>
            <Button
              variant={activeTab === 'schedule' ? 'primary' : 'outline'}
              onClick={() => setActiveTab('schedule')}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Schedule
            </Button>
          </div>

          {activeTab === 'employees' && (
            <>
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
                <Button onClick={() => setShowAddModal(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Employee
                </Button>
              </div>

              {/* Employees Table */}
              <Card>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">Loading employees...</div>
                    </div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Users className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {searchQuery ? 'No employees match your search.' : 'No employees yet.'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                              Name
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                              Email
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                              Phone
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                              Position
                            </th>
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                              Status
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredEmployees.map((employee: Employee) => (
                            <tr key={employee.id} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-4 w-4" />
                              </div>
                              <span className="text-sm font-medium">{employee.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {employee.email}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {employee.phone || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {employee.position}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(employee.status)}`}>
                              {employee.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(employee)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(employee.id)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
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
            </>
          )}

          {activeTab === 'schedule' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Weekly Schedule</h2>
                <Button onClick={() => setShowScheduleModal(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Schedule
                </Button>
              </div>

              <Card>
                <CardContent>
                  {isLoadingSchedules ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-muted-foreground">Loading schedules...</div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground min-w-[100px]">
                              Shift
                            </th>
                            {days.map((day) => (
                              <th key={day} className="text-left py-3 px-4 text-sm font-medium text-muted-foreground min-w-[150px]">
                                {day}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {shifts.map((shift) => (
                            <tr key={shift} className="border-b last:border-0">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">{shift}</span>
                                </div>
                              </td>
                              {days.map((day) => {
                                const daySchedule = getScheduleForDayAndShift(day, shift);
                                return (
                                  <td key={day} className="py-3 px-4">
                                    {daySchedule.length === 0 ? (
                                      <span className="text-sm text-muted-foreground">-</span>
                                    ) : (
                                      <div className="space-y-1">
                                        {daySchedule.map((entry: ScheduleEntry) => (
                                          <div
                                            key={entry.id}
                                            className="text-sm bg-primary/10 rounded px-2 py-1"
                                          >
                                            {entry.employee?.name || 'Unknown'}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <EmployeeModal
          onClose={() => setShowAddModal(false)}
          title="Add Employee"
        />
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <EmployeeModal
          onClose={() => {
            setShowEditModal(false);
            setSelectedEmployee(null);
          }}
          title="Edit Employee"
          employee={selectedEmployee}
        />
      )}

      {/* Add Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          employees={employees}
        />
      )}
    </div>
  );
}

function EmployeeModal({
  onClose,
  title,
  employee,
}: {
  onClose: () => void;
  title: string;
  employee?: Employee;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: employee?.name || '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    position: employee?.position || '',
    status: employee?.status || 'ACTIVE',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => {
      if (employee) {
        return api.patch(`/employees/${employee.id}`, data);
      }
      return api.post('/employees', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Something went wrong');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
          <Input
            label="Position"
            value={formData.position}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
            required
          />
          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : employee ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleModal({
  onClose,
  employees,
}: {
  onClose: () => void;
  employees: Employee[];
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    employeeId: '',
    day: 'Monday',
    shift: 'Morning',
    startTime: '09:00',
    endTime: '17:00',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/schedules', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Something went wrong');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl border shadow-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Add Schedule</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <Select
            label="Employee"
            value={formData.employeeId}
            onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
            required
          >
            <option value="">Select an employee</option>
            {employees.map((emp: Employee) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </Select>
          <Select
            label="Day"
            value={formData.day}
            onChange={(e) => setFormData({ ...formData, day: e.target.value })}
          >
            <option value="Monday">Monday</option>
            <option value="Tuesday">Tuesday</option>
            <option value="Wednesday">Wednesday</option>
            <option value="Thursday">Thursday</option>
            <option value="Friday">Friday</option>
            <option value="Saturday">Saturday</option>
            <option value="Sunday">Sunday</option>
          </Select>
          <Select
            label="Shift"
            value={formData.shift}
            onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
          >
            <option value="Morning">Morning</option>
            <option value="Afternoon">Afternoon</option>
            <option value="Evening">Evening</option>
          </Select>
          <Input
            label="Start Time"
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
          />
          <Input
            label="End Time"
            type="time"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
