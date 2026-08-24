import {
  Controller,
  Post,
  Headers,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BankAccountsService } from './bank-accounts.service';

@Controller('webhooks/mono')
export class MonoWebhookController {
  constructor(
    private readonly bankAccountsService: BankAccountsService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('mono-webhook-secret') webhookSecretHeader: string,
    @Body() payload: any,
  ) {
    const expectedSecret = this.configService.get<string>('MONO_WEBHOOK_SECRET');

    if (!expectedSecret || webhookSecretHeader !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const data = payload?.data;
    const monoAccountId =
      typeof data?.account === 'string'
        ? data.account
        : data?.account?._id || data?.account?.id;
    const transaction = data?.transaction;

    if (monoAccountId && transaction) {
      await this.bankAccountsService.handleIncomingTransaction(
        monoAccountId,
        transaction,
      );
    }

    return { received: true };
  }
}
