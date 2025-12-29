import { DynamicModule, Module, Global } from '@nestjs/common';
import { MongoService } from './mongo.service';

@Global()
@Module({})
export class MongoModule {
  static forRoot(uri: string, dbName: string): DynamicModule {
    return {
      module: MongoModule,
      providers: [
        {
          provide: 'MONGO_URI',
          useValue: uri,
        },
        {
          provide: 'MONGO_DB_NAME',
          useValue: dbName,
        },
        MongoService,
      ],
      exports: [MongoService],
    };
  }
}
