import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MonoClientService } from '../src/modules/bank-accounts/mono-client.service';
import { ConfigService } from '@nestjs/config';

describe('MonoClientService', () => {
  it('instantiates with config values', () => {
    const configMap: Record<string, string> = {
      MONO_BASE_URL: 'https://api.withmono.com',
      MONO_SECRET_KEY: 'test_sec_key',
    };
    const configService = {
      get: (key: string) => configMap[key],
    } as unknown as ConfigService;

    const service = new MonoClientService(configService);
    assert.ok(service);
  });

  it('exchanges code for account id with top-level id response', async () => {
    const configService = {
      get: (key: string) => key === 'MONO_SECRET_KEY' ? 'test_sec_key' : 'https://api.withmono.com',
    } as unknown as ConfigService;

    const service = new MonoClientService(configService);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      assert.strictEqual(url.toString(), 'https://api.withmono.com/account/auth');
      const headers = init?.headers as Record<string, string>;
      assert.strictEqual(headers['mono-sec-key'], 'test_sec_key');
      return {
        ok: true,
        json: async () => ({ id: 'acc_12345' }),
      } as Response;
    }) as typeof fetch;

    try {
      const accountId = await service.exchangeCodeForAccountId('code_xyz');
      assert.strictEqual(accountId, 'acc_12345');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('exchanges code for account id with nested data.id response', async () => {
    const configService = {
      get: (key: string) => key === 'MONO_SECRET_KEY' ? 'test_sec_key' : 'https://api.withmono.com',
    } as unknown as ConfigService;

    const service = new MonoClientService(configService);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      assert.strictEqual(url.toString(), 'https://api.withmono.com/account/auth');
      return {
        ok: true,
        json: async () => ({ data: { id: 'acc_67890' } }),
      } as Response;
    }) as typeof fetch;

    try {
      const accountId = await service.exchangeCodeForAccountId('code_xyz');
      assert.strictEqual(accountId, 'acc_67890');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
