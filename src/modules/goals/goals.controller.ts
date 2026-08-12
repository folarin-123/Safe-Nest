import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  /** POST /api/v1/goals — Create goal & run initial calculation */
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(user.id, dto);
  }

  /** GET /api/v1/goals — Fetch all goals for the authenticated user */
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.goalsService.findAllForUser(user.id);
  }

  /** GET /api/v1/goals/:id — Fetch goal details with health score & breakdown */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.goalsService.findOne(id, user.id);
  }

  /** PUT /api/v1/goals/:id — Goal adjustment / scenario update */
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(id, user.id, dto);
  }
}