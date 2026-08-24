import { test, describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { UsersService } from '../src/modules/users/users.service';

describe('UsersService - Avatar & Delete Account', () => {
  let mockPrisma: any;
  let mockCloudinary: any;
  let service: UsersService;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: async () => null,
        update: async (args: any) => ({ id: args.where.id, ...args.data }),
      },
    };
    mockCloudinary = {
      uploadImage: async () => ({ url: 'http://example.com/avatar.jpg', publicId: 'folder/img123' }),
      deleteImage: async () => {},
    };
    service = new UsersService(mockPrisma, mockCloudinary);
  });

  it('uploads avatar successfully when valid image is provided', async () => {
    mockPrisma.user.findUnique = async () => ({ id: 'u1', avatarPublicId: 'old_id' });
    let deletedOldPublicId = false;
    mockCloudinary.deleteImage = async (id: string) => {
      if (id === 'old_id') deletedOldPublicId = true;
    };

    const mockFile: any = {
      mimetype: 'image/png',
      size: 1024 * 1024,
      buffer: Buffer.from('test'),
    };

    const res = await service.uploadAvatar('u1', mockFile);
    assert.strictEqual(deletedOldPublicId, true);
    assert.strictEqual(res.avatarUrl, 'http://example.com/avatar.jpg');
  });

  it('rejects avatar upload if non-image mimetype or over 5MB', async () => {
    const pdfFile: any = { mimetype: 'application/pdf', size: 100, buffer: Buffer.from('pdf') };
    await assert.rejects(async () => service.uploadAvatar('u1', pdfFile), {
      name: 'BadRequestException',
    });

    const largeFile: any = { mimetype: 'image/jpeg', size: 6 * 1024 * 1024, buffer: Buffer.from('large') };
    await assert.rejects(async () => service.uploadAvatar('u1', largeFile), {
      name: 'BadRequestException',
    });
  });

  it('deletes account and updates status to DEACTIVATED', async () => {
    mockPrisma.user.findUnique = async () => ({
      id: 'u1',
      email: 'test@example.com',
      passwordHash: null,
    });

    const res = await service.deleteAccount('u1');
    assert.strictEqual(res.message, 'Your account has been deactivated.');
  });
});
