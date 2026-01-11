import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MongoModule } from '../../libs/mongo/src';
import { RedisModule } from '../../libs/redis/src';
import { DataModule } from './data/data.module';
import { RecordsModule } from './records/records.module';
import { EventsModule } from './events/events.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TracingInterceptor } from './common/interceptors/tracing.interceptor';
import { TracingLogger } from './common/services/tracing-logger.service';
import * as os from 'os';

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

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TracingInterceptor());

  let replicaNumber: string | null = null;

  const hostname = process.env.HOSTNAME || os.hostname();

  const replicaMatch = hostname.match(/service-a-(\d+)$/);
  if (replicaMatch) {
    replicaNumber = replicaMatch[1];
  } else {
    const numericMatch = hostname.match(/-(\d+)$/);
    replicaNumber = numericMatch ? numericMatch[1] : null;
  }

  const instanceId =
    process.env.INSTANCE_ID ||
    (replicaNumber
      ? `service-a-${replicaNumber}`
      : `service-a-${Date.now().toString(36)}-${process.pid}`);
  TracingLogger.setInstanceId(instanceId);

  const config = new DocumentBuilder()
    .setTitle('Service A API')
    .setDescription(
      'Microservice A - Data fetching, file upload, and search APIs',
    )
    .setVersion('1.0')
    .addTag('Data', 'Data fetching and file operations')
    .addTag('Records', 'Record search and retrieval')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.SERVICE_A_PORT ?? 3000;
  await app.listen(port);
}
void bootstrap();
