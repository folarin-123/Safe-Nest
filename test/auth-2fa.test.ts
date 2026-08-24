import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { AuthService } from '../src/modules/auth/auth.service';
import * as otplib from 'otplib';
import * as bcrypt from 'bcrypt';

describe('AuthService - 2FA Features', () => {
  let mockUsersService: any;
  let mockJwtService: any;
  let mockEmailService: any;
  let mockPrisma: any;
  let mockConfigService: any;
  let mockAnalyticsService: any;
  let authService: AuthService;

  beforeEach(() => {
    mockUsersService = {
      findByEmail: async () => null,
      findRawById: async () => null,
      markLastLogin: async () => {},
    };
    mockJwtService = {
      sign: (payload: any) => 'mock_token',
      verify: (token: string) => ({ sub: 'user_1', mfaPending: true }),
    };
    mockEmailService = {};
    mockPrisma = {
      user: {
        update: async (args: any) => ({ id: args.where.id, ...args.data }),
      },
    };
    mockConfigService = {};
    mockAnalyticsService = {};

    authService = new AuthService(
      mockUsersService,
      mockJwtService,
      mockEmailService,
      mockPrisma,
      mockConfigService,
      mockAnalyticsService,
    );
  });

  it('returns challengeToken on login if user has mfaEnabled', async () => {
    const passHash = await bcrypt.hash('password123', 10);
    mockUsersService.findByEmail = async () => ({
      id: 'user_1',
      email: 'test@example.com',
      passwordHash: passHash,
      status: 'ACTIVE',
      mfaEnabled: true,
    });

    const result: any = await authService.login({
      email: 'test@example.com',
      password: 'password123',
    });

    assert.strictEqual(result.mfaRequired, true);
    assert.strictEqual(result.challengeToken, 'mock_token');
  });

  it('verifies 2fa code correctly during verifyLogin2fa', async () => {
    const secret = otplib.generateSecret();
    const validCode = otplib.generateSync({ secret });

    mockUsersService.findRawById = async () => ({
      id: 'user_1',
      email: 'test@example.com',
      status: 'ACTIVE',
      mfaEnabled: true,
      mfaSecret: secret,
    });

    const result = await authService.verifyLogin2FA('mock_token', validCode);
    assert.strictEqual(result.accessToken, 'mock_token');
    assert.strictEqual(result.user.id, 'user_1');
  });
});
