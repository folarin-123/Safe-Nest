import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MonnifyClientService } from '../src/modules/payments/monnify-client.service';
import { ConfigService } from '@nestjs/config';

describe('MonnifyClientService - Checkout Flow', () => {
  it('initiates transaction in mock mode', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'MOCK_MONNIFY') return 'true';
        if (key === 'MONNIFY_REDIRECT_URL') return 'http://localhost:3000/payment/callback';
        return null;
      },
    } as unknown as ConfigService;

    const service = new MonnifyClientService(configService);
    const result = await service.initiateTransaction({
      amount: 5000,
      customerEmail: 'test@example.com',
      customerName: 'Test User',
      goalId: 'goal-uuid-123',
    });

    assert.ok(result.checkoutUrl.includes('goal-uuid-123'));
    assert.ok(result.transactionReference.startsWith('SAFE-'));
    assert.strictEqual(result.goalId, 'goal-uuid-123');
  });

  it('verifies transaction in mock mode', async () => {
    const configService = {
      get: (key: string) => {
        if (key === 'MOCK_MONNIFY') return 'true';
        return null;
      },
    } as unknown as ConfigService;

    const service = new MonnifyClientService(configService);
    const result = await service.verifyTransaction('SAFE-12345');

    assert.strictEqual(result.status, 'PAID');
    assert.strictEqual(result.amount, 10000);
  });
});
