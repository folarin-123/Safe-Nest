import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { FinancialProfileService } from './financial-profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpsertFinancialProfileDto } from './dto/update-financial-profile.dto';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('financial-profile')
export class FinancialProfileController {
  constructor(
    private readonly financialProfileService: FinancialProfileService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /** GET /api/v1/financial-profile */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getProfile(@CurrentUser() user: any) {
    const result = await this.financialProfileService.getProfile(user.id);
    this.analyticsService.trackCoreFeature(user.id, 'financial_profile', 'open');
    return result;
  }

  /** POST /api/v1/financial-profile */
  @UseGuards(JwtAuthGuard)
  @Post()
  async createProfile(@CurrentUser() user: any, @Body() dto: UpsertFinancialProfileDto) {
    const result = await this.financialProfileService.createOrUpdate(user.id, dto);
    this.analyticsService.trackCoreFeature(user.id, 'financial_profile', 'create');
    return result;
  }

  /** PUT /api/v1/financial-profile */
  @UseGuards(JwtAuthGuard)
  @Put()
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpsertFinancialProfileDto) {
    const result = await this.financialProfileService.updateProfile(user.id, dto);
    this.analyticsService.trackCoreFeature(user.id, 'financial_profile', 'update');
    return result;
  }
}
