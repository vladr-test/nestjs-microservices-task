import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

export interface MessagePayload {
  event: string;
  data: any;
  timestamp: number;
  service: string;
}

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private publisher!: RedisClientType;
  private subscriber!: RedisClientType;

  constructor(@Inject('MESSAGING_URI') private readonly uri: string) {}

  async onModuleInit() {
    this.publisher = createClient({ url: this.uri }) as RedisClientType;
    this.subscriber = createClient({ url: this.uri }) as RedisClientType;

    await this.publisher.connect();
    await this.subscriber.connect();
    console.log('Messaging service initialized');
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
    console.log('Messaging service disconnected');
  }

  async publish(channel: string, payload: MessagePayload): Promise<void> {
    await this.publisher.publish(channel, JSON.stringify(payload));
  }

  async subscribe(
    channel: string,
    callback: (payload: MessagePayload) => void,
  ): Promise<void> {
    await this.subscriber.subscribe(channel, (message) => {
      try {
        const payload = JSON.parse(message) as MessagePayload;
        callback(payload);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });
  }
}
