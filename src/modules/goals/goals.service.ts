import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import {
  buildGoalResponse,
  buildGoalPlan,
  calculateGoalHealthScore,
  calculateRequiredContribution,
} from './goals.utils';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  

  async create(userId: string, dto: CreateGoalDto) {
    const deadline = dto.deadline;

    const requiredContribution = calculateRequiredContribution(
      dto.targetAmount,
      0,
      deadline,
      dto.contributionFrequency,
    );

    const plan = buildGoalPlan({
      targetAmount: dto.targetAmount,
      currentAmount: 0,
      deadline,
      contributionFrequency: dto.contributionFrequency,
    });
    const health = calculateGoalHealthScore(plan, dto.targetAmount);

    const goal = await this.prisma.goal.create({
      data: {
        userId,
        goalName: dto.goalName,
        category: dto.category,
        targetAmount: dto.targetAmount,
        deadline,
        contributionFrequency: dto.contributionFrequency,
        preferredContribution: dto.preferredContribution,
        requiredContribution,
        description: dto.description,
        priority: dto.priority ?? 0,
        goalHealthScore: health.score,
        status: health.status,
      },
    });

    return buildGoalResponse(goal as unknown as Record<string, unknown>);
  }


  async findAllForUser(userId: string) {
    const goals = await this.prisma.goal.findMany({
      where: { userId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });

    return goals.map((g) => buildGoalResponse(g as unknown as Record<string, unknown>));
  }

  

  async findOne(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: { contributions: { orderBy: { contributionDate: 'desc' } } },
    });

    if (!goal) throw new NotFoundException('Goal not found');

    const response = buildGoalResponse(goal as unknown as Record<string, unknown>);

    return {
      ...response,
      contributions: goal.contributions.map((c: any) => ({
        ...c,
        amount: Number(c.amount ?? 0),
      })),
    };
  }

  

  async update(goalId: string, userId: string, dto: UpdateGoalDto) {
    const existing = await this.prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!existing) throw new NotFoundException('Goal not found');

    if (existing.status === 'ACHIEVED') {
      throw new BadRequestException('Cannot update an already achieved goal');
    }

    const deadline = dto.deadline ? new Date(dto.deadline) : existing.deadline;
    const targetAmount = dto.targetAmount ?? Number(existing.targetAmount);
    const currentAmount = Number(existing.currentAmount);
    const frequency = dto.contributionFrequency ?? existing.contributionFrequency;

    const newRequired = calculateRequiredContribution(
      targetAmount,
      currentAmount,
      deadline,
      frequency,
    );

    const plan = buildGoalPlan({
      targetAmount,
      currentAmount,
      deadline,
      contributionFrequency: frequency,
      createdAt: existing.createdAt,
    });
    const health = calculateGoalHealthScore(plan, targetAmount);

    const [updatedGoal] = await this.prisma.$transaction([
      this.prisma.goal.update({
        where: { id: goalId },
        data: {
          goalName: dto.goalName,
          category: dto.category,
          targetAmount: dto.targetAmount,
          deadline: dto.deadline ? deadline : undefined,
          contributionFrequency: dto.contributionFrequency,
          preferredContribution: dto.preferredContribution,
          description: dto.description,
          priority: dto.priority,
          requiredContribution: newRequired,
          goalHealthScore: health.score,
          status: health.status,
        },
      }),
     
      
      this.prisma.goalAdjustmentHistory.create({
        data: {
          goalId,
          reason: `Goal updated: ${Object.keys(dto).filter((k) => (dto as any)[k] !== undefined).join(', ')}`,
        },
      }),
    ]);

    return buildGoalResponse(updatedGoal as unknown as Record<string, unknown>);
  }
}
