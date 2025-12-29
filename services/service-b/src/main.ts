import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MongoModule } from '../../libs/mongo/src';
import { RedisModule } from '../../libs/redis/src';
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
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Service B API')
    .setDescription(
      'Microservice B - Event logging, querying, and PDF report generation',
    )
    .setVersion('1.0')
    .addTag('Logs', 'Log querying operations')
    .addTag('Reports', 'PDF report generation')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.SERVICE_B_PORT ?? 3002;
  await app.listen(port);
}
void bootstrap();
