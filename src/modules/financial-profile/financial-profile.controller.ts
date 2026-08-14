import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { FinancialProfileService } from './financial-profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpsertFinancialProfileDto } from './dto/update-financial-profile.dto';

@Controller('financial-profile')
export class FinancialProfileController {
  constructor(private readonly financialProfileService: FinancialProfileService) {}

  /** GET /api/v1/financial-profile */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getProfile(@CurrentUser() user: any) {
    return this.financialProfileService.getProfile(user.id);
  }

  /** POST /api/v1/financial-profile */
  @UseGuards(JwtAuthGuard)
  @Post()
  async createProfile(@CurrentUser() user: any, @Body() dto: UpsertFinancialProfileDto) {
    return this.financialProfileService.createOrUpdate(user.id, dto);
  }

  /** PUT /api/v1/financial-profile */
  @UseGuards(JwtAuthGuard)
  @Put()
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpsertFinancialProfileDto) {
    return this.financialProfileService.updateProfile(user.id, dto);
  }
}
