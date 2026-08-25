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
import { ChangePasswordDto } from './dto/change-password.dto'; // <-- Added Import

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
    const user = await this.usersService.findByEmail(email);
    if (!user) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000,
    );

    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id },
    });

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    const baseUrl = this.configService.getOrThrow<string>('APP_BASE_URL');
    const resetUrl = `${baseUrl}/reset-password/${rawToken}`;

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

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const resetRecord = await this.prisma.passwordReset.findFirst({
      where: { tokenHash },
    });

    if (
      !resetRecord ||
      resetRecord.used ||
      resetRecord.expiresAt < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

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

  // ── Change Password (Authenticated User) ───────────────────────────────────

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation must match');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('OAuth users cannot change passwords directly. Please use forgot password.');
    }

    const isOldPasswordValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new BadRequestException('Incorrect current password');
    }

    // Prevent changing to the exact same password
    const isSamePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  // ── OAuth Login (Google / Facebook) ────────────────────────────────────────

  async handleOAuthLogin(input: OAuthLoginInput): Promise<AuthResult> {
    const { provider, providerId, email, fullName } = input;

    if (!email) {
      throw new InternalServerErrorException(
        `${provider} did not return an email address. Make sure the email scope is enabled.`,
      );
    }

    let user: Awaited<ReturnType<UsersService['createOAuthUser']>> | null =
      await this.usersService.findByEmail(email);

    if (user) {
      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is not active');
      }

      await this.usersService.linkOAuthProvider(user.id, provider, providerId);
    } else {
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