import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { MulterExceptionFilter } from './common/filters/multer-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new MulterExceptionFilter());

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
