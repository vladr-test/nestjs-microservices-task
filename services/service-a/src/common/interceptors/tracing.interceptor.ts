import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { TracingLogger } from '../services/tracing-logger.service';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      request.headers['x-request-id'] ||
      randomUUID();

    const requestId = randomUUID();

    (request as Request & { correlationId: string }).correlationId =
      correlationId as string;

    response.setHeader('x-correlation-id', correlationId as string);
    response.setHeader('x-request-id', requestId);
    response.setHeader('x-instance-id', TracingLogger.getInstanceId());

    const tracingContext = {
      correlationId: correlationId as string,
      requestId,
      instanceId: TracingLogger.getInstanceId(),
      service: 'service-a',
      method: request.method,
      path: request.path,
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.socket.remoteAddress,
    };

    TracingLogger.log('Incoming HTTP request', tracingContext, {
      query: request.query,
      body: this.sanitizeBody(request.body),
    });

    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        TracingLogger.log('HTTP request completed', tracingContext, {
          statusCode: response.statusCode,
          duration: `${duration}ms`,
          responseSize: JSON.stringify(data).length,
        });
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - startTime;
        const errorStack = error instanceof Error ? error.stack : undefined;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : 'UnknownError';

        TracingLogger.error('HTTP request failed', errorStack, tracingContext, {
          statusCode: response.statusCode || 500,
          duration: `${duration}ms`,
          error: errorMessage,
          errorName,
        });
        throw error;
      }),
    );
  }

  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...(body as Record<string, unknown>) };
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'auth'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
