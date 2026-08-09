import {
  BadRequestException,
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { AuthResult, SafeUser } from './auth.types';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private toSafeUser(user: {
    id: string;
    email: string;
    phone: string;
    fullName: string;
    createdAt: Date;
  }): SafeUser {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      createdAt: user.createdAt,
    };
  }

  async register(dto: RegisterAuthDto): Promise<AuthResult> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password and confirmation password must match');
    }

    const existingByEmail = await this.usersService.findByEmail(dto.email);
    if (existingByEmail) {
      throw new ConflictException('An account with this email already exists');
    }

    const existingByPhone = await this.usersService.findByPhone(dto.phone);
    if (existingByPhone) {
      throw new ConflictException('An account with this phone number already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await this.usersService.createUser({
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      fullName: dto.fullName,
    });

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return { user: this.toSafeUser(user), accessToken };
  }

  async login(dto: LoginAuthDto): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.usersService.markLastLogin(user.id);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
    });

    return { user: this.toSafeUser(user), accessToken };
  }
}
