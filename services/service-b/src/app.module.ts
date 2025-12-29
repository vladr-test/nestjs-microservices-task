import { Module } from '@nestjs/common';
import { MongoModule } from '../../libs/mongo/src/mongo.module';
import { RedisModule } from '../../libs/redis/src/redis.module';
import { LogsModule } from './logs/logs.module';
import { EventsModule } from './events/events.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    MongoModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      process.env.MONGODB_DB_NAME || 'service_b_db',
    ),
    RedisModule.forRoot(process.env.REDIS_URI || 'redis://localhost:6379'),
    LogsModule,
    EventsModule,
    ReportsModule,
  ],
})
export class AppModule {}
