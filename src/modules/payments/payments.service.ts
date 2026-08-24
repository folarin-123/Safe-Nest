import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { MonnifyClientService } from './monnify-client.service';
import { ContributionsService } from '../contributions/contributions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { GoalStatus } from '@prisma/client';
import { calculateRequiredContribution } from '../goals/goals.utils';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly monnifyClientService: MonnifyClientService,
    private readonly contributionsService: ContributionsService,
    private readonly prisma: PrismaService,
  ) {}

  async initiatePayment(userId: string, user: any, dto: InitiatePaymentDto) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: dto.goalId, userId },
    });

    if (!goal) {
      throw new NotFoundException('Goal not found or does not belong to user');
    }

    if (goal.status === GoalStatus.ACHIEVED) {
      throw new BadRequestException('Cannot initiate payment for an already achieved goal');
    }

    let amount = dto.amount;

    if (!amount || amount <= 0) {
      const remaining = goal.targetAmount.toNumber() - goal.currentAmount.toNumber();
      const required = calculateRequiredContribution(
        goal.targetAmount.toNumber(),
        goal.currentAmount.toNumber(),
        goal.deadline,
        goal.contributionFrequency,
      );

      amount = required > 0 ? required : remaining;
      if (amount <= 0) {
        amount = remaining > 0 ? remaining : 1000;
      }
    }

    return this.monnifyClientService.initiateTransaction({
      amount,
      customerEmail: user.email,
      customerName: user.fullName || user.email,
      goalId: dto.goalId,
    });
  }

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const verification = await this.monnifyClientService.verifyTransaction(
      dto.transactionReference,
    );

    if (verification.status !== 'PAID') {
      throw new BadRequestException(
        `Payment has not been completed. Status: ${verification.status}`,
      );
    }

    try {
      const contributionResult = await this.contributionsService.create(
        dto.goalId,
        userId,
        {
          amount: verification.amount,
          contributionDate: new Date().toISOString(),
          trackingType: 'BANK_SYNC',
          externalReference: dto.transactionReference,
        },
      );

      return {
        success: true,
        message: 'Payment verified and contribution recorded successfully',
        verificationDetails: verification,
        ...contributionResult,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(
          'Payment has already been processed for this transaction reference',
        );
      }
      throw error;
    }
  }

  async handleWebhook(payload: any) {
    const event = payload?.event || payload?.eventType;
    const data = payload?.eventData || payload?.data || payload;

    if (event === 'SUCCESSFUL_TRANSACTION' || data?.paymentStatus === 'PAID') {
      const transactionReference = data?.transactionReference || data?.paymentReference;
      const goalId = data?.metaData?.goalId;
      const userId = data?.metaData?.userId;

      if (transactionReference && goalId && userId) {
        try {
          await this.verifyPayment(userId, { transactionReference, goalId });
        } catch {
          // Silent ignore if already processed or invalid
        }
      }
    }

    return { received: true };
  }
}
