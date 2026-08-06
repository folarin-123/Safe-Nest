import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterAuthDto } from './dto/register-auth.dto';
import { LoginAuthDto } from './dto/login-auth.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private sanitizeUser(user: any) {
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async register(registerDto: RegisterAuthDto): Promise<AuthResponseDto> {
    const emailExists = await this.usersService.findByEmail(registerDto.email);
    if (emailExists) {
      throw new ConflictException('Email is already registered');
    }

    const phoneExists = await this.usersService.findByPhone(registerDto.phone);
    if (phoneExists) {
      throw new ConflictException('Phone number is already registered');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);
    const user = await this.usersService.createUser({
      email: registerDto.email,
      phone: registerDto.phone,
      passwordHash,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });

    const accessToken = this.signToken(user.id, user.email);
    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  async login(loginDto: LoginAuthDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.markLastLogin(user.id);
    const accessToken = this.signToken(user.id, user.email);
    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  private signToken(userId: string, email: string) {
    return this.jwtService.sign({ sub: userId, email });
  }
}
