import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  GatewayTimeoutException,
  Logger,
  UseFilters,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiGatewayTimeoutResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { DataService } from './data.service';
import { FetchDataDto } from './fetch-data.dto';
import { RecordsService } from '../records/records.service';
import { EventsService } from '../events/events.service';
import { MulterExceptionFilter } from '../common/filters/multer-exception.filter';
import * as path from 'path';

@ApiTags('Data')
@Controller('data')
export class DataController {
  private readonly logger = new Logger(DataController.name);

  constructor(
    private readonly dataService: DataService,
    private readonly recordsService: RecordsService,
    private readonly eventsService: EventsService,
  ) {}

  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch data from public API and save to file' })
  @ApiOkResponse({
    description: 'Data fetched and saved successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Data fetched and saved successfully',
        },
        filepath: {
          type: 'string',
          example: '/app/data/data_1234567890.json',
        },
        recordCount: { type: 'number', example: 10 },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid request - URL format, filename validation, or empty data',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'URL must be a valid HTTP or HTTPS URL',
        },
        error: {
          type: 'string',
          example: 'Bad Request',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'API endpoint not found or URL cannot be reached',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'The requested URL was not found' },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  @ApiGatewayTimeoutResponse({
    description: 'Request timeout or API server error',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 504 },
        message: {
          type: 'string',
          example: 'Request timed out after 30 seconds',
        },
        error: { type: 'string', example: 'Gateway Timeout' },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Internal server error during data fetch or file save',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'An unexpected error occurred while fetching data',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async fetchData(@Body() dto: FetchDataDto) {
    const startTime = Date.now();
    try {
      const result = await this.dataService.fetchAndSaveData(
        dto.url,
        dto.format,
        dto.filename,
      );

      try {
        await this.eventsService.publishApiAction('DATA_FETCHED', {
          url: dto.url,
          format: dto.format,
          filepath: result.filepath,
          recordCount: result.recordCount,
          duration: Date.now() - startTime,
        });
      } catch (eventError) {
        console.error('Failed to publish event:', eventError);
      }

      return {
        message: 'Data fetched and saved successfully',
        filepath: result.filepath,
        recordCount: result.recordCount,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof GatewayTimeoutException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `An unexpected error occurred while fetching data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  @Post('upload')
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            file.fieldname +
              '-' +
              uniqueSuffix +
              path.extname(file.originalname),
          );
        },
      }),
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const supportedExtensions = ['.json', '.xlsx', '.xls'];

        if (!ext || ext.length === 0) {
          cb(
            new Error(
              'File must have an extension. Only JSON (.json) and Excel (.xlsx, .xls) files are supported.',
            ),
            false,
          );
          return;
        }

        if (!supportedExtensions.includes(ext)) {
          cb(
            new Error(
              `Unsupported file format "${ext}". Only ${supportedExtensions.join(', ')} files are supported.`,
            ),
            false,
          );
          return;
        }

        cb(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload and parse file, insert into MongoDB' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'File uploaded and processed successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'File uploaded and processed successfully',
        },
        filename: { type: 'string', example: 'data.xlsx' },
        recordCount: { type: 'number', example: 100 },
        insertedCount: { type: 'number', example: 100 },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Invalid file - missing file, unsupported format, empty file, invalid content, or no records inserted',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'No file uploaded or file was rejected',
        },
        error: {
          type: 'string',
          example: 'Bad Request',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description:
      'Internal server error during file processing or database insertion',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 500 },
        message: {
          type: 'string',
          example: 'An unexpected error occurred while processing the file',
        },
        error: { type: 'string', example: 'Internal Server Error' },
      },
    },
  })
  async uploadFile(@UploadedFile() file: Express.Multer.File | undefined) {
    const startTime = Date.now();

    try {
      if (!file) {
        throw new BadRequestException(
          'No file uploaded or file was rejected. Please select a valid file (.json, .xlsx, or .xls) using the "file" field in the multipart form data.',
        );
      }

      const filepath = file.path;
      const ext = path.extname(file.originalname).toLowerCase();

      if (!ext || ext.length === 0) {
        throw new BadRequestException(
          'File must have an extension. Please upload a file with a valid extension (.json, .xlsx, or .xls).',
        );
      }

      const supportedExtensions = ['.json', '.xlsx', '.xls'];
      if (!supportedExtensions.includes(ext)) {
        throw new BadRequestException(
          `Unsupported file format "${ext}". Only the following file types are supported: ${supportedExtensions.join(', ')}.`,
        );
      }

      if (!file.size || file.size === 0) {
        throw new BadRequestException(
          'The uploaded file is empty. Please upload a file with content.',
        );
      }

      if (!filepath) {
        throw new InternalServerErrorException(
          'File upload failed: The file was not saved correctly. Please try again.',
        );
      }

      let recordCount: number;
      try {
        if (ext === '.json') {
          recordCount = await this.dataService.parseAndInsertJson(filepath);
        } else if (['.xlsx', '.xls'].includes(ext)) {
          recordCount = await this.dataService.parseAndInsertExcel(filepath);
        } else {
          throw new BadRequestException(`Unsupported file format: ${ext}`);
        }
      } catch (error) {
        if (
          error instanceof BadRequestException ||
          error instanceof InternalServerErrorException
        ) {
          throw error;
        }
        throw new BadRequestException(
          `Failed to parse file "${file.originalname}": ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the file is valid and not corrupted.`,
        );
      }

      let insertedCount: number;
      try {
        insertedCount = await this.recordsService.insertFromFile(filepath, ext);
        if (insertedCount === 0) {
          throw new BadRequestException(
            'No records were inserted into the database. Please ensure the file contains valid data records.',
          );
        }
      } catch (error) {
        if (
          error instanceof BadRequestException ||
          error instanceof InternalServerErrorException
        ) {
          throw error;
        }
        throw new InternalServerErrorException(
          `Failed to insert records into database: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or contact support if the problem persists.`,
        );
      }

      if (insertedCount !== recordCount) {
        this.logger.warn(
          `Mismatch between parsed records (${recordCount}) and inserted records (${insertedCount})`,
        );
      }

      try {
        await this.eventsService.publishApiAction('FILE_UPLOADED', {
          filename: file.originalname,
          filepath,
          recordCount,
          insertedCount,
          duration: Date.now() - startTime,
        });
      } catch (eventError) {
        this.logger.error('Failed to publish FILE_UPLOADED event:', eventError);
      }

      return {
        message: 'File uploaded and processed successfully',
        filename: file.originalname,
        recordCount,
        insertedCount,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof GatewayTimeoutException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `An unexpected error occurred while processing the file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
