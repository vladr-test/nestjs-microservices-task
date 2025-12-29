import {
  Controller,
  Get,
  Query,
  Res,
  Header,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './report-query.dto';

@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('pdf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate PDF report with charts from time series data',
  })
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="report.pdf"')
  @ApiOkResponse({
    description: 'PDF report generated successfully',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async generatePDF(@Query() dto: ReportQueryDto, @Res() res: Response) {
    const pdfBuffer = await this.reportsService.generatePDFReport(
      dto.startDate,
      dto.endDate,
      dto.type,
    );
    res.send(pdfBuffer);
  }
}
