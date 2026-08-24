import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MonnifyClientService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('MONNIFY_BASE_URL') || 'https://sandbox.monnify.com'
    ).replace(/\/+$/, '');
    this.apiKey = this.configService.get<string>('MONNIFY_API_KEY') || '';
    this.secretKey = this.configService.get<string>('MONNIFY_SECRET_KEY') || '';
  }

  async authenticate(): Promise<string> {
    const credentials = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString('base64');
    const url = `${this.baseUrl}/api/v1/auth/login`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(`Monnify authentication failed: ${errorText}`);
    }

    const data = await response.json();
    const accessToken = data?.responseBody?.accessToken;

    if (!accessToken) {
      throw new BadRequestException('Failed to retrieve Monnify access token');
    }

    return accessToken;
  }

  async verifyTransaction(transactionReference: string): Promise<{ status: string; amount: number; raw: any }> {
    const accessToken = await this.authenticate();
    const encodedRef = encodeURIComponent(transactionReference);
    const url = `${this.baseUrl}/api/v2/transactions/${encodedRef}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(`Monnify transaction verification failed: ${errorText}`);
    }

    const data = await response.json();
    const body = data?.responseBody;

    const paymentStatus = body?.paymentStatus || body?.status;
    const amountPaid = body?.amountPaid ?? body?.amount ?? 0;

    return {
      status: paymentStatus,
      amount: Number(amountPaid),
      raw: body,
    };
  }
}
