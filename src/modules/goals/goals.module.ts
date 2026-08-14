import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { GoalCalculationService } from './goal-calculation.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GoalsController],
  providers: [GoalsService, GoalCalculationService],
  exports: [GoalsService, GoalCalculationService],
})
export class GoalsModule {}
