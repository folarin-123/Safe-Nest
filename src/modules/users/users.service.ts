import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AccountStatus } from '@prisma/client';
import { CloudinaryService } from '../../common/services/cloudinary.service';
import type {} from 'multer';

const safeUserSelect = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  avatarUrl: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        phone: true,
        passwordHash: true,
        fullName: true,
        avatarUrl: true,
        avatarPublicId: true,
        mfaEnabled: true,
        mfaSecret: true,
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

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File size exceeds 5MB limit');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPublicId: true },
    });

    if (user?.avatarPublicId) {
      await this.cloudinaryService.deleteImage(user.avatarPublicId);
    }

    const folder = `safenest/avatars/${userId}`;
    const { url, publicId } = await this.cloudinaryService.uploadImage(
      file.buffer,
      folder,
    );

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: url,
        avatarPublicId: publicId,
      },
      select: safeUserSelect,
    });
  }

  async deleteAccount(userId: string, password?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.passwordHash) {
      if (!password) {
        throw new BadRequestException('Password is required to deactivate account');
      }
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new BadRequestException('Invalid password');
      }
    }

    const rawDeletedEmail = `deleted_${user.id}_${user.email}`;
    const deletedEmail = rawDeletedEmail.length > 255 ? rawDeletedEmail.substring(0, 255) : rawDeletedEmail;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: 'DEACTIVATED',
        email: deletedEmail,
        phone: null,
      },
    });

    return { message: 'Your account has been deactivated.' };
  }

  async removeAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, avatarPublicId: true },
    });

    if (!user || (!user.avatarUrl && !user.avatarPublicId)) {
      throw new NotFoundException('No avatar exists for this user');
    }

    if (user.avatarPublicId) {
      await this.cloudinaryService.deleteImage(user.avatarPublicId);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: null,
        avatarPublicId: null,
      },
      select: safeUserSelect,
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
  }

  async findRawById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
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




  async getSettings(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return {
        userId,
        pushEnabled: true,
        emailEnabled: true,
        contributionReminder: true,
        missedContributionAlert: true,
        milestoneCelebration: true,
        smartInsights: true,
        emailUpdate: true,
        theme: 'LIGHT',
      };
    }

    return settings;
  }

  async updateSettings(
    userId: string,
    data: {
      contributionReminder?: boolean;
      missedContributionAlert?: boolean;
      milestoneCelebration?: boolean;
      smartInsights?: boolean;
      emailUpdate?: boolean;
      pushEnabled?: boolean;
      emailEnabled?: boolean;
    },
  ) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...(data.contributionReminder !== undefined && { contributionReminder: data.contributionReminder }),
        ...(data.missedContributionAlert !== undefined && { missedContributionAlert: data.missedContributionAlert }),
        ...(data.milestoneCelebration !== undefined && { milestoneCelebration: data.milestoneCelebration }),
        ...(data.smartInsights !== undefined && { smartInsights: data.smartInsights }),
        ...(data.emailUpdate !== undefined && { emailUpdate: data.emailUpdate }),
        ...(data.pushEnabled !== undefined && { pushEnabled: data.pushEnabled }),
        ...(data.emailEnabled !== undefined && { emailEnabled: data.emailEnabled }),
      },
      create: {
        userId,
        contributionReminder: data.contributionReminder ?? true,
        missedContributionAlert: data.missedContributionAlert ?? true,
        milestoneCelebration: data.milestoneCelebration ?? true,
        smartInsights: data.smartInsights ?? true,
        emailUpdate: data.emailUpdate ?? true,
        pushEnabled: data.pushEnabled ?? true,
        emailEnabled: data.emailEnabled ?? true,
        theme: 'LIGHT',
      },
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