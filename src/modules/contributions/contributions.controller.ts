import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('goals/:goalId/contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get('health')
  health() {
    return { status: 'contributions module is alive' };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @CurrentUser() user: any,
    @Param('goalId') goalId: string,
    @Body() dto: CreateContributionDto,
  ) {
    return this.contributionsService.create(goalId, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: any, @Param('goalId') goalId: string) {
    return this.contributionsService.findAllForGoal(goalId, user.id);
  }
}