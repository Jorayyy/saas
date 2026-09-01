import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.APP_URL || '*',
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  const prismaService = app.get(PrismaService);
  app.useGlobalFilters(new GlobalExceptionFilter(prismaService));

  // Global interceptors
  app.useGlobalInterceptors(new AuditInterceptor(prismaService));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('TechShop SaaS API')
    .setDescription('Multi-tenant tech repair shop management platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication and authorization')
    .addTag('Tenants', 'Tenant management')
    .addTag('Users', 'User management')
    .addTag('Roles', 'Role and permission management')
    .addTag('Products', 'Product catalog management')
    .addTag('Inventory', 'Stock and inventory management')
    .addTag('Customers', 'Customer management')
    .addTag('Suppliers', 'Supplier management')
    .addTag('Sales', 'Point of sale and transactions')
    .addTag('Repairs', 'Repair ticket management')
    .addTag('Employees', 'Employee and scheduling management')
    .addTag('Expenses', 'Expense tracking')
    .addTag('Reports', 'Business reports')
    .addTag('Dashboard', 'Dashboard and analytics')
    .addTag('Health', 'System health checks')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/docs`);
}
bootstrap();
