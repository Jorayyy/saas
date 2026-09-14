import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('argon2', () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));

import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { [key: string]: any };
  let jwtService: { [key: string]: any };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      branch: {
        create: jest.fn(),
      },
      role: {
        create: jest.fn(),
      },
      userRole: {
        create: jest.fn(),
      },
      tenantModule: {
        create: jest.fn(),
      },
      permission: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      rolePermission: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      signAsync: jest.fn().mockResolvedValue('mock-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'test@test.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        status: 'INACTIVE',
        password: 'hashed',
        failedAttempts: 0,
        lockedUntil: null,
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for locked account', async () => {
      const futureDate = new Date(Date.now() + 15 * 60 * 1000);
      prisma.user.findFirst.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        status: 'ACTIVE',
        password: 'hashed',
        failedAttempts: 5,
        lockedUntil: futureDate,
      });

      await expect(
        service.login({ email: 'test@test.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens on successful login', async () => {
      const mockUser = {
        id: '1',
        email: 'test@test.com',
        name: 'Test User',
        status: 'ACTIVE',
        password: 'hashed',
        tenantId: 'tenant-1',
        failedAttempts: 0,
        lockedUntil: null,
        roles: [],
        tenant: { name: 'Test Tenant' },
      };
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.auditLog.create.mockResolvedValue({});

      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ email: 'test@test.com', password: 'password' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('email');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        status: 'ACTIVE',
        password: 'hashed',
        failedAttempts: 0,
        lockedUntil: null,
      });

      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should throw ConflictException for existing tenant slug', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'existing', slug: 'test-shop' });

      await expect(
        service.register({
          tenantName: 'Test Shop',
          tenantSlug: 'test-shop',
          name: 'Admin',
          email: 'admin@test.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for existing email', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.user.findFirst.mockResolvedValue({ id: 'existing', email: 'admin@test.com' });

      await expect(
        service.register({
          tenantName: 'Test Shop',
          tenantSlug: 'test-shop',
          name: 'Admin',
          email: 'admin@test.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('requestPasswordReset', () => {
    it('should always return success message to prevent email enumeration', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await service.requestPasswordReset({ email: 'nonexistent@test.com' });

      expect(result).toHaveProperty('message');
      expect(result.message).toContain('reset link');
      expect(result).not.toHaveProperty('token');
    });

    it('should not expose reset token in response', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '1',
        email: 'test@test.com',
        tenantId: 'tenant-1',
      });
      prisma.auditLog.create.mockResolvedValue({});

      const result = await service.requestPasswordReset({ email: 'test@test.com' });

      expect(result).not.toHaveProperty('token');
    });
  });

  describe('validatePasswordStrength', () => {
    it('should reject passwords shorter than 8 characters', () => {
      expect(() => service['validatePasswordStrength']('Ab1!')).toThrow(BadRequestException);
    });

    it('should reject passwords without uppercase', () => {
      expect(() => service['validatePasswordStrength']('lowercase1!')).toThrow(BadRequestException);
    });

    it('should reject passwords without lowercase', () => {
      expect(() => service['validatePasswordStrength']('UPPERCASE1!')).toThrow(BadRequestException);
    });

    it('should reject passwords without numbers', () => {
      expect(() => service['validatePasswordStrength']('NoNumbers!')).toThrow(BadRequestException);
    });

    it('should reject passwords without special characters', () => {
      expect(() => service['validatePasswordStrength']('NoSpecial1')).toThrow(BadRequestException);
    });

    it('should accept valid passwords', () => {
      expect(() => service['validatePasswordStrength']('ValidPass1!')).not.toThrow();
    });
  });
});
