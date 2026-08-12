import { Prisma } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpsertFinancialProfileDto } from './dto/update-financial-profile.dto';

@Injectable()
export class FinancialProfileService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /api/v1/financial-profile */
  async getProfile(userId: string) {
    const profile = await this.prisma.userFinancialProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Financial profile not found');
    return this.serialize(profile);
  }

  /**
   * POST /api/v1/financial-profile
   * Creates a new profile or updates it if one already exists (upsert).
   */
  async createOrUpdate(userId: string, dto: UpsertFinancialProfileDto) {
    const payload = {
      monthlyIncome: dto.monthlyIncome,
      incomeFrequency: dto.incomeFrequency,
      fixedExpenses: (dto.fixedExpenses ?? undefined) as Prisma.InputJsonValue | undefined,
      variableExpenses: (dto.variableExpenses ?? undefined) as Prisma.InputJsonValue | undefined,
      existingSavings: dto.existingSavings,
      existingCommitments: (dto.existingCommitments ?? undefined) as Prisma.InputJsonValue | undefined,
    };

    const profile = await this.prisma.userFinancialProfile.upsert({
      where: { userId },
      update: payload,
      create: { userId, ...payload },
    });
    return this.serialize(profile);
  }

  /**
   * PUT /api/v1/financial-profile
   * Partial update — profile must already exist.
   */
  async updateProfile(userId: string, dto: UpsertFinancialProfileDto) {
    const existing = await this.prisma.userFinancialProfile.findUnique({ where: { userId } });
    if (!existing) throw new NotFoundException('Financial profile not found');
    return this.createOrUpdate(userId, dto);
  }

  private serialize(profile: Record<string, any>) {
    return {
      ...profile,
      monthlyIncome: profile.monthlyIncome != null ? Number(profile.monthlyIncome) : null,
      existingSavings: profile.existingSavings != null ? Number(profile.existingSavings) : null,
      updatedAt: profile.updatedAt instanceof Date ? profile.updatedAt.toISOString() : profile.updatedAt,
    };
  }
}
