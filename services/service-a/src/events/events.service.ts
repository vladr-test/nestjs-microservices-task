import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../libs/redis/src';
import { randomUUID } from 'crypto';
import { TracingLogger } from '../common/services/tracing-logger.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly serviceName = 'service-a';
  private readonly eventsStream = 'service-a-events-stream';
  private readonly timeseriesKeyPrefix = 'api_action:';
  private readonly instanceId: string;

  constructor(private readonly redisService: RedisService) {
    this.instanceId =
      process.env.INSTANCE_ID || `service-a-${randomUUID().substring(0, 8)}`;
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
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
      } catch (error: unknown) {
        if (
          error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string' &&
          !error.message.includes('BUSYKEY')
        ) {
          this.logger.debug(
            `Time series might already exist: ${timeseriesKey}`,
          );
        }
      }

      const dataObj = data as { duration?: number } | undefined;
      const value =
        dataObj && typeof dataObj.duration === 'number' ? dataObj.duration : 1;
      try {
        await this.redisService.timeseriesAdd(timeseriesKey, timestamp, value);
      } catch (error: unknown) {
        const errorMessage =
          error && typeof error === 'object' && 'message' in error
            ? String(error.message)
            : 'Unknown error';
        this.logger.debug(
          `Failed to add to time series ${timeseriesKey}: ${errorMessage}`,
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
