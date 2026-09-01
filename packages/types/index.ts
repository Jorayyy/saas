// Shared types for TechShop SaaS

// ─── API Types ──────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: boolean;
  error: {
    code: string;
    message: string;
    details?: any;
    incident_id?: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Auth Types ─────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  tenantName: string;
  tenantSlug: string;
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface User {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  roles: string[];
}

// ─── Tenant Types ───────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  settings?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ─── Product Types ──────────────────────────────────────

export interface Product {
  id: string;
  tenantId: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: Category;
  brandId?: string;
  brand?: Brand;
  supplierId?: string;
  purchaseCost: number;
  sellingPrice: number;
  wholesalePrice?: number;
  taxRate: number;
  warrantyMonths: number;
  minimumStock: number;
  currentStock: number;
  unit: 'PIECE' | 'KG' | 'METER' | 'LITER' | 'SET';
  status: 'ACTIVE' | 'DISCONTINUED';
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

export interface Brand {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  isActive: boolean;
}

// ─── Customer Types ─────────────────────────────────────

export interface Customer {
  id: string;
  tenantId: string;
  customerCode: string;
  name: string;
  email?: string;
  phone?: string;
  address?: Record<string, any>;
  creditBalance: number;
  totalPurchases: number;
  totalRepairs: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface CustomerDevice {
  id: string;
  customerId: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  serialNumber?: string;
  imei?: string;
}

// ─── Sale Types ─────────────────────────────────────────

export interface Sale {
  id: string;
  tenantId: string;
  branchId: string;
  saleNumber: string;
  customerId?: string;
  customer?: Customer;
  userId: string;
  user?: User;
  subtotal: number;
  discountAmount: number;
  discountType?: 'FIXED' | 'PERCENTAGE';
  taxAmount: number;
  total: number;
  amountPaid: number;
  changeAmount: number;
  status: 'COMPLETED' | 'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  items: SaleItem[];
  payments: SalePayment[];
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface SalePayment {
  id: string;
  saleId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  reference?: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'E_WALLET' | 'CREDIT' | 'STORE_CREDIT';

// ─── Repair Types ───────────────────────────────────────

export interface RepairTicket {
  id: string;
  tenantId: string;
  branchId: string;
  ticketNumber: string;
  customerId: string;
  customer?: Customer;
  deviceId?: string;
  device?: CustomerDevice;
  deviceType: DeviceType;
  deviceBrand: string;
  deviceModel: string;
  deviceSerial?: string;
  deviceImei?: string;
  customerComplaint: string;
  diagnosticFindings?: string;
  technicianId?: string;
  technician?: User;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: RepairStatus;
  estimatedCost?: number;
  actualCost?: number;
  laborCost: number;
  partsCost: number;
  totalCost?: number;
  warrantyUntil?: string;
  receivedAt: string;
  diagnosedAt?: string;
  startedAt?: string;
  completedAt?: string;
  pickedUpAt?: string;
  createdAt: string;
}

export type RepairStatus =
  | 'RECEIVED'
  | 'DIAGNOSING'
  | 'WAITING_FOR_APPROVAL'
  | 'WAITING_FOR_PARTS'
  | 'IN_REPAIR'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'WARRANTY_RETURN';

export type DeviceType =
  | 'LAPTOP'
  | 'DESKTOP'
  | 'PHONE'
  | 'TABLET'
  | 'PRINTER'
  | 'NETWORK'
  | 'GAMING_CONSOLE'
  | 'OTHER';

// ─── Employee Types ─────────────────────────────────────

export interface Employee {
  id: string;
  tenantId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  position: Position;
  branchId: string;
  hireDate: string;
  salary?: number;
  commissionRate: number;
  phone?: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
}

export type Position =
  | 'OWNER'
  | 'MANAGER'
  | 'CASHIER'
  | 'TECHNICIAN'
  | 'INVENTORY_CLERK'
  | 'ACCOUNTANT'
  | 'STAFF';

// ─── Dashboard Types ────────────────────────────────────

export interface DashboardSummary {
  todaySales: number;
  todayRevenue: number;
  weekSales: number;
  weekRevenue: number;
  monthSales: number;
  monthRevenue: number;
  activeRepairs: number;
  completedRepairs: number;
  overdueRepairs: number;
  lowStockProducts: number;
  newCustomers: number;
}
