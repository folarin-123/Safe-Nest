import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountStatus } from '@prisma/client';

const safeUserSelect = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        phone: true,
        passwordHash: true,
        fullName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({
      where: { phone },
      select: { id: true },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
  }

  async createUser(data: {
    email: string;
    phone?: string | null;
    passwordHash?: string | null;
    fullName: string;
    status?: AccountStatus;
    isVerified?: boolean;
    oauthProvider?: string;
    oauthProviderId?: string;
  }) {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email,
          phone: data.phone ?? null,
          passwordHash: data.passwordHash ?? null,
          fullName: data.fullName,
          status: data.status ?? 'ACTIVE',
          isVerified: data.isVerified ?? true,
          oauthProvider: data.oauthProvider,
          oauthProviderId: data.oauthProviderId,
        },
        select: safeUserSelect,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }
  }

  async createOAuthUser(data: {
    email: string;
    fullName: string;
    oauthProvider: string;
    oauthProviderId: string;
  }) {
    return this.createUser({
      ...data,
      phone: null,
      passwordHash: null,
      status: 'ACTIVE',
      isVerified: true,
    });
  }

  async linkOAuthProvider(userId: string, provider: string, providerId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        oauthProvider: provider,
        oauthProviderId: providerId,
        isVerified: true,
      },
      select: safeUserSelect,
    });
  }

  async updateUser(
    id: string,
    data: {
      fullName?: string;
      phone?: string;
      status?: AccountStatus;
      isVerified?: boolean;
    },
  ) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          fullName: data.fullName,
          phone: data.phone,
          status: data.status,
          isVerified: data.isVerified,
        },
        select: safeUserSelect,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }
  }

  async markLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
      select: { id: true },
    });
  }

  private throwIfUniqueConstraint(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Email or phone number is already in use');
    }
  }
}