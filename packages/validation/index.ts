import { z } from 'zod';

// ─── Auth Schemas ───────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  tenantName: z.string().min(2, 'Tenant name must be at least 2 characters'),
  tenantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// ─── Product Schemas ────────────────────────────────────

export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  barcode: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  purchaseCost: z.number().min(0, 'Purchase cost must be positive'),
  sellingPrice: z.number().min(0, 'Selling price must be positive'),
  wholesalePrice: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).default(0),
  warrantyMonths: z.number().min(0).default(0),
  minimumStock: z.number().min(0).default(0),
  currentStock: z.number().min(0).default(0),
  unit: z.enum(['PIECE', 'KG', 'METER', 'LITER', 'SET']).default('PIECE'),
  isSerialized: z.boolean().default(false),
  notes: z.string().optional(),
});

// ─── Sale Schemas ───────────────────────────────────────

export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
});

export const salePaymentSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'E_WALLET', 'CREDIT', 'STORE_CREDIT']),
  amount: z.number().min(0),
  reference: z.string().optional(),
});

export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  items: z.array(saleItemSchema).min(1, 'At least one item is required'),
  payments: z.array(salePaymentSchema).min(1, 'At least one payment is required'),
  discountAmount: z.number().min(0).optional(),
  discountType: z.enum(['FIXED', 'PERCENTAGE']).optional(),
  notes: z.string().optional(),
});

// ─── Repair Schemas ─────────────────────────────────────

export const createRepairSchema = z.object({
  customerId: z.string().uuid(),
  deviceId: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  deviceType: z.enum(['LAPTOP', 'DESKTOP', 'PHONE', 'TABLET', 'PRINTER', 'NETWORK', 'GAMING_CONSOLE', 'OTHER']),
  deviceBrand: z.string().min(1),
  deviceModel: z.string().min(1),
  deviceSerial: z.string().optional(),
  deviceImei: z.string().optional(),
  accessoriesReceived: z.string().optional(),
  physicalCondition: z.string().optional(),
  customerComplaint: z.string().min(1),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  estimatedCost: z.number().min(0).optional(),
  estimatedCompletion: z.string().optional(),
  internalNotes: z.string().optional(),
});

// ─── Customer Schemas ───────────────────────────────────

export const createCustomerSchema = z.object({
  customerCode: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.record(z.any()).optional(),
  taxId: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Supplier Schemas ───────────────────────────────────

export const createSupplierSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  address: z.record(z.any()).optional(),
  taxId: z.string().optional(),
  paymentTerms: z.number().min(0).default(0),
  notes: z.string().optional(),
});

// ─── Expense Schemas ────────────────────────────────────

export const createExpenseSchema = z.object({
  branchId: z.string().uuid(),
  category: z.enum(['RENT', 'UTILITIES', 'SALARY', 'SUPPLIES', 'MAINTENANCE', 'MARKETING', 'TRANSPORT', 'OTHER']),
  description: z.string().min(1),
  amount: z.number().min(0.01),
  expenseDate: z.string(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER']),
  reference: z.string().optional(),
});

// ─── Employee Schemas ───────────────────────────────────

export const createEmployeeSchema = z.object({
  userId: z.string().uuid().optional(),
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  position: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'TECHNICIAN', 'INVENTORY_CLERK', 'ACCOUNTANT', 'STAFF']),
  branchId: z.string().uuid(),
  hireDate: z.string(),
  salary: z.number().min(0).optional(),
  commissionRate: z.number().min(0).max(100).default(0),
  phone: z.string().optional(),
});

// ─── Types from Schemas ─────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreateRepairInput = z.infer<typeof createRepairSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
