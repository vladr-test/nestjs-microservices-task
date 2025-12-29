import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsDateString,
  IsString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LogQueryDto {
  @ApiProperty({
    description:
      'Event type filter (e.g., DATA_FETCHED, FILE_UPLOADED, RECORDS_SEARCHED, RECORD_RETRIEVED)',
    example: 'DATA_FETCHED',
    required: false,
  })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({
    description: 'Start date',
    example: '2025-12-23',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: 'End date',
    example: '2025-12-25',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ description: 'Page number', default: 1, required: false })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', default: 10, required: false })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;
}

