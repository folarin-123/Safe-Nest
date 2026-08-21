import {
  Controller,
  Get,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/v1/analytics/events/export
   *
   * Returns all analytics events as a CSV file
   * that can be opened directly in Excel.
   */
  @Get('events/export')
  async exportEvents(@Res() res: Response) {
    const events = await this.prisma.analyticsEvent.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    const headers = [
      'id',
      'eventName',
      'userId',
      'properties',
      'createdAt',
    ];

    const rows = events.map((event) => [
      event.id,
      event.eventName,
      event.userId ?? '',
      JSON.stringify(event.properties),
      event.createdAt.toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="safenest-analytics-events.csv"',
    );

    res.send(csv);
  }
}