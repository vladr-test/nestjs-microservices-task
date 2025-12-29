import { Injectable, Logger } from '@nestjs/common';
import { MongoService } from '../../../libs/mongo/src/mongo.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { ObjectId } from 'mongodb';

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);
  private readonly collectionName = 'records';

  constructor(private readonly mongoService: MongoService) {}

  async insertFromFile(
    filepath: string,
    fileExtension: string,
  ): Promise<number> {
    const collection = this.mongoService.getCollection<Record<string, unknown>>(
      this.collectionName,
    );

    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ '$**': 'text' });

    let records: Array<Record<string, unknown>>;

    if (fileExtension === '.json') {
      const content = await fs.readFile(filepath, 'utf-8');
      const data = JSON.parse(content) as unknown;
      const parsedData = Array.isArray(data) ? data : [data];
      records = parsedData as Array<Record<string, unknown>>;
    } else if (['.xlsx', '.xls'].includes(fileExtension)) {
      records = await this.parseExcelFile(filepath);
    } else {
      throw new Error(`Unsupported file extension: ${fileExtension}`);
    }

    const recordsWithMetadata = records.map((record) => ({
      ...record,
      _id: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      sourceFile: path.basename(filepath),
    }));

    const batchSize = 1000;
    let insertedCount = 0;

    for (let i = 0; i < recordsWithMetadata.length; i += batchSize) {
      const batch = recordsWithMetadata.slice(i, i + batchSize);
      const result = await collection.insertMany(batch, { ordered: false });
      insertedCount += result.insertedCount;
    }

    this.logger.log(`Inserted ${insertedCount} records from ${filepath}`);
    return insertedCount;
  }

  private async parseExcelFile(
    filepath: string,
  ): Promise<Array<Record<string, unknown>>> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filepath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('No worksheet found in Excel file');
    }

    const headers: string[] = [];
    worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const cellValue = cell.value;
      if (
        cellValue == null ||
        typeof cellValue === 'string' ||
        typeof cellValue === 'number' ||
        typeof cellValue === 'boolean'
      ) {
        headers[colNumber - 1] = String(cellValue) || `col_${colNumber}`;
      } else {
        headers[colNumber - 1] =
          JSON.stringify(cellValue) || `col_${colNumber}`;
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

    return records;
  }

  async search(
    query?: string,
    page: number = 1,
    limit: number = 10,
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'asc',
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const collection = this.mongoService.getCollection(this.collectionName);

    const filter: {
      $text?: { $search: string };
      [key: string]: unknown;
    } = {};
    if (query) {
      filter.$text = { $search: query };
    }

    const sort: Record<string, 1 | -1> = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      collection.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getById(id: string): Promise<Record<string, unknown> | null> {
    const collection = this.mongoService.getCollection<Record<string, unknown>>(
      this.collectionName,
    );
    const result = await collection.findOne({ _id: new ObjectId(id) });
    return result as Record<string, unknown> | null;
  }
}
