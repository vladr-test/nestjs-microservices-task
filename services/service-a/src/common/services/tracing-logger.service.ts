import { Injectable, Logger } from '@nestjs/common';

export interface TracingContext {
  correlationId: string;
  requestId: string;
  instanceId: string;
  service: string;
  [key: string]: unknown;
}

@Injectable()
export class TracingLogger {
  private static instanceId: string = 'unknown';
  private static logger = new Logger('TracingLogger');

  static setInstanceId(id: string): void {
    TracingLogger.instanceId = id;
    TracingLogger.logger.log(
      `TracingLogger initialized with instanceId: ${id}`,
    );
  }

  static getInstanceId(): string {
    return TracingLogger.instanceId;
  }

  private static safeStringify(value: unknown): string {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }
    if (typeof value === 'symbol') {
      return value.toString();
    }
    if (typeof value === 'function') {
      return '[Function]';
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return '[Unknown]';
  }

  private static formatConsoleLog(
    message: string,
    context?: TracingContext,
    metadata?: Record<string, unknown>,
  ): string {
    const parts: string[] = [];

    const service = context?.service || 'unknown';
    parts.push(`[service=${service}]`);

    const replica =
      context?.instanceId || TracingLogger.instanceId || 'unknown';
    parts.push(`[replica=${replica}]`);

    if (context?.correlationId) {
      parts.push(`[correlationId=${context.correlationId}]`);
    }

    if (context?.requestId && context.requestId !== context.correlationId) {
      parts.push(`[requestId=${context.requestId}]`);
    }

    if (metadata?.messageId !== undefined && metadata.messageId !== null) {
      const streamId = TracingLogger.safeStringify(metadata.messageId);
      parts.push(`[streamId=${streamId}]`);
    } else if (metadata?.streamId !== undefined && metadata.streamId !== null) {
      const streamId = TracingLogger.safeStringify(metadata.streamId);
      parts.push(`[streamId=${streamId}]`);
    }

    if (metadata?.action !== undefined && metadata.action !== null) {
      const action = TracingLogger.safeStringify(metadata.action);
      parts.push(`[action=${action}]`);
    } else if (metadata?.event !== undefined && metadata.event !== null) {
      const event = TracingLogger.safeStringify(metadata.event);
      parts.push(`[event=${event}]`);
    }

    if (metadata?.duration !== undefined && metadata.duration !== null) {
      const duration = TracingLogger.safeStringify(metadata.duration);
      parts.push(`[duration=${duration}]`);
    }

    if (metadata?.statusCode !== undefined && metadata.statusCode !== null) {
      const statusCode = TracingLogger.safeStringify(metadata.statusCode);
      parts.push(`[status=${statusCode}]`);
    }

    const logLine = `${parts.join(' ')} ${message}`;

    return logLine;
  }

  static createLogEntry(
    level: 'log' | 'error' | 'warn' | 'debug' | 'verbose',
    message: string,
    context?: TracingContext,
    metadata?: Record<string, unknown>,
  ): void {
    const consoleLog = TracingLogger.formatConsoleLog(
      message,
      context,
      metadata,
    );

    switch (level) {
      case 'error':
        TracingLogger.logger.error(consoleLog);
        break;
      case 'warn':
        TracingLogger.logger.warn(consoleLog);
        break;
      case 'debug':
        TracingLogger.logger.debug(consoleLog);
        break;
      case 'verbose':
        TracingLogger.logger.verbose(consoleLog);
        break;
      default:
        TracingLogger.logger.log(consoleLog);
    }
  }

  static log(
    message: string,
    context?: TracingContext,
    metadata?: Record<string, unknown>,
  ): void {
    TracingLogger.createLogEntry('log', message, context, metadata);
  }

  static error(
    message: string,
    trace?: string,
    context?: TracingContext,
    metadata?: Record<string, unknown>,
  ): void {
    TracingLogger.createLogEntry('error', message, context, {
      ...metadata,
      trace,
    });
  }

  static warn(
    message: string,
    context?: TracingContext,
    metadata?: Record<string, unknown>,
  ): void {
    TracingLogger.createLogEntry('warn', message, context, metadata);
  }

  static debug(
    message: string,
    context?: TracingContext,
    metadata?: Record<string, unknown>,
  ): void {
    TracingLogger.createLogEntry('debug', message, context, metadata);
  }
}
