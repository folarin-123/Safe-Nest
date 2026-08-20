import { Controller, Get, Patch, Param, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly remindersService: RemindersService,
    private readonly analyticsService: AnalyticsService,
  ) { }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: any) {
    const result = await this.notificationsService.findAllForUser(user.id);
    this.analyticsService.trackCoreFeature(user.id, 'notifications', 'open');
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  async markRead(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.notificationsService.markAsRead(user.id, id);
    this.analyticsService.trackCoreFeature(user.id, 'notifications', 'mark_read');
    return result;
  }
@Post('trigger-reminders')
async triggerReminders() {
  const result = await this.remindersService.runReminderCheck();
  return { message: 'Reminder check completed', result };
}
}