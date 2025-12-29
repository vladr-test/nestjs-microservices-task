import { Module } from '@nestjs/common';
import { EventsSubscriberService } from './events-subscriber.service';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [LogsModule],
  providers: [EventsSubscriberService],
  exports: [EventsSubscriberService],
})
export class EventsModule {}
