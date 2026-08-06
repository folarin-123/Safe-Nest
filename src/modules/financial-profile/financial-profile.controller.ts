import { Controller, Get } from '@nestjs/common';
import { FinancialProfileService } from './financial-profile.service';

@Controller('financial-profile')
export class FinancialProfileController {
  constructor(private readonly financialProfileService: FinancialProfileService) {}

  @Get('health')
  health() {
    return { status: 'financial-profile module is alive' };
  }
}
