import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MonoClientService {
  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('MONO_BASE_URL') || 'https://api.withmono.com'
    ).replace(/\/+$/, '');
    this.secretKey = this.configService.get<string>('MONO_SECRET_KEY') || '';
  }

  private getHeaders(): Record<string, string> {
    return {
      'mono-sec-key': this.secretKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async exchangeCodeForAccountId(code: string): Promise<string> {
    const url = `${this.baseUrl}/account/auth`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(
        `Mono account auth failed (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();
    const accountId = data?.id || data?.data?.id;

    if (!accountId || typeof accountId !== 'string') {
      throw new BadRequestException('Invalid response from Mono account auth');
    }

    return accountId;
  }

  async getAccountDetails(monoAccountId: string): Promise<any> {
    const url = `${this.baseUrl}/accounts/${monoAccountId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(
        `Failed to fetch Mono account details (${response.status}): ${errorText}`,
      );
    }

    return response.json();
  }

  async getTransactions(monoAccountId: string, page = 1): Promise<any> {
    const url = `${this.baseUrl}/accounts/${monoAccountId}/transactions?page=${page}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(
        `Failed to fetch Mono transactions (${response.status}): ${errorText}`,
      );
    }

    return response.json();
  }
}
