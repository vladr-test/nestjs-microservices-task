import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

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
