import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { LogsService } from '../logs/logs.service';

interface EventPayload {
  event: string;
  data: unknown;
  timestamp: number;
  service: string;
}

@Injectable()
export class EventsSubscriberService implements OnModuleInit {
  private readonly logger = new Logger(EventsSubscriberService.name);
  private readonly eventsChannel = 'service-a-events';
  private subscriber: RedisClientType;

  constructor(private readonly logsService: LogsService) {}

  async onModuleInit() {
    const redisUri = process.env.REDIS_URI || 'redis://localhost:6379';
    this.subscriber = createClient({ url: redisUri }) as RedisClientType;
    await this.subscriber.connect();

    await this.subscriber.subscribe(this.eventsChannel, (message) => {
      try {
        const payload = JSON.parse(message) as EventPayload;
        void this.handleEvent(payload);
      } catch (error) {
        this.logger.error('Error parsing event message:', error);
      }
    });

    this.logger.log(`Subscribed to channel: ${this.eventsChannel}`);
  }

  private async handleEvent(payload: EventPayload): Promise<void> {
    try {
      await this.logsService.createLog({
        event: payload.event,
        data: payload.data,
        timestamp: payload.timestamp,
        service: payload.service || 'service-a',
        createdAt: new Date(payload.timestamp),
      });
      this.logger.debug(`Event logged: ${payload.event}`);
    } catch (error) {
      this.logger.error(`Error handling event ${payload.event}:`, error);
    }
  }
}
