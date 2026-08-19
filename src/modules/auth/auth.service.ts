import {
  BadRequestException,
  Injectable,
  ConflictException,
  Logger,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { EmailService } from '../../common/email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { AuthResult, SafeUser } from './auth.types';
import { AnalyticsService } from '../analytics/analytics.service';

const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_MINUTES = 15;

export interface OAuthLoginInput {
  provider: 'google' | 'facebook';
  providerId: string;
  email: string;
  fullName: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  private toSafeUser(user: {
    id: string;
    email: string;
    phone: string | null;
    fullName: string;
    createdAt?: Date;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      createdAt: user.createdAt ?? new Date(),
    };
  }

  // ── Register ───────────────────────────────────────────────────────────────

  async register(dto: RegisterAuthDto): Promise<AuthResult> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException(
        'Password and confirmation password must match',
      );
    }

    const existingByEmail = await this.usersService.findByEmail(dto.email);

    if (existingByEmail) {
      throw new ConflictException(
        'An account with this email already exists',
      );
    }

    const existingByPhone = await this.usersService.findByPhone(dto.phone);

    if (existingByPhone) {
      throw new ConflictException(
        'An account with this phone number already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.usersService.createUser({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      fullName: dto.fullName,
      status: 'ACTIVE',
    });

    void this.analyticsService.trackEvent('user_signed_up', {
      signing_method: 'Email',
      user_role: 'user',
      timestamp: new Date().toISOString(),
    }, user.id);

    void this.sendWelcomeEmail(user.email, user.fullName).catch((error: unknown) => {
      this.logger.warn(
        `Welcome email could not be sent: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      user: this.toSafeUser(user),
      accessToken,
    };
  }

  private async sendWelcomeEmail(email: string, fullName: string) {
    return this.emailService.sendTemplate(email, 'welcome', { fullName });
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginAuthDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const isPasswordValid = user.passwordHash
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.usersService.markLastLogin(user.id);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      user: this.toSafeUser(user),
      accessToken,
    };
  }

  // ── Forgot Password ────────────────────────────────────────────────────────

  async forgotPassword(email: string): Promise<void> {
    // Look up the user — if not found we still return silently to prevent
    // email enumeration attacks.
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    // Generate a cryptographically-secure raw token and its SHA-256 hash.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000,
    );

    // Remove any previous tokens for this user so only one active reset
    // link exists at a time.
    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    // Persist the hashed token — never store the raw token in the database.
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const baseUrl = this.configService.getOrThrow<string>('APP_BASE_URL');
    const resetUrl = `${baseUrl}/reset-password/${rawToken}`;

    // Fire-and-forget — email failure must not break the flow.
    void this.emailService
      .sendTemplate(user.email, 'reset-password', {
        fullName: user.fullName,
        resetUrl,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send password-reset email to ${user.email}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
  }

  // ── Reset Password ─────────────────────────────────────────────────────────

  async resetPassword(
    rawToken: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException(
        'Password and confirmation password must match',
      );
    }

    // Hash the incoming raw token to look up the stored record.
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: { tokenHash },
    });

    // Use a single opaque error for all invalid-token states to prevent
    // timing-based probing of which condition failed.
    if (
      !resetRecord ||
      resetRecord.used ||
      resetRecord.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Atomically update the user's password and mark the token as used.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash: newPasswordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true },
      }),
    ]);
  }

  // ── OAuth Login (Google / Facebook) ────────────────────────────────────────

  async handleOAuthLogin(input: OAuthLoginInput): Promise<AuthResult> {
    const { provider, providerId, email, fullName } = input;

    if (!email) {
      throw new InternalServerErrorException(
        `${provider} did not return an email address. Make sure the email scope is enabled.`,
      );
    }

    // Look up existing user by email — handles account-linking automatically.
    let user: Awaited<ReturnType<UsersService['createOAuthUser']>> | null =
      await this.usersService.findByEmail(email);

    if (user) {
      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is not active');
      }

      // ── Account linking ─────────────────────────────────────────────────
      // The user already exists (email/password or another OAuth provider).
      // Link the new provider without touching their password.
      await this.usersService.linkOAuthProvider(user.id, provider, providerId);
    } else {
      // ── New OAuth user ──────────────────────────────────────────────────
      user = await this.usersService.createOAuthUser({
        email,
        fullName,
        oauthProvider: provider,
        oauthProviderId: providerId,
      });

      void this.analyticsService.trackEvent('user_signed_up', {
        signing_method: provider === 'google' ? 'Google' : 'Facebook',
        user_role: 'user',
        timestamp: new Date().toISOString(),
      }, user.id);

      // Welcome email — fire-and-forget.
      void this.sendWelcomeEmail(email, fullName).catch((err: unknown) =>
        this.logger.warn(
          `Welcome email failed for OAuth user ${email}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
    }

    if (!user) {
      throw new InternalServerErrorException('Unable to complete OAuth login');
    }

    await this.usersService.markLastLogin(user.id);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return {
      user: this.toSafeUser(user),
      accessToken,
    };
  }
}