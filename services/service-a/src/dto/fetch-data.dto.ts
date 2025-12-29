import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export enum FileFormat {
  JSON = 'json',
  EXCEL = 'excel',
}

export class FetchDataDto {
  @ApiProperty({
    description:
      'URL of the public API to fetch data from (must be a valid HTTP/HTTPS URL)',
    example: 'https://jsonplaceholder.typicode.com/users',
    default: 'https://jsonplaceholder.typicode.com/users',
  })
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    {
      message:
        'URL must be a valid HTTP or HTTPS URL (e.g., https://example.com/api)',
    },
  )
  url: string;

  @ApiProperty({
    description: 'Output file format',
    enum: FileFormat,
    default: FileFormat.JSON,
    required: false,
  })
  @IsEnum(FileFormat, {
    message: 'Format must be either "json" or "excel"',
  })
  @IsOptional()
  format?: FileFormat = FileFormat.JSON;

  @ApiProperty({
    description:
      'Output filename (optional, without extension). Must contain only alphanumeric characters, hyphens, and underscores. 1-50 characters.',
    example: 'my_data',
    required: false,
  })
  @IsString({ message: 'Filename must be a string' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Filename can only contain letters, numbers, hyphens, and underscores',
  })
  @MinLength(1, { message: 'Filename must be at least 1 character long' })
  @MaxLength(50, { message: 'Filename cannot exceed 50 characters' })
  @IsOptional()
  filename?: string;
}
