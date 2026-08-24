import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContributionsModule } from '../contributions/contributions.module';
import { BankAccountsController } from './bank-accounts.controller';
import { MonoWebhookController } from './mono-webhook.controller';
import { BankAccountsService } from './bank-accounts.service';
import { MonoClientService } from './mono-client.service';

@Module({
  imports: [PrismaModule, ContributionsModule],
  controllers: [BankAccountsController, MonoWebhookController],
  providers: [BankAccountsService, MonoClientService],
  exports: [BankAccountsService],
})
export class BankAccountsModule {}
