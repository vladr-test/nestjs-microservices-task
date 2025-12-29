import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchDto {
  @ApiProperty({
    description:
      'Search query (searches across all fields: name, email, username, address, company, etc.)',
    example: 'Leanne',
    required: false,
  })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiProperty({ description: 'Page number', default: 1, required: false })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', default: 10, required: false })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;

  @ApiProperty({
    description:
      'Field name to sort by (e.g., "id", "name", "username", "email", "createdAt"). For nested fields, use dot notation (e.g., "address.city", "company.name"). If not provided, defaults to "createdAt"',
    example: 'name',
    required: false,
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiProperty({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'asc',
    required: false,
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc';
}
