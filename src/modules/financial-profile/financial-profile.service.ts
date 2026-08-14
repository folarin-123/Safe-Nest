import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Frequency, Prisma } from '@prisma/client';
import { UpsertFinancialProfileDto } from './dto/update-financial-profile.dto';

@Injectable()
export class FinancialProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.userFinancialProfile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Financial profile not found');
    return this.serialize(profile);
  }

  async createOrUpdate(userId: string, dto: UpsertFinancialProfileDto) {
    const payload = {
      incomeAmount: dto.monthlyIncome,
      incomeFrequency: dto.incomeFrequency
        ? (String(dto.incomeFrequency).toUpperCase() as Frequency)
        : undefined,
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

  async updateProfile(userId: string, dto: UpsertFinancialProfileDto) {
    const existing = await this.prisma.userFinancialProfile.findUnique({ where: { userId } });
    if (!existing) throw new NotFoundException('Financial profile not found');
    return this.createOrUpdate(userId, dto);
  }

  private serialize(profile: Record<string, any>) {
    return {
      ...profile,
      monthlyIncome: profile.incomeAmount != null ? Number(profile.incomeAmount) : null,
      incomeAmount: profile.incomeAmount != null ? Number(profile.incomeAmount) : null,
      existingSavings: profile.existingSavings != null ? Number(profile.existingSavings) : null,
      updatedAt: profile.updatedAt instanceof Date ? profile.updatedAt.toISOString() : profile.updatedAt,
    };
  }
}