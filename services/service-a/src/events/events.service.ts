import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../libs/redis/src';
import { randomUUID } from 'crypto';
import * as os from 'os';
import { TracingLogger } from '../common/services/tracing-logger.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly serviceName = 'service-a';
  private readonly eventsStream = 'service-a-events-stream';
  private readonly timeseriesKeyPrefix = 'api_action:';
  private readonly instanceId: string;

  constructor(private readonly redisService: RedisService) {
    const hostname = process.env.HOSTNAME || os.hostname();
    const replicaMatch = hostname.match(/-(\d+)$/);
    const replicaNumber = replicaMatch ? replicaMatch[1] : null;

    this.instanceId =
      process.env.INSTANCE_ID ||
      TracingLogger.getInstanceId() ||
      (replicaNumber
        ? `service-a-${replicaNumber}`
        : `service-a-${randomUUID().substring(0, 8)}`);
    this.logger.log(
      `EventsService initialized with instance ID: ${this.instanceId}`,
    );
  }

  async publishApiAction(
    action: string,
    data: unknown,
    correlationId?: string,
  ): Promise<void> {
    const timestamp = Date.now();
    const eventCorrelationId = correlationId || randomUUID();
    const event = {
      event: action,
      data,
      timestamp,
      service: this.serviceName,
      correlationId: eventCorrelationId,
      instanceId: this.instanceId,
    };

    try {
      const messageId: string = await this.redisService.streamAdd(
        this.eventsStream,
        {
          event: JSON.stringify(event),
          action,
          service: this.serviceName,
          correlationId: eventCorrelationId,
          instanceId: this.instanceId,
          timestamp: timestamp.toString(),
        },
      );

      TracingLogger.log(
        'Published event to Redis Stream',
        {
          correlationId: eventCorrelationId,
          requestId: eventCorrelationId,
          instanceId: this.instanceId,
          service: this.serviceName,
        },
        {
          action,
          messageId,
          stream: this.eventsStream,
          timestamp,
        },
      );

      const timeseriesKey = `${this.timeseriesKeyPrefix}${action}`;

      try {
        await this.redisService.timeseriesCreate(timeseriesKey, 86400000 * 30, {
          service: this.serviceName,
          action,
        });
        TracingLogger.log(
          'Time series created or already exists',
          {
            correlationId: eventCorrelationId,
            requestId: eventCorrelationId,
            instanceId: this.instanceId,
            service: this.serviceName,
          },
          {
            timeseriesKey,
            action,
          },
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        TracingLogger.warn(
          'Failed to create time series (may already exist)',
          {
            correlationId: eventCorrelationId,
            requestId: eventCorrelationId,
            instanceId: this.instanceId,
            service: this.serviceName,
          },
          {
            timeseriesKey,
            action,
            error: errorMessage,
          },
        );
      }

      const dataObj = data as { duration?: number } | undefined;
      const value =
        dataObj && typeof dataObj.duration === 'number' ? dataObj.duration : 1;
      try {
        await this.redisService.timeseriesAdd(timeseriesKey, timestamp, value);
        TracingLogger.log(
          'Added data point to time series',
          {
            correlationId: eventCorrelationId,
            requestId: eventCorrelationId,
            instanceId: this.instanceId,
            service: this.serviceName,
          },
          {
            timeseriesKey,
            action,
            timestamp,
            value,
          },
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        TracingLogger.error(
          'Failed to add to time series',
          error instanceof Error ? error.stack : undefined,
          {
            correlationId: eventCorrelationId,
            requestId: eventCorrelationId,
            instanceId: this.instanceId,
            service: this.serviceName,
          },
          {
            timeseriesKey,
            action,
            timestamp,
            value,
            error: errorMessage,
          },
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      TracingLogger.error(
        'Failed to publish event to Redis Stream',
        error instanceof Error ? error.stack : undefined,
        {
          correlationId: eventCorrelationId,
          requestId: eventCorrelationId,
          instanceId: this.instanceId,
          service: this.serviceName,
        },
        {
          action,
          error: errorMessage,
        },
      );
      throw error;
    }
  }

  getInstanceId(): string {
    return this.instanceId;
  }
}
