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
      const result: unknown = await this.client.sendCommand(args);
      if (typeof result === 'number') {
        return result;
      }
      if (typeof result === 'string') {
        const parsed = parseInt(result, 10);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
      throw new Error(`Unexpected result type from TS.ADD: ${typeof result}`);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message?.includes('unknown command')
      ) {
        throw new Error(
          'RedisTimeSeries module not loaded. Please ensure redis-stack-server is running.',
        );
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to add to time series ${key}: ${errorMessage}`,
      );
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

    try {
      const result: unknown = await this.client.sendCommand(args);
      if (typeof result === 'string') {
        return result;
      }
      return String(result);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.message?.includes('already exists') ||
          error.message?.includes('BUSYKEY') ||
          error.message?.includes('TSDB'))
      ) {
        return 'OK';
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create time series ${key}: ${errorMessage}`,
      );
    }
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

  async streamAdd(
    streamKey: string,
    fields: Record<string, string>,
    id: string = '*',
  ): Promise<string> {
    const args: any[] = ['XADD', streamKey, id];
    for (const [key, value] of Object.entries(fields)) {
      args.push(key, value);
    }
    try {
      const result: unknown = await this.client.sendCommand(args);
      if (typeof result === 'string') {
        return result;
      }
      const stringResult: string = String(result);
      return stringResult;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to add message to stream ${streamKey}: ${errorMessage}`,
      );
    }
  }

  async streamGroupCreate(
    streamKey: string,
    groupName: string,
    startId: string = '0', // '0' for all messages, '$' for new messages)
    mkstream: boolean = true,
  ): Promise<string> {
    const args: any[] = ['XGROUP', 'CREATE', streamKey, groupName, startId];
    if (mkstream) {
      args.push('MKSTREAM');
    }
    try {
      const result: unknown = await this.client.sendCommand(args);
      if (typeof result === 'string') {
        return result;
      }
      return String(result);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message?.includes('BUSYGROUP')
      ) {
        return 'OK';
      }
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to create consumer group ${groupName}: ${errorMessage}`,
      );
    }
  }

  async streamReadGroup(
    streamKey: string,
    groupName: string,
    consumerName: string,
    count: number = 1,
    blockMs: number = 0,
  ): Promise<Array<{ id: string; fields: Record<string, string> }>> {
    const args: any[] = [
      'XREADGROUP',
      'GROUP',
      groupName,
      consumerName,
      'COUNT',
      count.toString(),
    ];
    if (blockMs > 0) {
      args.push('BLOCK', blockMs.toString());
    }
    args.push('STREAMS', streamKey, '>');

    try {
      const result: unknown = await this.client.sendCommand(args);

      if (!result || !Array.isArray(result) || result.length === 0) {
        return [];
      }

      const streamData = result[0];
      if (
        !Array.isArray(streamData) ||
        streamData.length !== 2 ||
        !Array.isArray(streamData[1])
      ) {
        return [];
      }

      const messages: Array<{ id: string; fields: Record<string, string> }> =
        [];

      for (const messageEntry of streamData[1]) {
        if (
          !Array.isArray(messageEntry) ||
          messageEntry.length !== 2 ||
          typeof messageEntry[0] !== 'string' ||
          !Array.isArray(messageEntry[1])
        ) {
          continue;
        }
        const id = messageEntry[0];
        const fieldArray = messageEntry[1];
        const fields: Record<string, string> = {};
        for (let i = 0; i < fieldArray.length; i += 2) {
          if (
            typeof fieldArray[i] === 'string' &&
            typeof fieldArray[i + 1] === 'string'
          ) {
            fields[fieldArray[i]] = fieldArray[i + 1];
          }
        }
        messages.push({ id, fields });
      }

      return messages;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to read from stream ${streamKey}: ${errorMessage}`,
      );
    }
  }

  async streamAck(
    streamKey: string,
    groupName: string,
    messageIds: string[],
  ): Promise<number> {
    const args: any[] = ['XACK', streamKey, groupName, ...messageIds];
    const result = await this.client.sendCommand(args);
    return result as number;
  }

  async streamInfo(streamKey: string): Promise<{
    length: number;
    radixTreeKeys: number;
    radixTreeNodes: number;
    groups: number;
    lastGeneratedId: string;
    firstEntry: { id: string; fields: Record<string, string> } | null;
    lastEntry: { id: string; fields: Record<string, string> } | null;
  }> {
    const args = ['XINFO', 'STREAM', streamKey];
    const result = await this.client.sendCommand(args);
    
    const info: any = {};
    const resultArray = result as Array<string | number>;
    for (let i = 0; i < resultArray.length; i += 2) {
      const key = resultArray[i] as string;
      const value = resultArray[i + 1];
      info[key] = value;
    }

    return {
      length: info.length || 0,
      radixTreeKeys: info['radix-tree-keys'] || 0,
      radixTreeNodes: info['radix-tree-nodes'] || 0,
      groups: info.groups || 0,
      lastGeneratedId: info['last-generated-id'] || '0-0',
      firstEntry: null,
      lastEntry: null,
    };
  }

  async streamPending(
    streamKey: string,
    groupName: string,
    consumerName?: string,
  ): Promise<Array<{
    id: string;
    consumer: string;
    idleTime: number;
    deliveryCount: number;
  }>> {
    const args: any[] = ['XPENDING', streamKey, groupName];
    if (consumerName) {
      args.push(consumerName);
    }
    const result = await this.client.sendCommand(args);
    
    if (!result || !Array.isArray(result) || result.length < 1) {
      return [];
    }

    const count = result[0] as number;
    if (count === 0 || !result[3]) {
      return [];
    }

    const pendingArray = result[3] as Array<[string, string, number, number]>;
    if (!Array.isArray(pendingArray)) {
      return [];
    }

    return pendingArray.map(([id, consumer, idleTime, deliveryCount]) => ({
      id,
      consumer,
      idleTime,
      deliveryCount,
    }));
  }

  async streamReadPending(
    streamKey: string,
    groupName: string,
    consumerName: string,
    count: number = 10,
  ): Promise<Array<{ id: string; fields: Record<string, string> }>> {
    const args: any[] = [
      'XREADGROUP',
      'GROUP',
      groupName,
      consumerName,
      'COUNT',
      count.toString(),
      'STREAMS',
      streamKey,
      '0', // '0' for all messages, '$' for new messages)
    ];

    const result = await this.client.sendCommand(args);
    
    if (!result || !Array.isArray(result) || result.length === 0) {
      return [];
    }

    const streamData = result[0] as [string, Array<[string, string[]]>];
    const messages: Array<{ id: string; fields: Record<string, string> }> = [];

    for (const [id, fieldArray] of streamData[1]) {
      const fields: Record<string, string> = {};
      for (let i = 0; i < fieldArray.length; i += 2) {
        fields[fieldArray[i]] = fieldArray[i + 1];
      }
      messages.push({ id, fields });
    }

    return messages;
  }

  async streamClaim( 
    streamKey: string,
    groupName: string,
    consumerName: string,
    minIdleTime: number,
    messageIds: string[],
  ): Promise<Array<{ id: string; fields: Record<string, string> }>> {
    const args: any[] = [
      'XCLAIM',
      streamKey,
      groupName,
      consumerName,
      minIdleTime.toString(),
      ...messageIds,
    ];
    const result = await this.client.sendCommand(args);

    if (!result || !Array.isArray(result) || result.length === 0) {
      return [];
    }

    const messages: Array<{ id: string; fields: Record<string, string> }> = [];
    for (const [id, fieldArray] of result as Array<[string, string[]]>) {
      const fields: Record<string, string> = {};
      for (let i = 0; i < fieldArray.length; i += 2) {
        fields[fieldArray[i]] = fieldArray[i + 1];
      }
      messages.push({ id, fields });
    }

    return messages;
  }
}
