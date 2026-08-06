import { Controller, Get } from '@nestjs/common';
import { ContributionsService } from './contributions.service';

@Controller('contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get('health')
  health() {
    return { status: 'contributions module is alive' };
  }
}
