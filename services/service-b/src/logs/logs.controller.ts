import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LogsService } from './logs.service';
import { LogQueryDto } from '../dto';

@ApiTags('Logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @ApiOperation({ summary: 'Query logs by filters (date, type)' })
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
