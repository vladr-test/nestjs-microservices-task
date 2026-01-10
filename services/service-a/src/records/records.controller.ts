import { Controller, Get, Query, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { RecordsService } from './records.service';
import { SearchDto } from './search.dto';
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
  @ApiOkResponse({
    description: 'Search results returned successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { type: 'object' },
          example: [{ id: '123', name: 'John Doe', email: 'john@example.com' }],
        },
        total: { type: 'number', example: 100 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters - validation failed',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['page must be a number'],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error during search operation',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Internal server error' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async search(@Query() dto: SearchDto, @Req() request: Request) {
    const startTime = Date.now();
    const result = await this.recordsService.search(
      dto.q,
      dto.page,
      dto.limit,
      dto.sortBy,
      dto.sortOrder,
    );

    const correlationId = (request as Request & { correlationId?: string })
      .correlationId;
    await this.eventsService.publishApiAction(
      'RECORDS_SEARCHED',
      {
        query: dto.q,
        page: dto.page,
        limit: dto.limit,
        resultCount: result.data.length,
        total: result.total,
        duration: Date.now() - startTime,
      },
      correlationId,
    );

    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get record by ID' })
  @ApiOkResponse({
    description: 'Record retrieved successfully',
    schema: {
      type: 'object',
      example: {
        id: '123',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid record ID format',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Invalid ObjectId format' },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Record not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Record not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error during record retrieval',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: { type: 'string', example: 'Internal server error' },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async getById(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Record<string, unknown> | null> {
    const result = await this.recordsService.getById(id);

    const correlationId = (request as Request & { correlationId?: string })
      .correlationId;
    await this.eventsService.publishApiAction(
      'RECORD_RETRIEVED',
      {
        recordId: id,
      },
      correlationId,
    );

    return result;
  }
}
