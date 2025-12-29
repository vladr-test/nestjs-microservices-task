import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
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
  @ApiOkResponse({
    description: 'Logs queried successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              event: { type: 'string', example: 'DATA_FETCHED' },
              data: { type: 'object' },
              timestamp: { type: 'number', example: 1704067200000 },
              service: { type: 'string', example: 'service-a' },
              createdAt: {
                type: 'string',
                example: '2025-01-01T00:00:00.000Z',
              },
            },
          },
        },
        total: { type: 'number', example: 50 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
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
