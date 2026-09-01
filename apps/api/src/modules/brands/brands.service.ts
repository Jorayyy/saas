import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateBrandDto {
  name: string;
  slug?: string;
  logo?: string;
}

export interface UpdateBrandDto extends Partial<CreateBrandDto> {
  isActive?: boolean;
}

@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const brands = await this.prisma.brand.findMany({
      where: { tenantId },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });

    return brands.map(b => ({
      ...b,
      productCount: b._count.products,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, tenantId },
      include: {
        products: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, sku: true, sellingPrice: true, currentStock: true },
        },
        _count: { select: { products: true } },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return brand;
  }

  async create(tenantId: string, dto: CreateBrandDto) {
    const slug = dto.slug || this.slugify(dto.name);

    const existing = await this.prisma.brand.findFirst({
      where: { tenantId, slug },
    });

    if (existing) {
      throw new ConflictException('Brand slug already exists');
    }

    return this.prisma.brand.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        logo: dto.logo,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateBrandDto) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, tenantId },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    if (dto.name || dto.slug) {
      const slug = dto.slug || this.slugify(dto.name);
      const existing = await this.prisma.brand.findFirst({
        where: { tenantId, slug, id: { not: id } },
      });

      if (existing) {
        throw new ConflictException('Brand slug already exists');
      }
    }

    return this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.logo !== undefined && { logo: dto.logo }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { products: true } } },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    if (brand._count.products > 0) {
      // Soft delete - mark as inactive
      await this.prisma.brand.update({
        where: { id },
        data: { isActive: false },
      });
      return { message: 'Brand deactivated (has products)' };
    }

    await this.prisma.brand.delete({ where: { id } });
    return { message: 'Brand deleted successfully' };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-');
  }
}
