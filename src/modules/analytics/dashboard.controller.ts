import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/** GET /api/v1/dashboard/summary */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  async getSummary(@CurrentUser() user: any) {
    return this.analyticsService.getDashboardSummary(user.id);
  }
}
