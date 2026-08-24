import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BankAccountsService } from './bank-accounts.service';
import { LinkBankAccountDto } from './dto/link-bank-account.dto';
import { AllocateTransactionDto } from './dto/allocate-transaction.dto';

@UseGuards(JwtAuthGuard)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Post('link')
  async linkAccount(@CurrentUser() user: any, @Body() dto: LinkBankAccountDto) {
    return await this.bankAccountsService.linkAccount(user.id, dto.code);
  }

  @Get()
  async listForUser(@CurrentUser() user: any) {
    return await this.bankAccountsService.listForUser(user.id);
  }

  @Delete(':id')
  async unlink(@CurrentUser() user: any, @Param('id') id: string) {
    return await this.bankAccountsService.unlink(user.id, id);
  }

  @Post(':id/sync')
  @HttpCode(HttpStatus.OK)
  async syncAccount(@CurrentUser() user: any, @Param('id') id: string) {
    return await this.bankAccountsService.syncAccount(user.id, id);
  }

  @Get('transactions/pending')
  async listPendingTransactions(@CurrentUser() user: any) {
    return await this.bankAccountsService.listPendingTransactions(user.id);
  }

  @Post('transactions/:id/allocate')
  @HttpCode(HttpStatus.OK)
  async allocateToGoal(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AllocateTransactionDto,
  ) {
    return await this.bankAccountsService.allocateToGoal(user.id, id, dto.goalId);
  }

  @Post('transactions/:id/ignore')
  @HttpCode(HttpStatus.OK)
  async ignoreTransaction(@CurrentUser() user: any, @Param('id') id: string) {
    return await this.bankAccountsService.ignoreTransaction(user.id, id);
  }
}
