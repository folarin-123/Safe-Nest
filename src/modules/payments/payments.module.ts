import { Module } from '@nestjs/common';
import { ContributionsModule } from '../contributions/contributions.module';
import { MonnifyClientService } from './monnify-client.service';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [ContributionsModule],
  controllers: [PaymentsController],
  providers: [MonnifyClientService, PaymentsService],
  exports: [PaymentsService, MonnifyClientService],
})
export class PaymentsModule {}
