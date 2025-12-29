import { Module } from '@nestjs/common';
import { MongoModule } from '../../libs/mongo/src/mongo.module';
import { RedisModule } from '../../libs/redis/src/redis.module';
import { DataModule } from './data/data.module';
import { RecordsModule } from './records/records.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    MongoModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB_NAME || 'service_a_db',
    ),
    RedisModule.forRoot(process.env.REDIS_URI || 'redis://localhost:6379'),
    DataModule,
    RecordsModule,
    EventsModule,
  ],
})
export class AppModule {}
