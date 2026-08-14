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

    void this.sendWelcomeEmail(user.email, user.fullName).catch((error) => {
      this.logger.warn(
        'Welcome email could not be sent',
        error as Error,
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
    return this.emailService.sendMail({
      to: email,
      subject: 'Welcome to SafeNest',
      text: `Hi ${fullName},

Thanks for registering with SafeNest. Your account is now active and ready to use.

If you need support, reply to this email or visit our support page.

Best regards,
The SafeNest team`,
      html: `<p>Hi ${fullName},</p>
<p>Thanks for registering with <strong>SafeNest</strong>. Your account is now active and ready to use.</p>
<p>If you need support, reply to this email or visit our support page.</p>
<p>Best regards,<br/>The SafeNest team</p>`,
    });
  }

  async login(dto: LoginAuthDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('This account has been deactivated');
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