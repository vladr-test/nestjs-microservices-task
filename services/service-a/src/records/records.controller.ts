import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RecordsService } from './records.service';
import { SearchDto } from '../dto';
import { EventsService } from '../events/events.service';

@ApiTags('Records')
@Controller('records')
export class RecordsController {
  constructor(
    private readonly recordsService: RecordsService,
    private readonly eventsService: EventsService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Search records with pagination and indexing' })
  async search(@Query() dto: SearchDto) {
    const startTime = Date.now();
    const result = await this.recordsService.search(
      dto.q,
      dto.page,
      dto.limit,
      dto.sortBy,
      dto.sortOrder,
    );

    await this.eventsService.publishApiAction('RECORDS_SEARCHED', {
      query: dto.q,
      page: dto.page,
      limit: dto.limit,
      resultCount: result.data.length,
      total: result.total,
      duration: Date.now() - startTime,
    });

    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get record by ID' })
  async getById(
    @Param('id') id: string,
  ): Promise<Record<string, unknown> | null> {
    const result = await this.recordsService.getById(id);

    await this.eventsService.publishApiAction('RECORD_RETRIEVED', {
      recordId: id,
    });

    return result;
  }
}
