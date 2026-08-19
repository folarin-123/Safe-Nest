<<<<<<< HEAD
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import {
  buildGoalResponse,
  buildGoalPlan,
  calculateGoalHealthScore,
  calculateRequiredContribution,
} from '../goals/goals.utils';

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) { }


  async create(goalId: string, userId: string, dto: CreateContributionDto) {
    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, userId } });

    if (!goal) throw new NotFoundException('Goal not found');

    if (goal.status === 'ACHIEVED') {
      throw new BadRequestException('Cannot contribute to an already achieved goal');
    }

    const newCurrentAmount = Number(goal.currentAmount) + dto.amount;
    const targetAmount = Number(goal.targetAmount);
    const isAchieved = newCurrentAmount >= targetAmount;

    const newRequiredContribution = isAchieved
      ? 0
      : calculateRequiredContribution(
        targetAmount,
        newCurrentAmount,
        goal.deadline,
        goal.contributionFrequency,
      );


    const plan = buildGoalPlan({
      targetAmount,
      currentAmount: newCurrentAmount,
      deadline: goal.deadline,
      contributionFrequency: goal.contributionFrequency,
      createdAt: goal.createdAt,
    });
    const health = calculateGoalHealthScore(plan, targetAmount);

    const [contribution, updatedGoal] = await this.prisma.$transaction([
      this.prisma.contribution.create({
        data: {
          goalId,
          userId,
          amount: dto.amount,
          sourceType: dto.trackingType,
          trackingType: dto.trackingType,
          contributionDate: new Date(dto.contributionDate),
          externalReference: dto.externalReference,
        },
      }),
      this.prisma.goal.update({
        where: { id: goalId },
        data: {
          currentAmount: newCurrentAmount,
          requiredContribution: newRequiredContribution,
          goalHealthScore: health.score,
          status: isAchieved ? 'ACHIEVED' : (health.status as any),
        },
      }),
    ]);

    return {
      contribution: { ...contribution, amount: Number(contribution.amount ?? 0) },
      goal: buildGoalResponse(updatedGoal as unknown as Record<string, unknown>),
      goalAchieved: isAchieved,
    };
  }

  async findAllForGoal(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new NotFoundException('Goal not found');

    const contributions = await this.prisma.contribution.findMany({
      where: { goalId },
      orderBy: { contributionDate: 'desc' },
    });

    return contributions.map((c) => ({ ...c, amount: Number(c.amount ?? 0) }));
  }
}
=======
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GoalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { buildGoalPlan, buildGoalResponse, calculateGoalHealthScore, calculateRequiredContribution } from '../goals/goals.utils';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@Injectable()
export class ContributionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(goalId: string, userId: string, dto: CreateContributionDto) {
    const amount = new Prisma.Decimal(dto.amount.toString());
    if (!amount.isFinite() || amount.lte(0) || !amount.eq(amount.toDecimalPlaces(2))) {
      throw new BadRequestException('Amount must be positive and contain at most two decimal places');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // The conditional atomic increment serializes concurrent deposits and rejects achieved goals.
        const incremented = await tx.goal.updateMany({
          where: { id: goalId, userId, status: { not: GoalStatus.ACHIEVED } },
          data: { currentAmount: { increment: amount } },
        });
        if (incremented.count === 0) {
          const goal = await tx.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
          if (!goal) throw new NotFoundException('Goal not found');
          throw new BadRequestException('Cannot contribute to an already achieved goal');
        }

        const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
        const plan = buildGoalPlan({ targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, deadline: goal.deadline, contributionFrequency: goal.contributionFrequency, createdAt: goal.createdAt });
        const health = calculateGoalHealthScore(plan, goal.targetAmount);
        const status = plan.status === 'ACHIEVED' ? GoalStatus.ACHIEVED : health.status as GoalStatus;
        const requiredContribution = status === GoalStatus.ACHIEVED ? 0 : calculateRequiredContribution(goal.targetAmount, goal.currentAmount, goal.deadline, goal.contributionFrequency);

        const contribution = await tx.contribution.create({
          data: { goalId, userId, amount, sourceType: dto.trackingType, trackingType: dto.trackingType, contributionDate: new Date(dto.contributionDate), externalReference: dto.externalReference ?? null },
        });
        const updatedGoal = await tx.goal.update({
          where: { id: goalId },
          data: { requiredContribution, goalHealthScore: health.score, status },
        });
        return { contribution: { ...contribution, amount: contribution.amount.toFixed(2) }, goal: buildGoalResponse(updatedGoal as unknown as Record<string, unknown>), goalAchieved: status === GoalStatus.ACHIEVED };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A contribution with this external reference has already been processed');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Contribution conflicted with another update. Please retry.');
      }
      throw error;
    }
  }

async findAllForGoal(goalId: string, userId: string, paginationDto: PaginationDto) {

    const { page = 1, limit = 10 } = paginationDto;

    const skip = (page - 1) * limit;

    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } });
    if (!goal) throw new NotFoundException('Goal not found');


    const [contributions, total] = await Promise.all([
      this.prisma.contribution.findMany({
        where: { goalId },
        orderBy: { contributionDate: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.contribution.count({ where: { goalId } })
    ]);

    const data = contributions.map((contribution) => ({
      ...contribution,
      amount: contribution.amount.toFixed(2)
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}
>>>>>>> origin/main
