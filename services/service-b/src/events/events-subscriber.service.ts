import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { RedisService } from '../../../libs/redis/src';
import { LogsService } from '../logs/logs.service';
import { TracingLogger } from '../common/services/tracing-logger.service';
import { randomUUID } from 'crypto';

interface EventPayload {
  event: string;
  data: unknown;
  timestamp: number;
  service: string;
  correlationId?: string;
  instanceId?: string;
}

interface StreamMessage {
  id: string;
  fields: Record<string, string>;
}

@Injectable()
export class EventsSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsSubscriberService.name);
  private readonly eventsStream = 'service-a-events-stream';
  private readonly consumerGroupName = 'service-b-consumers';
  private readonly consumerName: string;
  private readonly instanceId: string;
  private isRunning = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly logsService: LogsService,
  ) {
    this.instanceId =
      process.env.INSTANCE_ID || `service-b-${randomUUID().substring(0, 8)}`;
    this.consumerName = `${this.instanceId}-consumer`;

    TracingLogger.log(
      'EventsSubscriberService initialized',
      {
        correlationId: 'init',
        requestId: 'init',
        instanceId: this.instanceId,
        service: 'service-b',
      },
      {
        consumerName: this.consumerName,
        stream: this.eventsStream,
        consumerGroup: this.consumerGroupName,
      },
    );
  }

  async onModuleInit() {
    try {
      await this.redisService.streamGroupCreate(
        this.eventsStream,
        this.consumerGroupName,
        '0',
        true,
      );

      TracingLogger.log(
        'Consumer group ready',
        {
          correlationId: 'init',
          requestId: 'init',
          instanceId: this.instanceId,
          service: 'service-b',
        },
        {
          consumerGroup: this.consumerGroupName,
          consumerName: this.consumerName,
          stream: this.eventsStream,
        },
      );

      await this.recoverPendingMessages();

      this.isRunning = true;
      this.startMessageProcessing();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      TracingLogger.error(
        'Error initializing event subscriber',
        error instanceof Error ? error.stack : undefined,
        {
          correlationId: 'init',
          requestId: 'init',
          instanceId: this.instanceId,
          service: 'service-b',
        },
        {
          error: errorMessage,
          stream: this.eventsStream,
          consumerGroup: this.consumerGroupName,
        },
      );

      throw error;
    }
  }

  onModuleDestroy() {
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.logger.log('EventsSubscriberService stopped');
  }

  private async recoverPendingMessages(): Promise<void> {
    try {
      const allPending = await this.redisService.streamPending(
        this.eventsStream,
        this.consumerGroupName,
      );

      const pendingForThisConsumer = allPending.filter(
        (p): boolean => p.consumer === this.consumerName,
      );

      const pendingFromOtherConsumers = allPending.filter(
        (p): boolean => p.consumer !== this.consumerName && p.idleTime > 5000, // 5 seconds idle
      );

      if (
        pendingForThisConsumer.length === 0 &&
        pendingFromOtherConsumers.length === 0
      ) {
        TracingLogger.debug(
          'No pending messages to recover',
          {
            correlationId: 'recovery',
            requestId: 'recovery',
            instanceId: this.instanceId,
            service: 'service-b',
          },
          {
            stream: this.eventsStream,
            consumerGroup: this.consumerGroupName,
            consumerName: this.consumerName,
          },
        );
        return;
      }

      TracingLogger.log(
        `Found ${
          pendingForThisConsumer.length + pendingFromOtherConsumers.length
        } pending message(s) to recover (${pendingForThisConsumer.length} from this consumer, ${pendingFromOtherConsumers.length} from other consumers)`,
        {
          correlationId: 'recovery',
          requestId: 'recovery',
          instanceId: this.instanceId,
          service: 'service-b',
        },
        {
          totalPending: allPending.length,
          pendingForThisConsumer: pendingForThisConsumer.length,
          pendingFromOtherConsumers: pendingFromOtherConsumers.length,
          stream: this.eventsStream,
          consumerGroup: this.consumerGroupName,
        },
      );

      const allPendingMessages: Array<{
        id: string;
        fields: Record<string, string>;
      }> = [];

      if (pendingForThisConsumer.length > 0) {
        const pendingMessages = await this.redisService.streamReadPending(
          this.eventsStream,
          this.consumerGroupName,
          this.consumerName,
          100,
        );
        allPendingMessages.push(...pendingMessages);
      }

      if (pendingFromOtherConsumers.length > 0) {
        const messagesByConsumer = new Map<string, string[]>();
        for (const pending of pendingFromOtherConsumers) {
          if (!messagesByConsumer.has(pending.consumer)) {
            messagesByConsumer.set(pending.consumer, []);
          }
          messagesByConsumer.get(pending.consumer)!.push(pending.id);
        }

        for (const [deadConsumer, messageIds] of messagesByConsumer.entries()) {
          try {
            TracingLogger.log(
              `Claiming ${String(
                messageIds.length,
              )} pending message(s) from dead consumer: ${String(deadConsumer)}`,
              {
                correlationId: 'recovery',
                requestId: 'recovery',
                instanceId: this.instanceId,
                service: 'service-b',
              },
              {
                deadConsumer: String(deadConsumer),
                messageCount: messageIds.length,
                messageIds: messageIds.slice(0, 5),
              },
            );

            const claimedMessages = await this.redisService.streamClaim(
              this.eventsStream,
              this.consumerGroupName,
              this.consumerName,
              5000,
              messageIds,
            );

            allPendingMessages.push(...claimedMessages);

            TracingLogger.log(
              `Successfully claimed ${String(
                claimedMessages.length,
              )} message(s) from ${String(deadConsumer)}`,
              {
                correlationId: 'recovery',
                requestId: 'recovery',
                instanceId: this.instanceId,
                service: 'service-b',
              },
              {
                deadConsumer: String(deadConsumer),
                claimedCount: claimedMessages.length,
              },
            );
          } catch (claimError: unknown) {
            const claimErrorMessage =
              claimError instanceof Error
                ? claimError.message
                : String(claimError);
            TracingLogger.warn(
              `Failed to claim messages from ${String(deadConsumer)}`,
              {
                correlationId: 'recovery',
                requestId: 'recovery',
                instanceId: this.instanceId,
                service: 'service-b',
              },
              {
                deadConsumer: String(deadConsumer),
                messageCount: messageIds.length,
                error: claimErrorMessage,
              },
            );
          }
        }
      }

      const pendingMessages = allPendingMessages;

      if (pendingMessages.length > 0) {
        TracingLogger.log(
          'Recovering pending messages after restart',
          {
            correlationId: 'recovery',
            requestId: 'recovery',
            instanceId: this.instanceId,
            service: 'service-b',
          },
          {
            pendingCount: pendingMessages.length,
            stream: this.eventsStream,
            consumerGroup: this.consumerGroupName,
            consumerName: this.consumerName,
          },
        );

        for (const message of pendingMessages) {
          await this.handleMessage(message.id, message.fields);
        }

        TracingLogger.log(
          'Finished recovering pending messages',
          {
            correlationId: 'recovery',
            requestId: 'recovery',
            instanceId: this.instanceId,
            service: 'service-b',
          },
          {
            recoveredCount: pendingMessages.length,
          },
        );
      } else {
        TracingLogger.debug(
          'No pending messages to recover',
          {
            correlationId: 'recovery',
            requestId: 'recovery',
            instanceId: this.instanceId,
            service: 'service-b',
          },
          {
            stream: this.eventsStream,
            consumerGroup: this.consumerGroupName,
            consumerName: this.consumerName,
          },
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      TracingLogger.error(
        'Error recovering pending messages',
        error instanceof Error ? error.stack : undefined,
        {
          correlationId: 'recovery',
          requestId: 'recovery',
          instanceId: this.instanceId,
          service: 'service-b',
        },
        {
          error: errorMessage,
          stream: this.eventsStream,
        },
      );
    }
  }

  private startMessageProcessing(): void {
    const processMessages = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        const messagesResult = await this.redisService.streamReadGroup(
          this.eventsStream,
          this.consumerGroupName,
          this.consumerName,
          10,
          1000,
        );

        const messages: StreamMessage[] = Array.isArray(messagesResult)
          ? (messagesResult as StreamMessage[])
          : [];

        if (messages.length > 0) {
          for (const message of messages) {
            await this.handleMessage(message.id, message.fields);
          }
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        TracingLogger.error(
          'Error in message processing loop',
          error instanceof Error ? error.stack : undefined,
          {
            correlationId: 'poll',
            requestId: 'poll',
            instanceId: this.instanceId,
            service: 'service-b',
          },
          {
            error: errorMessage,
            stream: this.eventsStream,
          },
        );
      }

      if (this.isRunning) {
        setTimeout(() => {
          void processMessages();
        }, 100);
      }
    };

    void processMessages();
  }

  private async handleMessage(
    messageId: string,
    fields: Record<string, string>,
  ): Promise<void> {
    try {
      const eventData = JSON.parse(fields.event || '{}') as EventPayload;
      const correlationId =
        fields.correlationId || eventData.correlationId || messageId;

      const tracingContext = {
        correlationId,
        requestId: messageId,
        instanceId: this.instanceId,
        service: 'service-b',
      };

      TracingLogger.log('Message received', tracingContext, {
        streamId: messageId,
        messageId,
        event: eventData.event,
        stream: this.eventsStream,
        consumerGroup: this.consumerGroupName,
        consumerName: this.consumerName,
      });

      const isDuplicate = await this.logsService.isMessageProcessed(
        correlationId,
        messageId,
      );

      if (isDuplicate) {
        TracingLogger.warn('Duplicate message skipped', tracingContext, {
          streamId: messageId,
          messageId,
          event: eventData.event,
        });
        try {
          await this.redisService.streamAck(
            this.eventsStream,
            this.consumerGroupName,
            [messageId],
          );
          TracingLogger.log('Duplicate message acknowledged', tracingContext, {
            streamId: messageId,
            messageId,
            stream: this.eventsStream,
            consumerGroup: this.consumerGroupName,
          });
        } catch (ackError: unknown) {
          const ackErrorMessage =
            ackError instanceof Error ? ackError.message : String(ackError);
          TracingLogger.warn(
            'Failed to acknowledge duplicate message',
            tracingContext,
            {
              streamId: messageId,
              messageId,
              error: ackErrorMessage,
            },
          );
        }
        return;
      }

      TracingLogger.log('Dedup check passed', tracingContext, {
        streamId: messageId,
        messageId,
        event: eventData.event,
      });

      await this.logsService.createLog({
        event: eventData.event,
        data: eventData.data,
        timestamp: eventData.timestamp,
        service: eventData.service || 'service-a',
        createdAt: new Date(eventData.timestamp),
        correlationId,
        messageId,
        instanceId: eventData.instanceId,
        processedBy: this.instanceId,
      });

      TracingLogger.log('Message processed successfully', tracingContext, {
        streamId: messageId,
        messageId,
        event: eventData.event,
        stream: this.eventsStream,
      });

      try {
        await this.redisService.streamAck(
          this.eventsStream,
          this.consumerGroupName,
          [messageId],
        );
        TracingLogger.log('Message acknowledged', tracingContext, {
          streamId: messageId,
          messageId,
          stream: this.eventsStream,
          consumerGroup: this.consumerGroupName,
        });
      } catch (ackError: unknown) {
        const ackErrorMessage =
          ackError instanceof Error ? ackError.message : String(ackError);
        TracingLogger.error(
          'Failed to acknowledge message',
          ackError instanceof Error ? ackError.stack : undefined,
          tracingContext,
          {
            streamId: messageId,
            messageId,
            stream: this.eventsStream,
            consumerGroup: this.consumerGroupName,
            error: ackErrorMessage,
          },
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      TracingLogger.error(
        'Error handling message from Redis Stream',
        error instanceof Error ? error.stack : undefined,
        {
          correlationId: messageId,
          requestId: messageId,
          instanceId: this.instanceId,
          service: 'service-b',
        },
        {
          messageId,
          stream: this.eventsStream,
          error: errorMessage,
        },
      );
    }
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  getConsumerName(): string {
    return this.consumerName;
  }
}
