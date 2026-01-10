import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MongoService } from '../../../libs/mongo/src';
import { ObjectId } from 'mongodb';

export interface LogEntry {
  event: string;
  data: any;
  timestamp: number;
  service: string;
  createdAt: Date;
  correlationId?: string;
  messageId?: string;
  instanceId?: string;
  processedBy?: string;
}

@Injectable()
export class LogsService implements OnModuleInit {
  private readonly logger = new Logger(LogsService.name);
  private readonly collectionName = 'event_logs';

  constructor(private readonly mongoService: MongoService) {}

  async onModuleInit() {
    const collection = this.mongoService.getCollection(this.collectionName);

    await collection.createIndex({ timestamp: -1 });
    await collection.createIndex({ event: 1 });
    await collection.createIndex({ service: 1 });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex(
      { correlationId: 1 },
      { unique: true, sparse: true },
    );
    await collection.createIndex(
      { messageId: 1 },
      { unique: true, sparse: true },
    );

    this.logger.log('Logs service initialized with indexes');
  }

  async createLog(entry: LogEntry): Promise<void> {
    const collection = this.mongoService.getCollection(this.collectionName);
    await collection.insertOne({
      ...entry,
      _id: new ObjectId(),
      createdAt: new Date(entry.timestamp),
    });
  }

  async isMessageProcessed(
    correlationId?: string,
    messageId?: string,
  ): Promise<boolean> {
    if (!correlationId && !messageId) {
      return false;
    }

    const collection = this.mongoService.getCollection(this.collectionName);
    const filter: { correlationId?: string; messageId?: string } = {};

    if (correlationId) {
      filter.correlationId = correlationId;
    }
    if (messageId) {
      filter.messageId = messageId;
    }

    const count = await collection.countDocuments(filter);
    return count > 0;
  }

  async queryLogs(
    type?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: LogEntry[]; total: number; page: number; limit: number }> {
    const collection = this.mongoService.getCollection<LogEntry>(
      this.collectionName,
    );

    const filter: {
      event?: string;
      timestamp?: {
        $gte?: number;
        $lte?: number;
      };
    } = {};

    if (type) {
      filter.event = type;
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate).getTime();
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate).getTime();
      }
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getTimeSeriesData(
    startDate: string,
    endDate: string,
    type?: string,
  ): Promise<Array<{ timestamp: number; value: number; event: string }>> {
    const collection = this.mongoService.getCollection<LogEntry>(
      this.collectionName,
    );

    const filter: {
      timestamp: {
        $gte: number;
        $lte: number;
      };
      event?: string;
    } = {
      timestamp: {
        $gte: new Date(startDate).getTime(),
        $lte: new Date(endDate).getTime(),
      },
    };

    if (type) {
      filter.event = type;
    }

    const logs = await collection.find(filter).sort({ timestamp: 1 }).toArray();

    return logs.map((log) => {
      const data = log.data as { duration?: number } | undefined;
      const durationValue =
        data && typeof data.duration === 'number' ? data.duration : 1;
      return {
        timestamp: log.timestamp,
        value: durationValue,
        event: log.event,
      };
    });
  }
}
