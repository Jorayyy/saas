import { PrismaClient, Plan, UserStatus, Position, EmployeeStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Demo Tech Shop',
      slug: 'demo-tech-shop',
      plan: Plan.FREE,
      settings: {
        currency: 'USD',
        taxRate: 12,
        lowStockThreshold: 5,
        negativeStockAllowed: false,
      },
    },
  });
  console.log(`Created tenant: ${tenant.name}`);

  // Create default branch
  const branch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Main Branch',
      code: 'MAIN',
      address: { street: '123 Tech Street', city: 'Techville', country: 'US' },
      phone: '+1234567890',
      email: 'main@demotech.com',
      isWarehouse: true,
    },
  });
  console.log(`Created branch: ${branch.name}`);

  // Create permissions
  const permissionGroups = [
    'products', 'inventory', 'customers', 'suppliers', 'purchases',
    'sales', 'repairs', 'employees', 'expenses', 'reports',
    'users', 'roles', 'settings', 'audit', 'system', 'dashboard',
  ];

  const permissions = [];
  for (const group of permissionGroups) {
    const actions = ['view', 'create', 'update', 'delete'];
    for (const action of actions) {
      const perm = await prisma.permission.create({
        data: {
          name: `${group}.${action}`,
          group,
          description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${group}`,
        },
      });
      permissions.push(perm);
    }
  }
  console.log(`Created ${permissions.length} permissions`);

  // Create system roles
  const roles = [
    { name: 'SUPER_ADMIN', displayName: 'Super Admin', isSystem: true, perms: permissions.map(p => p.name) },
    { name: 'TENANT_OWNER', displayName: 'Tenant Owner', isSystem: true, perms: permissions.map(p => p.name) },
    { name: 'ADMIN', displayName: 'Administrator', isSystem: true, perms: permissions.map(p => p.name) },
    { name: 'MANAGER', displayName: 'Manager', isSystem: true, perms: permissions.filter(p => !p.name.startsWith('users.') && !p.name.startsWith('roles.') && !p.name.startsWith('settings.')).map(p => p.name) },
    { name: 'CASHIER', displayName: 'Cashier', isSystem: true, perms: ['products.view', 'customers.view', 'customers.create', 'sales.view', 'sales.create', 'dashboard.view'] },
    { name: 'TECHNICIAN', displayName: 'Technician', isSystem: true, perms: ['products.view', 'customers.view', 'repairs.view', 'repairs.create', 'repairs.update', 'dashboard.view'] },
    { name: 'INVENTORY_MANAGER', displayName: 'Inventory Manager', isSystem: true, perms: ['products.view', 'products.create', 'products.update', 'inventory.view', 'inventory.adjust', 'inventory.transfer', 'suppliers.view', 'suppliers.create', 'dashboard.view'] },
    { name: 'ACCOUNTANT', displayName: 'Accountant', isSystem: true, perms: ['reports.view', 'reports.export', 'expenses.view', 'expenses.create', 'expenses.approve', 'sales.view', 'dashboard.view'] },
    { name: 'STAFF', displayName: 'Staff', isSystem: true, perms: ['products.view', 'customers.view', 'dashboard.view'] },
  ];

  const roleRecords = [];
  for (const roleData of roles) {
    const role = await prisma.role.create({
      data: {
        tenantId: tenant.id,
        name: roleData.name,
        displayName: roleData.displayName,
        isSystem: roleData.isSystem,
      },
    });

    // Assign permissions
    for (const permName of roleData.perms) {
      const perm = permissions.find(p => p.name === permName);
      if (perm) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
      }
    }

    roleRecords.push(role);
  }
  console.log(`Created ${roleRecords.length} roles`);

  // Create admin user
  const hashedPassword = await argon2.hash('admin123');
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Admin User',
      email: 'admin@demotech.com',
      password: hashedPassword,
      status: UserStatus.ACTIVE,
    },
  });

  // Assign admin role
  const adminRole = roleRecords.find(r => r.name === 'ADMIN');
  if (adminRole) {
    await prisma.userRole.create({
      data: { userId: adminUser.id, roleId: adminRole.id },
    });
  }
  console.log(`Created admin user: ${adminUser.email}`);

  // Create categories
  const categories = [
    { name: 'Laptops', slug: 'laptops' },
    { name: 'Desktops', slug: 'desktops' },
    { name: 'Phones', slug: 'phones' },
    { name: 'Tablets', slug: 'tablets' },
    { name: 'Printers', slug: 'printers' },
    { name: 'Networking', slug: 'networking' },
    { name: 'Components', slug: 'components' },
    { name: 'Accessories', slug: 'accessories' },
    { name: 'Software', slug: 'software' },
    { name: 'Services', slug: 'services' },
  ];

  const categoryRecords = [];
  for (const cat of categories) {
    const record = await prisma.category.create({
      data: { tenantId: tenant.id, ...cat },
    });
    categoryRecords.push(record);
  }
  console.log(`Created ${categoryRecords.length} categories`);

  // Create brands
  const brands = [
    { name: 'Apple', slug: 'apple' },
    { name: 'Samsung', slug: 'samsung' },
    { name: 'Dell', slug: 'dell' },
    { name: 'HP', slug: 'hp' },
    { name: 'Lenovo', slug: 'lenovo' },
    { name: 'Asus', slug: 'asus' },
    { name: 'Acer', slug: 'acer' },
    { name: 'Sony', slug: 'sony' },
    { name: 'Microsoft', slug: 'microsoft' },
    { name: 'Logitech', slug: 'logitech' },
  ];

  const brandRecords = [];
  for (const brand of brands) {
    const record = await prisma.brand.create({
      data: { tenantId: tenant.id, ...brand },
    });
    brandRecords.push(record);
  }
  console.log(`Created ${brandRecords.length} brands`);

  // Create sample products
  const products = [
    { sku: 'LAP-001', name: 'MacBook Air M2', categoryId: categoryRecords[0].id, brandId: brandRecords[0].id, purchaseCost: 899, sellingPrice: 1199, currentStock: 10, minimumStock: 3 },
    { sku: 'LAP-002', name: 'Dell XPS 15', categoryId: categoryRecords[0].id, brandId: brandRecords[2].id, purchaseCost: 999, sellingPrice: 1399, currentStock: 8, minimumStock: 3 },
    { sku: 'PHN-001', name: 'iPhone 15 Pro', categoryId: categoryRecords[2].id, brandId: brandRecords[0].id, purchaseCost: 799, sellingPrice: 1099, currentStock: 15, minimumStock: 5 },
    { sku: 'PHN-002', name: 'Samsung Galaxy S24', categoryId: categoryRecords[2].id, brandId: brandRecords[1].id, purchaseCost: 699, sellingPrice: 999, currentStock: 12, minimumStock: 5 },
    { sku: 'TAB-001', name: 'iPad Pro 12.9', categoryId: categoryRecords[3].id, brandId: brandRecords[0].id, purchaseCost: 899, sellingPrice: 1199, currentStock: 7, minimumStock: 3 },
    { sku: 'PRT-001', name: 'HP LaserJet Pro', categoryId: categoryRecords[4].id, brandId: brandRecords[3].id, purchaseCost: 299, sellingPrice: 449, currentStock: 5, minimumStock: 2 },
    { sku: 'NET-001', name: 'TP-Link Archer AX73', categoryId: categoryRecords[5].id, brandId: brandRecords[5].id, purchaseCost: 89, sellingPrice: 149, currentStock: 20, minimumStock: 5 },
    { sku: 'CMP-001', name: 'Samsung 980 Pro 1TB', categoryId: categoryRecords[6].id, brandId: brandRecords[1].id, purchaseCost: 79, sellingPrice: 129, currentStock: 25, minimumStock: 10 },
    { sku: 'ACC-001', name: 'Logitech MX Master 3S', categoryId: categoryRecords[7].id, brandId: brandRecords[9].id, purchaseCost: 69, sellingPrice: 99, currentStock: 30, minimumStock: 10 },
    { sku: 'ACC-002', name: 'USB-C Hub 7-in-1', categoryId: categoryRecords[7].id, brandId: brandRecords[5].id, purchaseCost: 25, sellingPrice: 49, currentStock: 50, minimumStock: 15 },
  ];

  for (const prod of products) {
    await prisma.product.create({
      data: {
        tenantId: tenant.id,
        ...prod,
        taxRate: 12,
        unit: 'PIECE',
      },
    });
  }
  console.log(`Created ${products.length} products`);

  // Create sample customers
  const customers = [
    { customerCode: 'CUS-001', name: 'John Smith', email: 'john@example.com', phone: '+1234567891' },
    { customerCode: 'CUS-002', name: 'Jane Doe', email: 'jane@example.com', phone: '+1234567892' },
    { customerCode: 'CUS-003', name: 'Bob Johnson', email: 'bob@example.com', phone: '+1234567893' },
  ];

  for (const cust of customers) {
    await prisma.customer.create({
      data: { tenantId: tenant.id, ...cust },
    });
  }
  console.log(`Created ${customers.length} customers`);

  // Create sample suppliers
  const suppliers = [
    { name: 'TechDistributors Inc', contactPerson: 'Mike Wilson', email: 'orders@techdist.com', phone: '+1987654321' },
    { name: 'Global Parts Ltd', contactPerson: 'Sarah Lee', email: 'sales@globalparts.com', phone: '+1987654322' },
  ];

  for (const sup of suppliers) {
    await prisma.supplier.create({
      data: { tenantId: tenant.id, ...sup },
    });
  }
  console.log(`Created ${suppliers.length} suppliers`);

  // Create employee
  const employee = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      userId: adminUser.id,
      employeeCode: 'EMP-001',
      firstName: 'Admin',
      lastName: 'User',
      position: Position.OWNER,
      branchId: branch.id,
      hireDate: new Date(),
      phone: '+1234567890',
      status: EmployeeStatus.ACTIVE,
    },
  });
  console.log(`Created employee: ${employee.employeeCode}`);

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
