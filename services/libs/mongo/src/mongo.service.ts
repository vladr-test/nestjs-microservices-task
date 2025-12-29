import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { MongoClient, Db, Document } from 'mongodb';

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private client!: MongoClient;
  private db!: Db;

  constructor(
    @Inject('MONGO_URI') private readonly uri: string,
    @Inject('MONGO_DB_NAME') private readonly dbName: string,
  ) {}

  async onModuleInit() {
    this.client = new MongoClient(this.uri);
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    console.log(`Connected to MongoDB: ${this.dbName}`);
  }

  async onModuleDestroy() {
    await this.client.close();
    console.log('Disconnected from MongoDB');
  }

  getDb(): Db {
    return this.db;
  }

  getClient(): MongoClient {
    return this.client;
  }

  getCollection<T extends Document = any>(collectionName: string) {
    return this.db.collection<T>(collectionName);
  }
}
