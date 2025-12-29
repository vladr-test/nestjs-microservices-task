import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsString, IsOptional } from 'class-validator';

export class ReportQueryDto {
  @ApiProperty({ description: 'Start date', required: true })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date', required: true })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Event type filter', required: false })
  @IsString()
  @IsOptional()
  type?: string;
}

