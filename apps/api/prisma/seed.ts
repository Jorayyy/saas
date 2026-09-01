import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'TechShop Demo',
      slug: 'demo',
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
    },
  });
  console.log('Tenant created:', tenant.id);

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123');
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      name: 'Admin User',
      email: 'admin@techshop.com',
      password: hashedPassword,
      status: 'ACTIVE',
    },
  });
  console.log('Admin user created:', adminUser.email);

  // Create default role
  const adminRole = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: 'ADMIN',
      displayName: 'Administrator',
      description: 'Full system access',
      isSystem: true,
    },
  });

  // Assign role to user
  await prisma.userRole.create({
    data: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  // Create branch
  const branch = await prisma.branch.create({
    data: {
      tenantId: tenant.id,
      name: 'Main Branch',
      code: 'MAIN',
      isActive: true,
    },
  });
  console.log('Branch created:', branch.name);

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({
      data: { tenantId: tenant.id, name: 'Laptops', slug: 'laptops', sortOrder: 1 },
    }),
    prisma.category.create({
      data: { tenantId: tenant.id, name: 'Phones', slug: 'phones', sortOrder: 2 },
    }),
    prisma.category.create({
      data: { tenantId: tenant.id, name: 'Accessories', slug: 'accessories', sortOrder: 3 },
    }),
    prisma.category.create({
      data: { tenantId: tenant.id, name: 'Parts', slug: 'parts', sortOrder: 4 },
    }),
  ]);
  console.log('Categories created:', categories.length);

  // Create brands
  const brands = await Promise.all([
    prisma.brand.create({
      data: { tenantId: tenant.id, name: 'Apple', slug: 'apple' },
    }),
    prisma.brand.create({
      data: { tenantId: tenant.id, name: 'Samsung', slug: 'samsung' },
    }),
    prisma.brand.create({
      data: { tenantId: tenant.id, name: 'Dell', slug: 'dell' },
    }),
    prisma.brand.create({
      data: { tenantId: tenant.id, name: 'Lenovo', slug: 'lenovo' },
    }),
  ]);
  console.log('Brands created:', brands.length);

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: 'IPH-15-128',
        name: 'iPhone 15 128GB',
        categoryId: categories[1].id,
        brandId: brands[1].id,
        purchaseCost: 699,
        sellingPrice: 999,
        currentStock: 15,
        minimumStock: 5,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: 'MBP-M3-14',
        name: 'MacBook Pro M3 14"',
        categoryId: categories[0].id,
        brandId: brands[0].id,
        purchaseCost: 1599,
        sellingPrice: 1999,
        currentStock: 8,
        minimumStock: 3,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: 'S24-256',
        name: 'Samsung Galaxy S24 256GB',
        categoryId: categories[1].id,
        brandId: brands[1].id,
        purchaseCost: 599,
        sellingPrice: 899,
        currentStock: 20,
        minimumStock: 5,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: 'DELL-XPS-15',
        name: 'Dell XPS 15',
        categoryId: categories[0].id,
        brandId: brands[2].id,
        purchaseCost: 999,
        sellingPrice: 1399,
        currentStock: 10,
        minimumStock: 3,
      },
    }),
    prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: 'CHRG-USB-C',
        name: 'USB-C Charger 65W',
        categoryId: categories[2].id,
        purchaseCost: 15,
        sellingPrice: 29.99,
        currentStock: 50,
        minimumStock: 20,
      },
    }),
  ]);
  console.log('Products created:', products.length);

  // Create customers
  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        tenantId: tenant.id,
        customerCode: 'CUS-000001',
        name: 'John Smith',
        email: 'john@example.com',
        phone: '555-0101',
        status: 'ACTIVE',
      },
    }),
    prisma.customer.create({
      data: {
        tenantId: tenant.id,
        customerCode: 'CUS-000002',
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        phone: '555-0102',
        status: 'ACTIVE',
      },
    }),
    prisma.customer.create({
      data: {
        tenantId: tenant.id,
        customerCode: 'CUS-000003',
        name: 'Mike Wilson',
        phone: '555-0103',
        status: 'ACTIVE',
      },
    }),
  ]);
  console.log('Customers created:', customers.length);

  console.log('\n✅ Seed completed!');
  console.log('\n📋 Login Credentials:');
  console.log('Email: admin@techshop.com');
  console.log('Password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
