import {
  Injectable,
  Logger,
  BadRequestException,
  GatewayTimeoutException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import axios, { AxiosError, AxiosResponse } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { FileFormat } from '../dto';

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name);
  private readonly dataDir = path.join(process.cwd(), 'data');

  async ensureDataDirectory() {
    try {
      await fs.access(this.dataDir);
    } catch {
      await fs.mkdir(this.dataDir, { recursive: true });
    }
  }

  async fetchAndSaveData(
    url: string,
    format: FileFormat = FileFormat.JSON,
    filename?: string,
  ): Promise<{ filepath: string; recordCount: number }> {
    await this.ensureDataDirectory();

    if (filename) {
      this.validateFilename(filename);
    }

    this.logger.log(`Fetching data from: ${url}`);
    let response: AxiosResponse<unknown> | undefined;
    try {
      response = await axios.get<unknown>(url, {
        responseType: 'json',
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });
    } catch (error) {
      this.handleAxiosError(error as AxiosError, url);
    }

    if (!response) {
      throw new InternalServerErrorException(
        'Failed to fetch data: Unexpected error occurred',
      );
    }

    if (response.status >= 400) {
      if (response.status === 404) {
        throw new NotFoundException(
          `The requested URL "${url}" was not found. Please check the URL and try again.`,
        );
      }
      if (response.status >= 500) {
        throw new GatewayTimeoutException(
          `The API at "${url}" returned an error (status ${response.status}). The server may be temporarily unavailable.`,
        );
      }
      throw new BadRequestException(
        `The API at "${url}" returned an error (status ${response.status}). Please check the URL and try again.`,
      );
    }

    if (response.data === null || response.data === undefined) {
      throw new BadRequestException(
        `The API at "${url}" returned empty data. Please ensure the API returns valid JSON data.`,
      );
    }

    let data: unknown[];
    try {
      const responseData: unknown = response.data;
      const parsedData: unknown =
        typeof responseData === 'string'
          ? (JSON.parse(responseData) as unknown)
          : responseData;
      data = Array.isArray(parsedData) ? parsedData : [parsedData];
    } catch {
      throw new BadRequestException(
        `The API at "${url}" returned invalid JSON data. Please ensure the API returns valid JSON.`,
      );
    }

    if (data.length === 0) {
      throw new BadRequestException(
        `The API at "${url}" returned no data. The response was empty.`,
      );
    }

    const recordCount = data.length;
    const timestamp = Date.now();
    const baseFilename = filename || `data_${timestamp}`;

    let filepath: string;
    try {
      if (format === FileFormat.EXCEL) {
        filepath = await this.saveAsExcel(data, baseFilename);
      } else {
        filepath = await this.saveAsJson(data, baseFilename);
      }
    } catch (fileError) {
      this.logger.error(`Error saving file: ${fileError}`);
      throw new InternalServerErrorException(
        `Failed to save the file. Please check file permissions and disk space.`,
      );
    }

    this.logger.log(`Data saved to: ${filepath} (${recordCount} records)`);
    return { filepath, recordCount };
  }

  private validateFilename(filename: string): void {
    if (!/^[a-zA-Z0-9_-]+$/.test(filename)) {
      throw new BadRequestException(
        'Filename can only contain letters, numbers, hyphens, and underscores',
      );
    }
    if (filename.length < 1 || filename.length > 50) {
      throw new BadRequestException(
        'Filename must be between 1 and 50 characters long',
      );
    }
  }

  private handleAxiosError(error: AxiosError, url: string): never {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      throw new NotFoundException(
        `Cannot connect to "${url}". Please check if the URL is correct and the server is accessible.`,
      );
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new GatewayTimeoutException(
        `Request to "${url}" timed out after 30 seconds. The server may be slow or unresponsive. Please try again later.`,
      );
    }
    if (error.code === 'ERR_INVALID_URL') {
      throw new BadRequestException(
        `Invalid URL format: "${url}". Please provide a valid HTTP or HTTPS URL.`,
      );
    }
    if (error.response) {
      const status = error.response.status;
      if (status === 404) {
        throw new NotFoundException(
          `The requested URL "${url}" was not found (404). Please check the URL.`,
        );
      }
      if (status >= 500) {
        throw new GatewayTimeoutException(
          `The API at "${url}" returned an error (${status}). The server may be temporarily unavailable.`,
        );
      }
      throw new BadRequestException(
        `The API at "${url}" returned an error (${status}). Please check the URL and try again.`,
      );
    }

    throw new BadRequestException(
      `Failed to fetch data from "${url}": ${error.message}. Please verify the URL is correct and accessible.`,
    );
  }

  private async saveAsJson(data: any[], filename: string): Promise<string> {
    const filepath = path.join(this.dataDir, `${filename}.json`);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    return filepath;
  }

  private async saveAsExcel(data: any[], filename: string): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    if (data.length === 0) {
      throw new Error('No data to save');
    }

    const allKeys = new Set<string>();
    data.forEach((item: Record<string, unknown>) => {
      Object.keys(item).forEach((key) => allKeys.add(key));
    });

    const headers = Array.from(allKeys);
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: 20,
    }));

    data.forEach((item: Record<string, unknown>) => {
      const row: Record<string, string | number | boolean | null> = {};
      headers.forEach((header) => {
        const value = item[header];
        row[header] =
          typeof value === 'object' && value !== null
            ? JSON.stringify(value)
            : (value as string | number | boolean | null);
      });
      worksheet.addRow(row);
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    const filepath = path.join(this.dataDir, `${filename}.xlsx`);
    await workbook.xlsx.writeFile(filepath);
    return filepath;
  }

  async parseAndInsertJson(filepath: string): Promise<number> {
    try {
      try {
        await fs.access(filepath);
      } catch {
        throw new BadRequestException(
          `File not found at path "${filepath}". The file may have been deleted or moved.`,
        );
      }

      let content: string;
      try {
        content = await fs.readFile(filepath, 'utf-8');
      } catch {
        throw new BadRequestException(
          `Failed to read file "${filepath}". Please ensure the file is accessible and not corrupted.`,
        );
      }

      if (!content || content.trim().length === 0) {
        throw new BadRequestException(
          'The uploaded JSON file is empty. Please upload a file with valid JSON data.',
        );
      }

      let data: unknown;
      try {
        data = JSON.parse(content) as unknown;
      } catch (parseError) {
        const errorMessage =
          parseError instanceof Error ? parseError.message : 'Unknown error';
        throw new BadRequestException(
          `The uploaded file contains invalid JSON: ${errorMessage}. Please ensure the file is valid JSON format and check for syntax errors.`,
        );
      }

      if (data === null || data === undefined) {
        throw new BadRequestException(
          'The JSON file contains only null or undefined. Please upload a file with valid data.',
        );
      }

      const records = Array.isArray(data) ? data : [data];
      if (records.length === 0) {
        throw new BadRequestException(
          'The JSON file contains no records. Please upload a file with at least one record.',
        );
      }

      return records.length;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error parsing JSON file: ${error}`);
      throw new BadRequestException(
        `Failed to parse JSON file: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the file is valid and not corrupted.`,
      );
    }
  }

  async parseAndInsertExcel(filepath: string): Promise<number> {
    let workbook: ExcelJS.Workbook;
    try {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filepath);
    } catch (error) {
      if (error instanceof Error && error.message.includes('ECONNRESET')) {
        throw new BadRequestException(
          'Failed to read Excel file. The file may be corrupted or in use by another program.',
        );
      }
      throw new BadRequestException(
        `Failed to read Excel file: ${error instanceof Error ? error.message : 'Unknown error'}. The file may be corrupted or in an unsupported format.`,
      );
    }

    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      throw new BadRequestException(
        'No worksheet found in Excel file. The file may be empty or corrupted. Please ensure the Excel file contains at least one worksheet with data.',
      );
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException(
        'Failed to access the first worksheet in Excel file. The file may be corrupted.',
      );
    }

    if (worksheet.rowCount === 0) {
      throw new BadRequestException(
        'The Excel worksheet is empty. Please ensure the file contains data rows.',
      );
    }

    const headers: string[] = [];
    worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const cellValue = cell.value;
      if (cellValue == null) {
        headers[colNumber - 1] = `col_${colNumber}`;
      } else if (
        typeof cellValue === 'string' ||
        typeof cellValue === 'number' ||
        typeof cellValue === 'boolean'
      ) {
        headers[colNumber - 1] = String(cellValue);
      } else {
        headers[colNumber - 1] = JSON.stringify(cellValue);
      }
    });

    const records: Array<Record<string, unknown>> = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const record: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        let value: unknown = cell.value;

        if (typeof value === 'string' && value.startsWith('{')) {
          try {
            value = JSON.parse(value) as unknown;
          } catch {
            void 0;
          }
        }

        record[header] = value;
      });
      records.push(record);
    });

    if (records.length === 0) {
      throw new BadRequestException(
        'The Excel file contains no data rows. Please ensure the file has data rows (excluding the header row).',
      );
    }

    return records.length;
  }
}
