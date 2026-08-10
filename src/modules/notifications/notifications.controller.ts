import { Controller, Get, Patch, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly remindersService: RemindersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.notificationsService.findAllForUser(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  async markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.id, id);
  }

}