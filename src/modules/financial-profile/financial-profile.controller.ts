import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { FinancialProfileService } from './financial-profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateFinancialProfileDto } from './dto/update-financial-profile.dto';

@Controller('financial-profile')
export class FinancialProfileController {
  constructor(private readonly financialProfileService: FinancialProfileService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getProfile(@CurrentUser() user: any) {
    return this.financialProfileService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateData: UpdateFinancialProfileDto,
  ) {
    return this.financialProfileService.updateProfile(user.id, updateData);
  }
}
