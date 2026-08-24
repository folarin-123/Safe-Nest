import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BankAccountStatus, BankTxStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MonoClientService } from './mono-client.service';
import { ContributionsService } from '../contributions/contributions.service';

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly monoClientService: MonoClientService,
    private readonly contributionsService: ContributionsService,
  ) {}

  async linkAccount(userId: string, code: string) {
    const providerAccountId = await this.monoClientService.exchangeCodeForAccountId(code);

    const existingAccount = await this.prisma.bankAccount.findUnique({
      where: { providerAccountId },
    });

    if (existingAccount) {
      if (existingAccount.userId === userId) {
        if (existingAccount.status === BankAccountStatus.UNLINKED) {
          return await this.prisma.bankAccount.update({
            where: { id: existingAccount.id },
            data: { status: BankAccountStatus.ACTIVE },
          });
        }
        return existingAccount;
      } else {
        throw new BadRequestException('Account already linked by another user');
      }
    }

    const details = await this.monoClientService.getAccountDetails(providerAccountId);
    const acc = details?.account || details?.data?.account || details?.data || details;

    const accountName = acc?.name || acc?.accountName || acc?.account_name || null;
    const accountNumber = acc?.accountNumber || acc?.account_number || acc?.accountNumber || null;
    const bankName = acc?.institution?.name || acc?.bankName || acc?.bank_name || acc?.institution || null;
    const currency = acc?.currency || 'NGN';

    return await this.prisma.bankAccount.create({
      data: {
        userId,
        providerAccountId,
        accountName,
        accountNumber,
        bankName,
        currency,
        status: BankAccountStatus.ACTIVE,
      },
    });
  }

  async listForUser(userId: string) {
    return await this.prisma.bankAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async unlink(userId: string, bankAccountId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId },
    });

    if (!account) {
      throw new NotFoundException('Bank account not found');
    }

    return await this.prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { status: BankAccountStatus.UNLINKED },
    });
  }

  async syncAccount(userId: string, bankAccountId: string) {
    const account = await this.prisma.bankAccount.findFirst({
      where: { id: bankAccountId, userId },
    });

    if (!account) {
      throw new NotFoundException('Bank account not found');
    }

    const response = await this.monoClientService.getTransactions(account.providerAccountId);
    const txList: any[] = Array.isArray(response)
      ? response
      : Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.transactions)
      ? response.transactions
      : [];

    let newTransactionsCount = 0;

    for (const tx of txList) {
      const providerTransactionId = tx._id || tx.id || tx.providerTransactionId;
      if (!providerTransactionId) continue;

      const rawAmount = tx.amount ?? 0;
      const amountInMajor = new Prisma.Decimal(rawAmount.toString()).div(100);
      const narration = tx.narration || tx.description || null;
      const transactionType = (tx.type || tx.transactionType || 'credit').toLowerCase();
      const transactionDate = tx.date ? new Date(tx.date) : new Date();

      try {
        await this.prisma.bankTransaction.create({
          data: {
            bankAccountId: account.id,
            userId: account.userId,
            providerTransactionId: String(providerTransactionId),
            amount: amountInMajor,
            narration,
            transactionType,
            transactionDate,
            status: BankTxStatus.PENDING,
            rawPayload: tx,
          },
        });
        newTransactionsCount++;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Unique constraint violation (providerTransactionId) -> skip silently
          continue;
        }
        throw error;
      }
    }

    await this.prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { lastSyncedAt: new Date() },
    });

    return { syncedCount: newTransactionsCount, totalFetched: txList.length };
  }

  async handleIncomingTransaction(monoAccountId: string, tx: any) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { providerAccountId: monoAccountId },
    });

    if (!account) {
      throw new NotFoundException(`Bank account with provider ID ${monoAccountId} not found`);
    }

    const providerTransactionId = tx._id || tx.id || tx.providerTransactionId;
    if (!providerTransactionId) return null;

    const rawAmount = tx.amount ?? 0;
    const amountInMajor = new Prisma.Decimal(rawAmount.toString()).div(100);
    const narration = tx.narration || tx.description || null;
    const transactionType = (tx.type || tx.transactionType || 'credit').toLowerCase();
    const transactionDate = tx.date ? new Date(tx.date) : new Date();

    try {
      return await this.prisma.bankTransaction.create({
        data: {
          bankAccountId: account.id,
          userId: account.userId,
          providerTransactionId: String(providerTransactionId),
          amount: amountInMajor,
          narration,
          transactionType,
          transactionDate,
          status: BankTxStatus.PENDING,
          rawPayload: tx,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  async listPendingTransactions(userId: string) {
    return await this.prisma.bankTransaction.findMany({
      where: {
        userId,
        status: BankTxStatus.PENDING,
        transactionType: { in: ['credit', 'CREDIT'] },
      },
      orderBy: { transactionDate: 'desc' },
      include: {
        bankAccount: {
          select: {
            accountName: true,
            accountNumber: true,
            bankName: true,
          },
        },
      },
    });
  }

  async allocateToGoal(userId: string, bankTransactionId: string, goalId: string) {
    const tx = await this.prisma.bankTransaction.findFirst({
      where: { id: bankTransactionId, userId },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.status !== BankTxStatus.PENDING) {
      throw new BadRequestException(`Transaction is already ${tx.status.toLowerCase()}`);
    }

    const contributionDate = tx.transactionDate.toISOString();
    const amountNumber = tx.amount.toNumber();

    const contributionResult = await this.contributionsService.create(goalId, userId, {
      amount: amountNumber,
      contributionDate,
      trackingType: 'BANK_SYNC',
      externalReference: tx.providerTransactionId,
    });

    const contributionId = contributionResult.contribution.id;

    const updatedTx = await this.prisma.bankTransaction.update({
      where: { id: bankTransactionId },
      data: {
        status: BankTxStatus.ALLOCATED,
        allocatedGoalId: goalId,
        allocatedContributionId: contributionId,
      },
    });

    return { transaction: updatedTx, contribution: contributionResult };
  }

  async ignoreTransaction(userId: string, bankTransactionId: string) {
    const tx = await this.prisma.bankTransaction.findFirst({
      where: { id: bankTransactionId, userId },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    return await this.prisma.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { status: BankTxStatus.IGNORED },
    });
  }
}
