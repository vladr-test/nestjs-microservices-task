import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: RedisClientType;

  constructor(@Inject('REDIS_URI') private readonly uri: string) {}

  async onModuleInit() {
    this.client = createClient({ url: this.uri }) as RedisClientType;
    await this.client.connect();
    console.log('Connected to Redis');
  }

  async onModuleDestroy() {
    await this.client.quit();
    console.log('Disconnected from Redis');
  }

  getClient(): RedisClientType {
    return this.client;
  }

  async publish(channel: string, message: string): Promise<number> {
    return this.client.publish(channel, message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    const subscriber = this.client.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(channel, (msg) => callback(msg));
  }

  async timeseriesAdd(
    key: string,
    timestamp: number,
    value: number,
  ): Promise<number> {
    const args: any[] = ['TS.ADD', key, timestamp.toString(), value.toString()];
    
    try {
      const result = await this.client.sendCommand(args);
      return result as number;
    } catch (error: any) {
      if (error?.message?.includes('unknown command')) {
        throw new Error('RedisTimeSeries module not loaded. Please ensure redis-stack-server is running.');
      }
      throw error;
    }
  }

  async timeseriesCreate(
    key: string,
    retention?: number,
    labels?: { [key: string]: string },
  ): Promise<string> {
    const args: any[] = ['TS.CREATE', key];
    
    if (retention) {
      args.push('RETENTION', retention.toString());
    }
    
    if (labels) {
      args.push('LABELS');
      for (const [k, v] of Object.entries(labels)) {
        args.push(k, v);
      }
    }

    const result = await this.client.sendCommand(args);
    return result as string;
  }

  async timeseriesGet(key: string): Promise<[number, number] | null> {
    const args = ['TS.GET', key];
    const result = await this.client.sendCommand(args);
    if (!result || (Array.isArray(result) && result.length === 0)) return null;
    return result as [number, number];
  }

  async timeseriesRange(
    key: string,
    fromTimestamp: number,
    toTimestamp: number,
  ): Promise<Array<[number, number]>> {
    const args = ['TS.RANGE', key, fromTimestamp.toString(), toTimestamp.toString()];
    const result = await this.client.sendCommand(args);
    return (result || []) as Array<[number, number]>;
  }
}
