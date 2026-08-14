import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalCalculationService } from './goal-calculation.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { SimulateGoalDto } from './dto/simulate-goal.dto';
import { RecoveryPlanDto } from './dto/recovery-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('goals')
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly goalCalculationService: GoalCalculationService,
  ) {}

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
  @Post('simulate')
  async simulateScenario(@Body() body: SimulateGoalDto) {
    return this.goalCalculationService.simulateGoalScenario(
      body.targetAmount,
      body.deadline,
      body.frequency,
      body.currentAmount ?? 0,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.goalsService.findOne(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(id, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/progress')
  async getProgress(@CurrentUser() user: any, @Param('id') id: string) {
    return this.goalCalculationService.calculateGoalProgress(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/health')
  async getHealth(@CurrentUser() user: any, @Param('id') id: string) {
    return this.goalCalculationService.calculateGoalHealthScore(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/recovery-plan')
  async generateRecoveryPlan(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: RecoveryPlanDto,
  ) {
    return this.goalCalculationService.generateSmartRecoveryPlan(id, user.id, body.missedAmount);
  }
}
