import { Prisma } from '@prisma/client';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinancialProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.userFinancialProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Financial profile not found');
    }

    return {
      ...profile,
      incomeAmount: profile.incomeAmount ? Number(profile.incomeAmount) : null,
      existingSavings: profile.existingSavings ? Number(profile.existingSavings) : null,
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  async updateProfile(
    userId: string,
    data: Partial<{
      incomeAmount: number;
      incomeFrequency: string;
      fixedExpenses: unknown;
      variableExpenses: unknown;
      existingSavings: number;
      existingCommitments: unknown;
    }>,
  ) {
    const existingProfile = await this.prisma.userFinancialProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      throw new NotFoundException('Financial profile not found');
    }

    const updatedProfile = await this.prisma.userFinancialProfile.update({
      where: { userId },
      data: {
        incomeAmount: data.incomeAmount,
        incomeFrequency: data.incomeFrequency,
        fixedExpenses: data.fixedExpenses,
        variableExpenses: data.variableExpenses,
        existingSavings: data.existingSavings,
        existingCommitments: data.existingCommitments,
      },
    });

    return {
      ...updatedProfile,
      incomeAmount: updatedProfile.incomeAmount ? Number(updatedProfile.incomeAmount) : null,
      existingSavings: updatedProfile.existingSavings ? Number(updatedProfile.existingSavings) : null,
      updatedAt: updatedProfile.updatedAt.toISOString(),
    };
  }
}
