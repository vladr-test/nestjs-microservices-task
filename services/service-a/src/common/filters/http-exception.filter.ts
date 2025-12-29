import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (response.headersSent) {
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const responseObj = exceptionResponse as {
          message?: string | string[];
        };
        message = responseObj?.message || exception.message;
      }

      if (status === HttpStatus.BAD_REQUEST) {
        error = 'Bad Request';
      } else if (status === HttpStatus.NOT_FOUND) {
        error = 'Not Found';
      } else if (status === HttpStatus.GATEWAY_TIMEOUT) {
        error = 'Gateway Timeout';
      } else if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        error = 'Internal Server Error';
      } else {
        error = exception.name || 'Http Exception';
      }
    } else if (exception instanceof Error) {
      if (
        exception.name === 'MulterError' ||
        exception.message.includes('File too large') ||
        exception.message.includes('LIMIT_FILE_SIZE')
      ) {
        status = HttpStatus.BAD_REQUEST;
        message =
          'File size exceeds the maximum limit of 50MB. Please upload a smaller file.';
        error = 'Bad Request';
      } else if (
        exception.message.includes('Unsupported file format') ||
        exception.message.includes('File must have an extension') ||
        exception.message.includes('files are supported')
      ) {
        status = HttpStatus.BAD_REQUEST;
        message = exception.message;
        error = 'Bad Request';
      } else {
        message = exception.message;
        error = exception.name || 'Error';
      }
    } else {
      message = String(exception);
    }

    this.logger.error(
      `HTTP ${status} Error: ${JSON.stringify(message)} - ${request.method} ${request.url}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.setHeader('Content-Type', 'application/json');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    const formattedMessage = Array.isArray(message) ? message : message;

    response.status(status).json({
      statusCode: status,
      message: formattedMessage,
      error,
    });
  }
}
