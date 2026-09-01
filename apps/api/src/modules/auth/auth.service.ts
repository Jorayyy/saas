import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  tenantName: string;
  tenantSlug: string;
  name: string;
  email: string;
  password: string;
}

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  avatar?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequestDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    tenantId: string;
    roles: string[];
    permissions: string[];
  };
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, ip?: string): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        tenant: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Account is locked. Try again in ${minutesLeft} minutes.`);
    }

    const isPasswordValid = await argon2.verify(user.password, dto.password);

    if (!isPasswordValid) {
      const failedAttempts = user.failedAttempts + 1;
      const lockUntil = failedAttempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000)
        : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts, lockedUntil: lockUntil },
      });

      // Log failed login attempt
      await this.prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: 'LOGIN',
          resourceType: 'auth',
          newValues: { success: false, reason: 'invalid_password', attempt: failedAttempts },
          ipAddress: ip,
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts and update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    // Extract roles and permissions
    const roles = user.roles.map(ur => ur.role.name);
    const permissions = [...new Set(
      user.roles.flatMap(ur =>
        ur.role.permissions.map(rp => rp.permission.name)
      ),
    )];

    const tokens = await this.generateTokens(user.id, user.email, user.tenantId, roles);

    // Log successful login
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'LOGIN',
        resourceType: 'auth',
        newValues: { success: true },
        ipAddress: ip,
      },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        roles,
        permissions,
      },
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant slug already in use');
    }

    const existingEmail = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (existingEmail) {
      throw new ConflictException('Email already in use');
    }

    // Create tenant with default settings
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.tenantName,
        slug: dto.tenantSlug,
        settings: {
          currency: 'USD',
          taxRate: 12,
          lowStockThreshold: 5,
          negativeStockAllowed: false,
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
        },
      },
    });

    // Create default branch
    await this.prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Branch',
        code: 'MAIN',
        isWarehouse: true,
        isActive: true,
      },
    });

    // Create default roles for this tenant
    const defaultRoles = await this.createDefaultRoles(tenant.id);

    // Create user
    const hashedPassword = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
      },
    });

    // Assign TENANT_OWNER role
    const ownerRole = defaultRoles.find(r => r.name === 'TENANT_OWNER');
    if (ownerRole) {
      await this.prisma.userRole.create({
        data: { userId: user.id, roleId: ownerRole.id },
      });
    }

    // Create default modules
    const defaultModules = ['products', 'inventory', 'customers', 'suppliers', 'sales', 'repairs', 'employees', 'expenses', 'reports'];
    for (const mod of defaultModules) {
      await this.prisma.tenantModule.create({
        data: { tenantId: tenant.id, module: mod, enabled: true },
      });
    }

    const roles = ownerRole ? [ownerRole.name] : [];
    const permissions = await this.getRolePermissions(ownerRole?.id);

    const tokens = await this.generateTokens(user.id, user.email, tenant.id, roles);

    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: tenant.id,
        roles,
        permissions,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          roles: { include: { role: true } },
        },
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Invalid token');
      }

      const roles = user.roles.map(ur => ur.role.name);
      const newAccessToken = await this.generateAccessToken(user.id, user.email, user.tenantId, roles);

      return { accessToken: newAccessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, tenantId: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'LOGOUT',
        resourceType: 'auth',
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        tenant: { select: { id: true, name: true, slug: true, plan: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = user.roles.map(ur => ur.role.name);
    const permissions = [...new Set(
      user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name)),
    )];

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      tenant: user.tenant,
      roles,
      permissions,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.avatar !== undefined && { avatar: dto.avatar }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId,
        action: 'UPDATE',
        resourceType: 'user',
        resourceId: userId,
        oldValues: { name: user.name, phone: user.phone },
        newValues: dto,
      },
    });

    return updated;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await argon2.verify(user.password, dto.currentPassword);
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate password strength
    this.validatePasswordStrength(dto.newPassword);

    const hashedPassword = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId,
        action: 'PASSWORD_CHANGE',
        resourceType: 'user',
        resourceId: userId,
      },
    });
  }

  async requestPasswordReset(dto: ResetPasswordRequestDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { message: 'If the email exists, a reset link has been sent.' };
    }

    // Generate reset token
    const resetToken = this.jwtService.sign(
      { sub: user.id, type: 'password_reset' },
      { expiresIn: '1h' },
    );

    // Store token hash (in production, send via email)
    // For now, we'll log it
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: 'PASSWORD_CHANGE',
        resourceType: 'auth',
        newValues: { action: 'reset_requested' },
      },
    });

    return { message: 'If the email exists, a reset link has been sent.', token: resetToken };
  }

  async resetPassword(dto: ResetPasswordDto) {
    try {
      const payload = this.jwtService.verify(dto.token);

      if (payload.type !== 'password_reset') {
        throw new BadRequestException('Invalid token type');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub, deletedAt: null },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      this.validatePasswordStrength(dto.newPassword);

      const hashedPassword = await argon2.hash(dto.newPassword);
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: 'PASSWORD_CHANGE',
          resourceType: 'auth',
          newValues: { action: 'reset_completed' },
        },
      });

      return { message: 'Password reset successfully' };
    } catch {
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  private async generateTokens(userId: string, email: string, tenantId: string, roles: string[]) {
    const payload = { sub: userId, email, tenantId, roles };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: process.env.JWT_EXPIRATION || '15m' }),
      this.jwtService.signAsync(payload, { expiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d' }),
    ]);

    return { accessToken, refreshToken };
  }

  private async generateAccessToken(userId: string, email: string, tenantId: string, roles: string[]) {
    return this.jwtService.signAsync(
      { sub: userId, email, tenantId, roles },
      { expiresIn: process.env.JWT_EXPIRATION || '15m' },
    );
  }

  private validatePasswordStrength(password: string) {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      throw new BadRequestException(`Password must be at least ${minLength} characters`);
    }
    if (!hasUpperCase) {
      throw new BadRequestException('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      throw new BadRequestException('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      throw new BadRequestException('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      throw new BadRequestException('Password must contain at least one special character');
    }
  }

  private async createDefaultRoles(tenantId: string) {
    const roleDefinitions = [
      { name: 'SUPER_ADMIN', displayName: 'Super Admin', isSystem: true, allPerms: true },
      { name: 'TENANT_OWNER', displayName: 'Tenant Owner', isSystem: true, allPerms: true },
      { name: 'ADMIN', displayName: 'Administrator', isSystem: true, allPerms: true },
      { name: 'MANAGER', displayName: 'Manager', isSystem: true, excludePerms: ['users.manage', 'roles.manage', 'settings.manage', 'audit.view'] },
      { name: 'CASHIER', displayName: 'Cashier', isSystem: true, perms: ['products.view', 'customers.view', 'customers.create', 'sales.view', 'sales.create', 'dashboard.view'] },
      { name: 'TECHNICIAN', displayName: 'Technician', isSystem: true, perms: ['products.view', 'customers.view', 'repairs.view', 'repairs.create', 'repairs.update', 'dashboard.view'] },
      { name: 'INVENTORY_MANAGER', displayName: 'Inventory Manager', isSystem: true, perms: ['products.view', 'products.create', 'products.update', 'inventory.view', 'inventory.adjust', 'inventory.transfer', 'suppliers.view', 'suppliers.create', 'dashboard.view'] },
      { name: 'ACCOUNTANT', displayName: 'Accountant', isSystem: true, perms: ['reports.view', 'reports.export', 'expenses.view', 'expenses.create', 'expenses.approve', 'sales.view', 'dashboard.view'] },
      { name: 'STAFF', displayName: 'Staff', isSystem: true, perms: ['products.view', 'customers.view', 'dashboard.view'] },
    ];

    const allPermissions = await this.prisma.permission.findMany();
    const createdRoles = [];

    for (const roleDef of roleDefinitions) {
      const role = await this.prisma.role.create({
        data: {
          tenantId,
          name: roleDef.name,
          displayName: roleDef.displayName,
          isSystem: roleDef.isSystem,
        },
      });

      // Assign permissions
      let permsToAssign: string[] = [];

      if (roleDef.allPerms) {
        permsToAssign = allPermissions.map(p => p.name);
      } else if (roleDef.perms) {
        permsToAssign = roleDef.perms;
      } else if (roleDef.excludePerms) {
        permsToAssign = allPermissions
          .map(p => p.name)
          .filter(name => !roleDef.excludePerms.includes(name));
      }

      for (const permName of permsToAssign) {
        const perm = allPermissions.find(p => p.name === permName);
        if (perm) {
          await this.prisma.rolePermission.create({
            data: { roleId: role.id, permissionId: perm.id },
          });
        }
      }

      createdRoles.push(role);
    }

    return createdRoles;
  }

  private async getRolePermissions(roleId?: string): Promise<string[]> {
    if (!roleId) return [];

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });

    return rolePermissions.map(rp => rp.permission.name);
  }
}
