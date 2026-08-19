import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('goals/:goalId/contributions')
export class ContributionsController {
  constructor(
    private readonly contributionsService: ContributionsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

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
    const result = await this.contributionsService.create(goalId, user.id, dto);
    this.analyticsService.trackCoreFeature(user.id, 'contributions', 'create');
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @CurrentUser() user: any,
    @Param('goalId') goalId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    const result = await this.contributionsService.findAllForGoal(goalId, user.id, paginationDto);
    this.analyticsService.trackCoreFeature(user.id, 'contributions', 'open');
    return result;
  }
}