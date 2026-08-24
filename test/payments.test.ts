import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MonnifyClientService } from '../src/modules/payments/monnify-client.service';
import { ConfigService } from '@nestjs/config';

describe('MonnifyClientService', () => {
  it('instantiates correctly with config service', () => {
    const configService = {
      get: (key: string) => {
        if (key === 'MONNIFY_BASE_URL') return 'https://sandbox.monnify.com';
        if (key === 'MONNIFY_API_KEY') return 'test_api_key';
        if (key === 'MONNIFY_SECRET_KEY') return 'test_secret_key';
        return null;
      },
    } as unknown as ConfigService;

    const service = new MonnifyClientService(configService);
    assert.ok(service);
  });

  it('authenticates and gets access token', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'MONNIFY_BASE_URL') return 'https://sandbox.monnify.com';
        if (key === 'MONNIFY_API_KEY') return 'test_api_key';
        if (key === 'MONNIFY_SECRET_KEY') return 'test_secret_key';
        return null;
      },
    } as unknown as ConfigService;

    const service = new MonnifyClientService(configService);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.strictEqual(url.toString(), 'https://sandbox.monnify.com/api/v1/auth/login');
      const expectedCreds = Buffer.from('test_api_key:test_secret_key').toString('base64');
      assert.strictEqual(init?.headers?.['Authorization' as keyof typeof init.headers], `Basic ${expectedCreds}`);
      return {
        ok: true,
        json: async () => ({
          requestSuccessful: true,
          responseBody: { accessToken: 'mock_token_123' },
        }),
      } as Response;
    }) as typeof fetch;

    try {
      const token = await service.authenticate();
      assert.strictEqual(token, 'mock_token_123');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('verifies transaction', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'MONNIFY_BASE_URL') return 'https://sandbox.monnify.com';
        if (key === 'MONNIFY_API_KEY') return 'test_api_key';
        if (key === 'MONNIFY_SECRET_KEY') return 'test_secret_key';
        return null;
      },
    } as unknown as ConfigService;

    const service = new MonnifyClientService(configService);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/v1/auth/login')) {
        return {
          ok: true,
          json: async () => ({ responseBody: { accessToken: 'token_abc' } }),
        } as Response;
      }
      if (urlStr.includes('/api/v2/transactions/REF123')) {
        assert.strictEqual(init?.headers?.['Authorization' as keyof typeof init.headers], 'Bearer token_abc');
        return {
          ok: true,
          json: async () => ({
            responseBody: {
              paymentStatus: 'PAID',
              amountPaid: 5000,
            },
          }),
        } as Response;
      }
      throw new Error(`Unexpected URL: ${urlStr}`);
    }) as typeof fetch;

    try {
      const res = await service.verifyTransaction('REF123');
      assert.strictEqual(res.status, 'PAID');
      assert.strictEqual(res.amount, 5000);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
