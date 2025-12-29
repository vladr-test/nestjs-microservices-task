import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      throw exception;
    }

    if (response.headersSent) {
      return;
    }

    const error =
      exception instanceof Error ? exception : new Error(String(exception));

    response.setHeader('Content-Type', 'application/json');

    if (
      error.message &&
      (error.message.includes('Unsupported file format') ||
        error.message.includes('File must have an extension') ||
        error.message.includes('files are supported'))
    ) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message,
        error: 'Bad Request',
      });
      return;
    }

    if (
      error.name === 'MulterError' ||
      error.message.includes('File too large') ||
      error.message.includes('LIMIT_FILE_SIZE')
    ) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          'File size exceeds the maximum limit of 50MB. Please upload a smaller file.',
        error: 'Bad Request',
      });
      return;
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: error.message || 'Internal server error',
      error: 'Internal Server Error',
    });
  }
}
