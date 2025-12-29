import { Module } from '@nestjs/common';
import { DataService } from './data.service';
import { DataController } from './data.controller';
import { RecordsModule } from '../records/records.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [RecordsModule, EventsModule],
  controllers: [DataController],
  providers: [DataService],
  exports: [DataService],
})
export class DataModule {}
