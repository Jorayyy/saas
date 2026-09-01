# TechShop SaaS Platform — Database Architecture

## Design Principles

1. **Normalized** — 3NF minimum, no redundant data
2. **Tenant-isolated** — every tenant-owned table has `tenantId` FK
3. **Auditable** — every financial/inventory change is tracked
4. **Consistent** — foreign keys, unique constraints, check constraints
5. **Migratable** — all schema changes via Prisma migrations
6. **Recoverable** — soft deletes on important entities

## Database Engine

**PostgreSQL 15+** — ACID, JSONB for flexible settings, full-text search.

## Prisma Schema Overview

### Core Models

```prisma
// ─── TENANTS ────────────────────────────────────────────
model Tenant {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  plan      Plan     @default(FREE)
  settings  Json?
  status    TenantStatus @default(ACTIVE)
  
  users           User[]
  branches        Branch[]
  products        Product[]
  categories      Category[]
  brands          Brand[]
  customers       Customer[]
  suppliers       Supplier[]
  sales           Sale[]
  repairs         RepairTicket[]
  employees       Employee[]
  expenses        Expense[]
  roles           Role[]
  notifications   Notification[]
  auditLogs       AuditLog[]
  errorEvents     ErrorEvent[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
}

enum Plan { FREE STARTER PROFESSIONAL ENTERPRISE }
enum TenantStatus { ACTIVE SUSPENDED CANCELLED }

// ─── USERS & AUTH ───────────────────────────────────────
model User {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  name      String
  email     String
  password  String
  avatar    String?
  phone     String?
  status    UserStatus @default(ACTIVE)
  
  lastLoginAt      DateTime?
  lastLoginIp      String?
  failedAttempts   Int       @default(0)
  lockedUntil      DateTime?
  twoFactorSecret  String?
  twoFactorEnabled Boolean  @default(false)
  
  roles           UserRole[]
  sales           Sale[]
  repairsAssigned RepairTicket[] @relation("TechnicianRepairs")
  repairsCreated  RepairTicket[] @relation("CreatorRepairs")
  employees       Employee[]
  auditLogs       AuditLog[]
  notifications   Notification[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  
  @@unique([tenantId, email])
  @@index([tenantId])
}

enum UserStatus { ACTIVE INACTIVE LOCKED }

model Role {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  name        String
  displayName String
  description String?
  isSystem    Boolean @default(false)
  
  permissions RolePermission[]
  users       UserRole[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([tenantId, name])
  @@index([tenantId])
}

model Permission {
  id          String   @id @default(uuid())
  name        String   @unique // e.g. "products.create"
  group       String   // e.g. "products"
  description String?
  
  roles RolePermission[]
}

model RolePermission {
  roleId       String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permissionId String
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@id([roleId, permissionId])
}

model UserRole {
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  roleId String
  role   Role   @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  @@id([userId, roleId])
}

// ─── PRODUCTS & INVENTORY ───────────────────────────────
model Product {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  sku           String
  barcode       String?
  name          String
  description   String?
  categoryId    String?
  category      Category? @relation(fields: [categoryId], references: [id])
  brandId       String?
  brand         Brand?    @relation(fields: [brandId], references: [id])
  supplierId    String?
  supplier      Supplier? @relation(fields: [supplierId], references: [id])
  
  purchaseCost  Decimal  @db.Decimal(12, 2)
  sellingPrice  Decimal  @db.Decimal(12, 2)
  wholesalePrice Decimal? @db.Decimal(12, 2)
  taxRate       Decimal  @default(0) @db.Decimal(5, 2)
  warrantyMonths Int      @default(0)
  
  minimumStock  Int      @default(0)
  currentStock  Int      @default(0)
  unit          Unit     @default(PIECE)
  status        ProductStatus @default(ACTIVE)
  
  isSerialized  Boolean  @default(false)
  weight        Decimal? @db.Decimal(8, 3)
  dimensions    Json?
  images        String[]
  notes         String?
  
  inventoryMovements InventoryMovement[]
  saleItems          SaleItem[]
  repairParts        RepairPart[]
  purchaseItems      PurchaseOrderItem[]
  stockAdjustments   StockAdjustment[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  
  @@unique([tenantId, sku])
  @@index([tenantId])
  @@index([tenantId, barcode])
  @@index([tenantId, categoryId])
}

enum Unit { PIECE KG METER LITER SET }
enum ProductStatus { ACTIVE DISCONTINUED }

model Category {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  parentId  String?
  parent    Category? @relation("SubCategories", fields: [parentId], references: [id])
  children  Category[] @relation("SubCategories")
  
  name      String
  slug      String
  description String?
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  
  products Product[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([tenantId, slug])
  @@index([tenantId])
}

model Brand {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  name    String
  slug    String
  logo    String?
  isActive Boolean @default(true)
  
  products Product[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([tenantId, slug])
  @@index([tenantId])
}

model InventoryMovement {
  id              String   @id @default(uuid())
  tenantId        String
  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  productId       String
  product         Product  @relation(fields: [productId], references: [id])
  branchId        String
  branch          Branch   @relation(fields: [branchId], references: [id])
  
  quantityBefore  Int
  quantityChange  Int     // positive or negative
  quantityAfter   Int
  transactionType TransactionType
  unitCost        Decimal? @db.Decimal(12, 2)
  
  referenceType   String? // polymorphic: Sale, PurchaseOrder, etc.
  referenceId     String?
  
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  notes           String?
  
  createdAt DateTime @default(now())
  
  @@index([tenantId, productId, createdAt(sort: Desc)])
  @@index([tenantId, branchId, createdAt(sort: Desc)])
}

enum TransactionType {
  PURCHASE SALE RETURN ADJUSTMENT TRANSFER_IN TRANSFER_OUT
  DAMAGED LOST REPAIR_USE MANUAL_CORRECTION
}

model StockAdjustment {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  branchId  String
  branch    Branch   @relation(fields: [branchId], references: [id])
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  
  adjustmentType AdjustmentType
  quantity       Int
  reason         String
  
  userId      String
  user        User    @relation(fields: [userId], references: [id])
  approvedBy  String?
  approvedAt  DateTime?
  
  createdAt DateTime @default(now())
  
  @@index([tenantId, productId])
}

enum AdjustmentType { INCREASE DECREASE SET }

model StockTransfer {
  id           String   @id @default(uuid())
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  fromBranchId String
  fromBranch   Branch   @relation("FromBranch", fields: [fromBranchId], references: [id])
  toBranchId   String
  toBranch     Branch   @relation("ToBranch", fields: [toBranchId], references: [id])
  
  status           TransferStatus @default(PENDING)
  referenceNumber  String
  notes            String?
  
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  receivedBy    String?
  sentAt        DateTime?
  receivedAt    DateTime?
  
  items         StockTransferItem[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([tenantId, status])
}

enum TransferStatus { PENDING IN_TRANSIT RECEIVED CANCELLED }

model StockTransferItem {
  id          String   @id @default(uuid())
  transferId  String
  transfer    StockTransfer @relation(fields: [transferId], references: [id], onDelete: Cascade)
  tenantId    String
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  
  quantitySent     Int
  quantityReceived Int?
  
  createdAt DateTime @default(now())
}

// ─── BRANCHES ──────────────────────────────────────────
model Branch {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  name        String
  code        String
  address     Json?
  phone       String?
  email       String?
  managerId   String?
  isWarehouse Boolean @default(false)
  isActive    Boolean @default(true)
  operatingHours Json?
  settings    Json?
  
  inventoryMovements InventoryMovement[]
  stockTransfersFrom StockTransfer[] @relation("FromBranch")
  stockTransfersTo   StockTransfer[] @relation("ToBranch")
  sales              Sale[]
  repairs            RepairTicket[]
  employees          Employee[]
  expenses           Expense[]
  purchaseOrders     PurchaseOrder[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  
  @@unique([tenantId, code])
  @@index([tenantId])
}

// ─── CUSTOMERS & SUPPLIERS ─────────────────────────────
model Customer {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  customerCode  String
  name          String
  email         String?
  phone         String?
  address       Json?
  taxId         String?
  notes         String?
  
  creditBalance   Decimal @default(0) @db.Decimal(12, 2)
  totalPurchases  Decimal @default(0) @db.Decimal(12, 2)
  totalRepairs    Int     @default(0)
  lastVisitAt     DateTime?
  status          CustomerStatus @default(ACTIVE)
  
  devices     CustomerDevice[]
  sales       Sale[]
  repairs     RepairTicket[]
  credits     CreditTransaction[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  
  @@unique([tenantId, customerCode])
  @@index([tenantId])
  @@index([tenantId, name])
  @@index([tenantId, phone])
}

enum CustomerStatus { ACTIVE INACTIVE }

model CustomerDevice {
  id         String   @id @default(uuid())
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id])
  tenantId   String
  
  deviceType   DeviceType
  brand        String
  model        String
  serialNumber String?
  imei         String?
  color        String?
  notes        String?
  
  repairs RepairTicket[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([customerId])
}

enum DeviceType { LAPTOP DESKTOP PHONE TABLET PRINTER NETWORK GAMING_CONSOLE OTHER }

model Supplier {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  name           String
  contactPerson  String
  email          String
  phone          String
  address        Json?
  taxId          String?
  paymentTerms   Int      @default(0)
  outstandingBalance Decimal @default(0) @db.Decimal(12, 2)
  notes          String?
  status         SupplierStatus @default(ACTIVE)
  
  products       Product[]
  purchaseOrders PurchaseOrder[]
  payments       SupplierPayment[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  
  @@index([tenantId])
}

enum SupplierStatus { ACTIVE INACTIVE }

// ─── SALES / POS ────────────────────────────────────────
model Sale {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  branchId  String
  branch    Branch   @relation(fields: [branchId], references: [id])
  
  saleNumber     String
  customerId     String?
  customer       Customer? @relation(fields: [customerId], references: [id])
  userId         String
  user           User      @relation(fields: [userId], references: [id])
  
  subtotal       Decimal @db.Decimal(12, 2)
  discountAmount Decimal @default(0) @db.Decimal(12, 2)
  discountType   DiscountType?
  taxAmount      Decimal @default(0) @db.Decimal(12, 2)
  total          Decimal @db.Decimal(12, 2)
  amountPaid     Decimal @db.Decimal(12, 2)
  changeAmount   Decimal @default(0) @db.Decimal(12, 2)
  
  status         SaleStatus @default(COMPLETED)
  notes          String?
  receiptPrinted Boolean  @default(false)
  
  items          SaleItem[]
  payments       SalePayment[]
  refunds        SaleRefund[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([tenantId, saleNumber])
  @@index([tenantId, createdAt(sort: Desc)])
  @@index([tenantId, branchId, createdAt(sort: Desc)])
}

enum DiscountType { FIXED PERCENTAGE }
enum SaleStatus { COMPLETED VOIDED REFUNDED PARTIALLY_REFUNDED }

model SaleItem {
  id        String   @id @default(uuid())
  saleId    String
  sale      Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  tenantId  String
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  
  quantity      Int
  unitPrice     Decimal @db.Decimal(12, 2)
  discountAmount Decimal @default(0) @db.Decimal(12, 2)
  taxRate       Decimal @db.Decimal(5, 2)
  taxAmount     Decimal @default(0) @db.Decimal(12, 2)
  total         Decimal @db.Decimal(12, 2)
  
  createdAt DateTime @default(now())
}

model SalePayment {
  id            String   @id @default(uuid())
  saleId        String
  sale          Sale     @relation(fields: [saleId], references: [id], onDelete: Cascade)
  tenantId      String
  
  paymentMethod PaymentMethod
  amount        Decimal @db.Decimal(12, 2)
  reference     String?
  
  processedAt DateTime @default(now())
  createdAt   DateTime @default(now())
}

enum PaymentMethod { CASH CARD BANK_TRANSFER E_WALLET CREDIT STORE_CREDIT }

model SaleRefund {
  id        String   @id @default(uuid())
  saleId    String
  sale      Sale     @relation(fields: [saleId], references: [id])
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  refundNumber String
  userId       String
  user         User    @relation(fields: [userId], references: [id])
  reason       String
  
  subtotal    Decimal @db.Decimal(12, 2)
  taxAmount   Decimal @db.Decimal(12, 2)
  total       Decimal @db.Decimal(12, 2)
  
  refundMethod RefundMethod
  status       RefundStatus @default(PENDING)
  approvedBy   String?
  approvedAt   DateTime?
  
  items SaleRefundItem[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([tenantId, refundNumber])
}

enum RefundMethod { CASH CARD STORE_CREDIT }
enum RefundStatus { PENDING APPROVED COMPLETED REJECTED }

model SaleRefundItem {
  id          String   @id @default(uuid())
  refundId    String
  refund      SaleRefund @relation(fields: [refundId], references: [id], onDelete: Cascade)
  saleItemId  String
  saleItem    SaleItem  @relation(fields: [saleItemId], references: [id])
  productId   String
  product     Product   @relation(fields: [productId], references: [id])
  
  quantity  Int
  unitPrice Decimal @db.Decimal(12, 2)
  total     Decimal @db.Decimal(12, 2)
  
  createdAt DateTime @default(now())
}

// ─── REPAIRS ────────────────────────────────────────────
model RepairTicket {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  branchId  String
  branch    Branch   @relation(fields: [branchId], references: [id])
  
  ticketNumber     String
  customerId       String
  customer         Customer  @relation(fields: [customerId], references: [id])
  deviceId         String?
  device           CustomerDevice? @relation(fields: [deviceId], references: [id])
  
  deviceType       DeviceType
  deviceBrand      String
  deviceModel      String
  deviceSerial     String?
  deviceImei       String?
  accessoriesReceived String?
  physicalCondition  String?
  customerComplaint  String
  diagnosticFindings String?
  
  technicianId     String?
  technician       User?     @relation("TechnicianRepairs", fields: [technicianId], references: [id])
  createdBy        String
  creator          User      @relation("CreatorRepairs", fields: [createdBy], references: [id])
  
  priority         Priority  @default(NORMAL)
  status           RepairStatus @default(RECEIVED)
  
  estimatedCost    Decimal?  @db.Decimal(12, 2)
  actualCost       Decimal?  @db.Decimal(12, 2)
  laborCost        Decimal   @default(0) @db.Decimal(12, 2)
  partsCost        Decimal   @default(0) @db.Decimal(12, 2)
  totalCost        Decimal?  @db.Decimal(12, 2)
  
  warrantyUntil    DateTime?
  warrantyTerms    String?
  internalNotes    String?
  customerNotes    String?
  
  estimatedCompletion DateTime?
  receivedAt     DateTime @default(now())
  diagnosedAt    DateTime?
  startedAt      DateTime?
  completedAt    DateTime?
  pickedUpAt     DateTime?
  
  parts          RepairPart[]
  timeline       RepairTimeline[]
  images         RepairImage[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([tenantId, ticketNumber])
  @@index([tenantId, status])
  @@index([tenantId, technicianId, status])
  @@index([tenantId, branchId, status])
}

enum Priority { LOW NORMAL HIGH URGENT }
enum RepairStatus {
  RECEIVED DIAGNOSING WAITING_FOR_APPROVAL WAITING_FOR_PARTS
  IN_REPAIR READY_FOR_PICKUP COMPLETED CANCELLED WARRANTY_RETURN
}

model RepairPart {
  id        String   @id @default(uuid())
  repairId  String
  repair    RepairTicket @relation(fields: [repairId], references: [id], onDelete: Cascade)
  tenantId  String
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  
  quantityUsed Int
  unitCost     Decimal @db.Decimal(12, 2)
  totalCost    Decimal @db.Decimal(12, 2)
  
  createdAt DateTime @default(now())
}

model RepairTimeline {
  id        String   @id @default(uuid())
  repairId  String
  repair    RepairTicket @relation(fields: [repairId], references: [id], onDelete: Cascade)
  tenantId  String
  
  status     RepairStatus
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  notes      String?
  oldValues  Json?
  newValues  Json?
  
  createdAt DateTime @default(now())
  
  @@index([repairId, createdAt(sort: Desc)])
}

model RepairImage {
  id        String   @id @default(uuid())
  repairId  String
  repair    RepairTicket @relation(fields: [repairId], references: [id], onDelete: Cascade)
  tenantId  String
  
  imagePath  String
  imageType  ImageType
  caption    String?
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  
  createdAt DateTime @default(now())
}

enum ImageType { BEFORE AFTER DAMAGE PART }

// ─── EMPLOYEES & SCHEDULING ────────────────────────────
model Employee {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  userId     String?
  user       User?    @relation(fields: [userId], references: [id])
  employeeCode String
  
  firstName  String
  lastName   String
  position   Position
  department String?
  branchId   String
  branch     Branch   @relation(fields: [branchId], references: [id])
  
  hireDate       Date
  salary         Decimal? @db.Decimal(12, 2)
  commissionRate Decimal  @default(0) @db.Decimal(5, 2)
  phone          String?
  emergencyContact Json?
  
  status    EmployeeStatus @default(ACTIVE)
  
  schedules  Schedule[]
  attendance Attendance[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?
  
  @@unique([tenantId, employeeCode])
  @@index([tenantId])
}

enum Position { OWNER MANAGER CASHIER TECHNICIAN INVENTORY_CLERK ACCOUNTANT STAFF }
enum EmployeeStatus { ACTIVE ON_LEAVE TERMINATED }

model Schedule {
  id         String   @id @default(uuid())
  tenantId   String
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id])
  branchId   String
  branch     Branch   @relation(fields: [branchId], references: [id])
  
  date         Date
  startTime    DateTime
  endTime      DateTime
  breakMinutes Int      @default(0)
  status       ScheduleStatus @default(SCHEDULED)
  notes        String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([tenantId, employeeId, date])
}

enum ScheduleStatus { SCHEDULED CONFIRMED ABSENT PRESENT LATE }

model Attendance {
  id         String   @id @default(uuid())
  tenantId   String
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id])
  
  date      DateTime
  clockIn   DateTime
  clockOut  DateTime?
  status    AttendanceStatus @default(PRESENT)
  notes     String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([tenantId, employeeId, date])
}

enum AttendanceStatus { PRESENT ABSENT LATE HALF_DAY LEAVE }

// ─── FINANCE ────────────────────────────────────────────
model Expense {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  branchId  String
  branch    Branch   @relation(fields: [branchId], references: [id])
  
  category    ExpenseCategory
  description String
  amount      Decimal @db.Decimal(12, 2)
  expenseDate Date
  
  paymentMethod PaymentMethod
  reference     String?
  receiptPath   String?
  
  userId      String
  user        User    @relation(fields: [userId], references: [id])
  approvedBy  String?
  approvedAt  DateTime?
  status      ExpenseStatus @default(PENDING)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([tenantId, expenseDate(sort: Desc)])
}

enum ExpenseCategory { RENT UTILITIES SALARY SUPPLIES MAINTENANCE MARKETING TRANSPORT OTHER }
enum ExpenseStatus { PENDING APPROVED REJECTED }

model PurchaseOrder {
  id         String   @id @default(uuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  supplierId String
  supplier   Supplier @relation(fields: [supplierId], references: [id])
  branchId   String
  branch     Branch   @relation(fields: [branchId], references: [id])
  
  poNumber     String
  status       POStatus @default(DRAFT)
  subtotal     Decimal @db.Decimal(12, 2)
  taxAmount    Decimal @default(0) @db.Decimal(12, 2)
  total        Decimal @db.Decimal(12, 2)
  expectedDate Date?
  notes        String?
  
  userId String
  user   User   @relation(fields: [userId], references: [id])
  
  items   PurchaseOrderItem[]
  payments SupplierPayment[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([tenantId, poNumber])
}

enum POStatus { DRAFT ORDERED PARTIALLY_RECEIVED RECEIVED CANCELLED }

model PurchaseOrderItem {
  id               String   @id @default(uuid())
  purchaseOrderId  String
  purchaseOrder    PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  tenantId         String
  productId        String
  product          Product  @relation(fields: [productId], references: [id])
  
  quantityOrdered Int
  quantityReceived Int    @default(0)
  unitCost        Decimal @db.Decimal(12, 2)
  totalCost       Decimal @db.Decimal(12, 2)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model SupplierPayment {
  id             String   @id @default(uuid())
  tenantId       String
  tenant         Tenant   @relation(fields: [tenantId], references: [id])
  supplierId     String
  supplier       Supplier @relation(fields: [supplierId], references: [id])
  purchaseOrderId String?
  purchaseOrder  PurchaseOrder? @relation(fields: [purchaseOrderId], references: [id])
  
  amount         Decimal @db.Decimal(12, 2)
  paymentMethod  PaymentMethod
  reference      String?
  notes          String?
  
  userId String
  user   User   @relation(fields: [userId], references: [id])
  
  createdAt DateTime @default(now())
}

// ─── NOTIFICATIONS ──────────────────────────────────────
model Notification {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  
  type    NotificationType
  title   String
  message String
  data    Json?
  channel NotificationChannel @default(IN_APP)
  
  readAt   DateTime?
  sentAt   DateTime?
  
  createdAt DateTime @default(now())
  
  @@index([tenantId, userId, createdAt(sort: Desc)])
}

enum NotificationType {
  LOW_STOCK REPAIR_COMPLETED REPAIR_OVERDUE PAYMENT_RECEIVED
  REFUND_ISSUED SYSTEM_ERROR DATABASE_PROBLEM BACKUP_FAILURE
  SUSPICIOUS_ACTIVITY SERVICE_OUTAGE
}

enum NotificationChannel { IN_APP EMAIL WEBHOOK }

// ─── AUDIT & SYSTEM ─────────────────────────────────────
model AuditLog {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  
  action    AuditAction
  resourceType String
  resourceId   String?
  oldValues    Json?
  newValues    Json?
  
  ipAddress     String?
  userAgent     String?
  requestId     String?
  correlationId String?
  
  createdAt DateTime @default(now())
  
  @@index([tenantId, action, createdAt(sort: Desc)])
  @@index([tenantId, userId, createdAt(sort: Desc)])
}

enum AuditAction {
  LOGIN LOGOUT CREATE UPDATE DELETE REFUND VOID
  PRICE_CHANGE STOCK_ADJUSTMENT PERMISSION_CHANGE
  PASSWORD_CHANGE SETTINGS_CHANGE DATA_EXPORT
}

model ErrorEvent {
  id        String   @id @default(uuid())
  tenantId  String?
  
  fingerprint   String
  severity      ErrorSeverity
  status        ErrorStatus  @default(NEW)
  errorClass    String
  message       String
  stackTrace    String
  file          String?
  line          Int?
  function      String?
  route         String?
  httpMethod    String?
  statusCode    Int?
  
  userId     String?
  requestData  Json?
  serverData   Json?
  environment  String
  applicationVersion String?
  gitCommit    String?
  
  aiAnalysis    Json?
  aiConfidence  Decimal? @db.Decimal(5, 2)
  aiAnalyzedAt  DateTime?
  aiStatus      String?
  
  relatedDeploymentId String?
  
  count       Int      @default(1)
  firstSeenAt DateTime @default(now())
  lastSeenAt  DateTime @default(now())
  
  resolvedAt DateTime?
  resolvedBy String?
  notes      String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([fingerprint])
  @@index([tenantId, severity, status])
  @@index([tenantId, createdAt(sort: Desc)])
}

enum ErrorSeverity { CRITICAL HIGH MEDIUM LOW INFO }
enum ErrorStatus { NEW INVESTIGATING KNOWN FIXED IGNORED REGRESSION }

model Deployment {
  id         String   @id @default(uuid())
  version    String
  gitCommit  String?
  gitBranch  String?
  environment String
  
  status  DeploymentStatus @default(PENDING)
  startedAt   DateTime @default(now())
  completedAt DateTime?
  rollbackId  String?
  
  notes   String?
  userId  String
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum DeploymentStatus { PENDING DEPLOYING COMPLETED FAILED ROLLED_BACK }

model SelfHealingAction {
  id        String   @id @default(uuid())
  tenantId  String?
  
  actionType  String
  riskLevel   RiskLevel
  triggerErrorId String?
  triggerReason  String
  actionData     Json?
  
  status SelfHealingStatus @default(PENDING)
  result Json?
  
  executedAt    DateTime?
  verifiedAt    DateTime?
  rollbackActionId String?
  executedBy    ExecutionSource @default(AI)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum RiskLevel { SAFE CONTROLLED DANGEROUS MANUAL_ONLY }
enum SelfHealingStatus { PENDING EXECUTING COMPLETED FAILED ROLLED_BACK }
enum ExecutionSource { AI SYSTEM USER }

model Backup {
  id        String   @id @default(uuid())
  type      BackupType
  filename  String
  path      String
  sizeBytes BigInt
  checksum  String
  
  status   BackupStatus @default(PENDING)
  verifiedAt DateTime?
  verificationResult Json?
  errorMessage String?
  
  retentionUntil DateTime
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum BackupType { DATABASE FILES FULL }
enum BackupStatus { PENDING COMPLETED FAILED VERIFIED EXPIRED }

// ─── SETTINGS ───────────────────────────────────────────
model Setting {
  id       String @id @default(uuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])
  
  group String
  key   String
  value String
  type  SettingType @default(STRING)
  
  @@unique([tenantId, group, key])
  @@index([tenantId])
}

enum SettingType { STRING INTEGER BOOLEAN JSON TEXT }

model TenantModule {
  id       String @id @default(uuid())
  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id])
  
  module   String
  enabled  Boolean @default(true)
  settings Json?
  
  @@unique([tenantId, module])
}
```

## Migration Strategy

- All schema changes via `prisma migrate dev`
- Migrations are version-controlled
- Zero-downtime migrations preferred
- Foreign key constraints enforced at database level
- Soft deletes via `deletedAt` field
- Seed data via `prisma/seed.ts`

## Indexes Strategy

Key indexes for performance:
- All `tenantId` fields indexed
- Composite indexes on (tenantId, status) for filtered queries
- Descending date indexes for "latest first" queries
- Unique constraints on business keys (SKU, ticket numbers, etc.)
