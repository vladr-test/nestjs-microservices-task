import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { LogQueryDto } from './log-query.dto';

@ApiTags('Logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @ApiOperation({ summary: 'Query logs by filters (date, type)' })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error during log query',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Internal server error' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async queryLogs(@Query() dto: LogQueryDto) {
    return this.logsService.queryLogs(
      dto.type,
      dto.startDate,
      dto.endDate,
      dto.page,
      dto.limit,
    );
  }
}
