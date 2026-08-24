import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InitiateTransactionParams {
  amount: number;
  customerEmail: string;
  customerName: string;
  goalId: string;
  metaData?: Record<string, any>;
}

@Injectable()
export class MonnifyClientService {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly contractCode: string;
  private readonly redirectUrl: string;
  private readonly isMock: boolean;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (
      this.configService.get<string>('MONNIFY_BASE_URL') || 'https://sandbox.monnify.com'
    ).replace(/\/+$/, '');
    this.apiKey = this.configService.get<string>('MONNIFY_API_KEY') || '';
    this.secretKey = this.configService.get<string>('MONNIFY_SECRET_KEY') || '';
    this.contractCode = this.configService.get<string>('MONNIFY_CONTRACT_CODE') || '';
    this.redirectUrl =
      this.configService.get<string>('MONNIFY_REDIRECT_URL') ||
      'http://localhost:3000/payment/callback';
    this.isMock = this.configService.get<string>('MOCK_MONNIFY') === 'true';
  }

  async authenticate(): Promise<string> {
    if (this.isMock) {
      return 'mock_access_token';
    }

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

  async initiateTransaction(params: InitiateTransactionParams): Promise<{
    checkoutUrl: string;
    transactionReference: string;
    goalId: string;
  }> {
    const paymentReference = `SAFE-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    if (this.isMock) {
      const mockRedirect = `${this.redirectUrl}?paymentReference=${paymentReference}&goalId=${params.goalId}`;
      return {
        checkoutUrl: mockRedirect,
        transactionReference: paymentReference,
        goalId: params.goalId,
      };
    }

    const accessToken = await this.authenticate();
    const url = `${this.baseUrl}/api/v1/merchant/transactions/init-transaction`;

    const redirectWithParams = `${this.redirectUrl}${
      this.redirectUrl.includes('?') ? '&' : '?'
    }goalId=${encodeURIComponent(params.goalId)}&transactionReference=${encodeURIComponent(
      paymentReference,
    )}`;

    const payload = {
      amount: params.amount,
      customerName: params.customerName || 'SafeNest User',
      customerEmail: params.customerEmail,
      paymentReference,
      paymentDescription: `Contribution to goal ${params.goalId}`,
      currencyCode: 'NGN',
      contractCode: this.contractCode,
      redirectUrl: redirectWithParams,
      paymentMethods: ['CARD'],
      metaData: {
        goalId: params.goalId,
        ...params.metaData,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(`Monnify transaction initiation failed: ${errorText}`);
    }

    const data = await response.json();
    const body = data?.responseBody;
    const checkoutUrl = body?.checkoutUrl || body?.redirectUrl;

    if (!checkoutUrl) {
      throw new BadRequestException('Monnify did not return a valid checkout URL');
    }

    return {
      checkoutUrl,
      transactionReference: body?.transactionReference || paymentReference,
      goalId: params.goalId,
    };
  }

  async verifyTransaction(
    transactionReference: string,
  ): Promise<{ status: string; amount: number; raw: any }> {
    if (this.isMock) {
      return {
        status: 'PAID',
        amount: 10000,
        raw: { paymentStatus: 'PAID', amountPaid: 10000, transactionReference },
      };
    }

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
