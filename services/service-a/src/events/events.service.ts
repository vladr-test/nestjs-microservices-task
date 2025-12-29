import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../libs/redis/src/redis.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly serviceName = 'service-a';
  private readonly eventsChannel = 'service-a-events';
  private readonly timeseriesKeyPrefix = 'api_action:';

  constructor(private readonly redisService: RedisService) {}

  async publishApiAction(action: string, data: unknown): Promise<void> {
    const timestamp = Date.now();
    const event = {
      event: action,
      data,
      timestamp,
      service: this.serviceName,
    };

    try {
      await this.redisService.publish(
        this.eventsChannel,
        JSON.stringify(event),
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

      this.logger.debug(`Published event: ${action}`);
    } catch (error) {
      this.logger.error(`Error publishing event ${action}:`, error);
    }
  }
}
