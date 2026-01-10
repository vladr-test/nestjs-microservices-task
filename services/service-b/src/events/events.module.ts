import { Module } from '@nestjs/common';
import { RedisModule } from '../../../libs/redis/src';
import { EventsSubscriberService } from './events-subscriber.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [LogsModule, RedisModule],
  providers: [EventsSubscriberService],
  exports: [EventsSubscriberService],
})
export class EventsModule {}
