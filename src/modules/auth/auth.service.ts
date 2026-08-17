import {
  BadRequestException,
  Injectable,
  ConflictException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { EmailService } from '../../common/email/email.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthResult, SafeUser } from './auth.types';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  private toSafeUser(user: {
    id: string;
    email: string;
    phone: string;
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

  async register(dto: RegisterAuthDto): Promise<AuthResult | { message: string }> {
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

    // Generate a 6-digit verification code & set expiration (15 mins from now)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000);

    const user = await this.usersService.createUser({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      fullName: dto.fullName,
      status: 'PENDING_VERIFICATION',
      isVerified: false,
      verificationCode,
      verificationExpires,
    });

    void this.sendWelcomeEmail(user.email, user.fullName, verificationCode).catch((error: unknown) => {
      this.logger.warn(
        `Welcome email could not be sent: ${error instanceof Error ? error.message : String(error)}`,
      );
    });

    return {
      message: 'Registration successful. Please check your email for the 6-digit verification code.',
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      return { message: 'Account is already verified.' };
    }

    if (
      user.verificationCode !== dto.code ||
      !user.verificationExpires ||
      user.verificationExpires < new Date()
    ) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.usersService.updateUser(user.id, {
      isVerified: true,
      status: 'ACTIVE',
      verificationCode: null,
      verificationExpires: null,
    });

    return { message: 'Account successfully verified. You can now log in.' };
  }

private async sendWelcomeEmail(email: string, fullName: string, code: string) {
    return this.emailService.sendTemplate(email, 'welcome', { fullName, code } as any);
  }

  async login(dto: LoginAuthDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Please verify your account before logging in');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

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
}