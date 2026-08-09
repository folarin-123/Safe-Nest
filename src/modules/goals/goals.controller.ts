import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get('health')
  health() {
    return { status: 'goals module is alive' };
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.goalsService.findAllForUser(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.goalsService.findOne(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/progress')
  async getProgress(@CurrentUser() user: any, @Param('id') id: string) {
    return this.goalsService.getGoalProgress(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/recalculate')
  async recalculate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.goalsService.recalculate(id, user.id);
  }
}