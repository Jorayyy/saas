import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RepairStatus } from '@prisma/client';

export interface CreateRepairDto {
  customerId: string;
  deviceId?: string;
  branchId: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  deviceSerial?: string;
  deviceImei?: string;
  accessoriesReceived?: string;
  physicalCondition?: string;
  customerComplaint: string;
  priority?: string;
  estimatedCost?: number;
  estimatedCompletion?: string;
  internalNotes?: string;
}

export interface UpdateRepairDto {
  technicianId?: string;
  status?: string;
  diagnosticFindings?: string;
  estimatedCost?: number;
  actualCost?: number;
  laborCost?: number;
  partsCost?: number;
  internalNotes?: string;
  customerNotes?: string;
}

@Injectable()
export class RepairsService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateRepairDto) {
    // Generate ticket number
    const repairCount = await this.prisma.repairTicket.count({ where: { tenantId } });
    const ticketNumber = `RP-${String(repairCount + 1).padStart(6, '0')}`;

    const repair = await this.prisma.$transaction(async (tx) => {
      const newRepair = await tx.repairTicket.create({
        data: {
          tenantId,
          ticketNumber,
          branchId: dto.branchId,
          customerId: dto.customerId,
          deviceId: dto.deviceId,
          deviceType: dto.deviceType as any,
          deviceBrand: dto.deviceBrand,
          deviceModel: dto.deviceModel,
          deviceSerial: dto.deviceSerial,
          deviceImei: dto.deviceImei,
          accessoriesReceived: dto.accessoriesReceived,
          physicalCondition: dto.physicalCondition,
          customerComplaint: dto.customerComplaint,
          priority: dto.priority as any || 'NORMAL',
          estimatedCost: dto.estimatedCost,
          estimatedCompletion: dto.estimatedCompletion ? new Date(dto.estimatedCompletion) : null,
          internalNotes: dto.internalNotes,
          createdBy: userId,
          receivedAt: new Date(),
        },
      });

      // Create initial timeline entry
      await tx.repairTimeline.create({
        data: {
          repairId: newRepair.id,
          tenantId,
          status: 'RECEIVED',
          userId,
          notes: 'Repair ticket created',
        },
      });

      return newRepair;
    });

    return this.findOne(tenantId, repair.id);
  }

  async findAll(tenantId: string, query: any) {
    const { page = 1, limit = 20, status, technicianId, branchId, priority } = query;

    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(technicianId && { technicianId }),
      ...(branchId && { branchId }),
      ...(priority && { priority }),
    };

    const [repairs, total] = await Promise.all([
      this.prisma.repairTicket.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          technician: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
      }),
      this.prisma.repairTicket.count({ where }),
    ]);

    return {
      data: repairs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(tenantId: string, id: string) {
    const repair = await this.prisma.repairTicket.findFirst({
      where: { id, tenantId },
      include: {
        customer: true,
        device: true,
        technician: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true } },
        branch: true,
        parts: { include: { product: true } },
        timeline: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        images: true,
      },
    });

    if (!repair) {
      throw new NotFoundException('Repair ticket not found');
    }

    return repair;
  }

  async update(tenantId: string, id: string, dto: UpdateRepairDto, userId: string) {
    const repair = await this.prisma.repairTicket.findFirst({
      where: { id, tenantId },
    });

    if (!repair) {
      throw new NotFoundException('Repair ticket not found');
    }

    const updatedRepair = await this.prisma.$transaction(async (tx) => {
      // Update repair
      const updated = await tx.repairTicket.update({
        where: { id },
        data: {
          ...(dto.technicianId && { technicianId: dto.technicianId }),
          ...(dto.status && { status: dto.status as RepairStatus }),
          ...(dto.diagnosticFindings && { diagnosticFindings: dto.diagnosticFindings }),
          ...(dto.estimatedCost !== undefined && { estimatedCost: dto.estimatedCost }),
          ...(dto.actualCost !== undefined && { actualCost: dto.actualCost }),
          ...(dto.laborCost !== undefined && { laborCost: dto.laborCost }),
          ...(dto.partsCost !== undefined && { partsCost: dto.partsCost }),
          ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
          ...(dto.customerNotes !== undefined && { customerNotes: dto.customerNotes }),
          // Auto-set timestamps based on status
          ...(dto.status === 'DIAGNOSING' && !repair.diagnosedAt && { diagnosedAt: new Date() }),
          ...(dto.status === 'IN_REPAIR' && !repair.startedAt && { startedAt: new Date() }),
          ...(dto.status === 'COMPLETED' && !repair.completedAt && { completedAt: new Date() }),
          ...(dto.status === 'READY_FOR_PICKUP' && { completedAt: repair.completedAt || new Date() }),
        },
      });

      // Create timeline entry
      if (dto.status) {
        await tx.repairTimeline.create({
          data: {
            repairId: id,
            tenantId,
            status: dto.status as RepairStatus,
            userId,
            oldValues: { status: repair.status },
            newValues: { status: dto.status },
            notes: dto.diagnosticFindings || dto.internalNotes,
          },
        });
      }

      return updated;
    });

    return this.findOne(tenantId, id);
  }

  async assign(tenantId: string, id: string, technicianId: string, userId: string) {
    const repair = await this.prisma.repairTicket.findFirst({
      where: { id, tenantId },
    });

    if (!repair) {
      throw new NotFoundException('Repair ticket not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.repairTicket.update({
        where: { id },
        data: { technicianId },
      });

      await tx.repairTimeline.create({
        data: {
          repairId: id,
          tenantId,
          status: repair.status,
          userId,
          notes: 'Technician assigned',
          newValues: { technicianId },
        },
      });
    });

    return this.findOne(tenantId, id);
  }

  async getTimeline(tenantId: string, id: string) {
    const repair = await this.prisma.repairTicket.findFirst({
      where: { id, tenantId },
    });

    if (!repair) {
      throw new NotFoundException('Repair ticket not found');
    }

    const timeline = await this.prisma.repairTimeline.findMany({
      where: { repairId: id, tenantId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return timeline;
  }

  async getStats(tenantId: string) {
    const stats = await this.prisma.repairTicket.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    });

    const overdue = await this.prisma.repairTicket.count({
      where: {
        tenantId,
        estimatedCompletion: { lt: new Date() },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });

    return {
      byStatus: stats.map(s => ({ status: s.status, count: s._count })),
      overdue,
    };
  }

  async getMyAssigned(tenantId: string, technicianId: string) {
    return this.prisma.repairTicket.findMany({
      where: {
        tenantId,
        technicianId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { estimatedCompletion: 'asc' },
      ],
    });
  }

  async addPart(tenantId: string, repairId: string, dto: {
    productId: string;
    quantity: number;
    unitCost: number;
  }, userId: string) {
    const repair = await this.prisma.repairTicket.findFirst({
      where: { id: repairId, tenantId },
    });

    if (!repair) {
      throw new NotFoundException('Repair ticket not found');
    }

    // Verify product exists and has stock
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, tenantId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.currentStock < dto.quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const part = await this.prisma.$transaction(async (tx) => {
      // Create part
      const newPart = await tx.repairPart.create({
        data: {
          repairId,
          tenantId,
          productId: dto.productId,
          quantityUsed: dto.quantity,
          unitCost: dto.unitCost,
          totalCost: dto.quantity * dto.unitCost,
        },
      });

      // Deduct stock
      await tx.product.update({
        where: { id: dto.productId },
        data: { currentStock: { decrement: dto.quantity } },
      });

      // Create inventory movement
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          branchId: repair.branchId,
          quantityBefore: product.currentStock,
          quantityChange: -dto.quantity,
          quantityAfter: product.currentStock - dto.quantity,
          transactionType: 'REPAIR_USE',
          userId,
          referenceType: 'RepairPart',
          referenceId: newPart.id,
        },
      });

      // Update repair parts cost
      const totalPartsCost = await tx.repairPart.aggregate({
        where: { repairId },
        _sum: { totalCost: true },
      });

      await tx.repairTicket.update({
        where: { id: repairId },
        data: {
          partsCost: Number(totalPartsCost._sum?.totalCost || 0),
          totalCost: Number(totalPartsCost._sum?.totalCost || 0) + Number(repair.laborCost || 0),
        },
      });

      return newPart;
    });

    return part;
  }

  async removePart(tenantId: string, repairId: string, partId: string, userId: string) {
    const repair = await this.prisma.repairTicket.findFirst({
      where: { id: repairId, tenantId },
    });

    if (!repair) {
      throw new NotFoundException('Repair ticket not found');
    }

    const part = await this.prisma.repairPart.findFirst({
      where: { id: partId, repairId, tenantId },
    });

    if (!part) {
      throw new NotFoundException('Part not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Restore stock
      await tx.product.update({
        where: { id: part.productId },
        data: { currentStock: { increment: part.quantityUsed } },
      });

      // Create inventory movement
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: part.productId,
          branchId: repair.branchId,
          quantityBefore: 0,
          quantityChange: part.quantityUsed,
          quantityAfter: 0,
          transactionType: 'REPAIR_USE',
          userId,
          referenceType: 'RepairPart',
          referenceId: partId,
        },
      });

      // Delete part
      await tx.repairPart.delete({ where: { id: partId } });

      // Update repair parts cost
      const totalPartsCost = await tx.repairPart.aggregate({
        where: { repairId },
        _sum: { totalCost: true },
      });

      await tx.repairTicket.update({
        where: { id: repairId },
        data: {
          partsCost: Number(totalPartsCost._sum?.totalCost || 0),
          totalCost: Number(totalPartsCost._sum?.totalCost || 0) + Number(repair.laborCost || 0),
        },
      });
    });

    return { message: 'Part removed' };
  }

  async complete(tenantId: string, id: string, userId: string) {
    const repair = await this.prisma.repairTicket.findFirst({
      where: { id, tenantId, status: { in: ['IN_REPAIR', 'WAITING_FOR_PARTS'] } },
    });

    if (!repair) {
      throw new NotFoundException('Repair not found or not ready for completion');
    }

    return this.update(tenantId, id, { status: 'COMPLETED' }, userId);
  }

  async pickup(tenantId: string, id: string, payments: Array<{ method: string; amount: number }>, userId: string) {
    const repair = await this.prisma.repairTicket.findFirst({
      where: { id, tenantId, status: 'READY_FOR_PICKUP' },
      include: { customer: true },
    });

    if (!repair) {
      throw new NotFoundException('Repair not found or not ready for pickup');
    }

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalDue = Number(repair.totalCost || repair.estimatedCost || 0);

    if (totalPaid < totalDue) {
      throw new BadRequestException('Insufficient payment');
    }

    await this.prisma.$transaction(async (tx) => {
      // Update repair status
      await tx.repairTicket.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Create timeline entry
      await tx.repairTimeline.create({
        data: {
          repairId: id,
          tenantId,
          status: 'COMPLETED',
          userId,
          notes: 'Device picked up and paid',
        },
      });

      // Note: Repair payments tracked separately from sales
      // TODO: Create a dedicated RepairPayment model

      // Update customer total
      if (repair.customerId) {
        await tx.customer.update({
          where: { id: repair.customerId },
          data: { totalPurchases: { increment: totalPaid } },
        });
      }
    });

    return this.findOne(tenantId, id);
  }

  async cancel(tenantId: string, id: string, userId: string, reason?: string) {
    const repair = await this.prisma.repairTicket.findFirst({
      where: { id, tenantId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
    });

    if (!repair) {
      throw new NotFoundException('Repair not found or cannot be cancelled');
    }

    // Restore parts if any
    const parts = await this.prisma.repairPart.findMany({
      where: { repairId: id, tenantId },
    });

    await this.prisma.$transaction(async (tx) => {
      // Restore stock for parts
      for (const part of parts) {
        await tx.product.update({
          where: { id: part.productId },
        data: { currentStock: { increment: part.quantityUsed } },
        });
      }

      // Delete parts
      await tx.repairPart.deleteMany({ where: { repairId: id } });

      // Update repair
      await tx.repairTicket.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // Timeline entry
      await tx.repairTimeline.create({
        data: {
          repairId: id,
          tenantId,
          status: 'CANCELLED',
          userId,
          notes: reason || 'Repair cancelled',
        },
      });
    });

    return this.findOne(tenantId, id);
  }
}
