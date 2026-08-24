import { ConflictException, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AccountStatus } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import * as bcrypt from 'bcrypt';

const safeUserSelect = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  status: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

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




  async getSettings(userId: string) {
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      return {
        userId,
        pushEnabled: true,
        emailEnabled: true,
        theme: 'LIGHT',
      };
    }

    return settings;
  }

  async updateSettings(
    userId: string,
    data: { pushEnabled?: boolean; emailEnabled?: boolean },
  ) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...(data.pushEnabled !== undefined && { pushEnabled: data.pushEnabled }),
        ...(data.emailEnabled !== undefined && { emailEnabled: data.emailEnabled }),
      },
      create: {
        userId,
        pushEnabled: data.pushEnabled ?? true,
        emailEnabled: data.emailEnabled ?? true,
        theme: 'LIGHT',
      },
    });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File size exceeds the 5MB limit');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPublicId: true },
    });

    if (user?.avatarPublicId) {
      try {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      } catch {
        // ignore deletion failure if old asset missing
      }
    }

    const uploadResult = await new Promise<{ secure_url: string; public_id: string }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: `safenest/avatars/${userId}` },
          (error, result) => {
            if (error || !result) {
              return reject(
                new BadRequestException('Failed to upload image to Cloudinary'),
              );
            }
            resolve({ secure_url: result.secure_url, public_id: result.public_id });
          },
        );
        stream.end(file.buffer);
      },
    );

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: uploadResult.secure_url,
        avatarPublicId: uploadResult.public_id,
      },
      select: safeUserSelect,
    });
  }

  async deleteAvatar(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, avatarPublicId: true },
    });

    if (!user || !user.avatarUrl) {
      throw new NotFoundException('No profile photo exists for this user');
    }

    if (user.avatarPublicId) {
      try {
        await cloudinary.uploader.destroy(user.avatarPublicId);
      } catch {
        // ignore cloudinary deletion error
      }
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
        throw new BadRequestException('Incorrect password');
      }
    }

    const rawNewEmail = `deleted_${user.id}_${user.email}`;
    const newEmail = rawNewEmail.length > 255 ? rawNewEmail.substring(0, 255) : rawNewEmail;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: AccountStatus.DEACTIVATED,
        email: newEmail,
        phone: null,
      },
    });

    return { message: 'Your account has been deactivated.' };
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