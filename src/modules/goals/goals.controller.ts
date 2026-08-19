import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('goals')
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /** POST /api/v1/goals — Create goal & run initial calculation */
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateGoalDto) {
    const result = await this.goalsService.create(user.id, dto);
    this.analyticsService.trackCoreFeature(user.id, 'goals', 'create');
    return result;
  }

  /** GET /api/v1/goals — Fetch all goals for the authenticated user */
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: any) {
    const result = await this.goalsService.findAllForUser(user.id);
    this.analyticsService.trackCoreFeature(user.id, 'goals', 'open');
    return result;
  }

  /** GET /api/v1/goals/:id — Fetch goal details with health score & breakdown */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const result = await this.goalsService.findOne(id, user.id);
    this.analyticsService.trackCoreFeature(user.id, 'goal_detail', 'open');
    return result;
  }

  /** PUT /api/v1/goals/:id — Goal adjustment / scenario update */
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    const result = await this.goalsService.update(id, user.id, dto);
    this.analyticsService.trackCoreFeature(user.id, 'goals', 'update');
    return result;
  }
}