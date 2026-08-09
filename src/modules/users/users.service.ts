import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const safeUserSelect = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  isActive: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
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
    phone: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
  }) {
    try {
      return await this.prisma.user.create({
        data: {
          email: data.email,
          phone: data.phone,
          passwordHash: data.passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
        },
        select: safeUserSelect,
      });
    } catch (error) {
      this.throwIfUniqueConstraint(error);
      throw error;
    }
  }

  async updateUser(id: string, data: { firstName?: string; lastName?: string; phone?: string }) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
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
