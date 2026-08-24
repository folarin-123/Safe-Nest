import { Injectable, BadRequestException } from '@nestjs/common';
import { MonnifyClientService } from './monnify-client.service';
import { ContributionsService } from '../contributions/contributions.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly monnifyClientService: MonnifyClientService,
    private readonly contributionsService: ContributionsService,
  ) {}

  async verifyPayment(userId: string, dto: VerifyPaymentDto) {
    const verification = await this.monnifyClientService.verifyTransaction(
      dto.transactionReference,
    );

    if (verification.status !== 'PAID') {
      throw new BadRequestException(
        `Payment has not been completed. Status: ${verification.status}`,
      );
    }

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
  }
}
