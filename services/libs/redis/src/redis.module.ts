import { DynamicModule, Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({})
export class RedisModule {
  static forRoot(uri: string): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: 'REDIS_URI',
          useValue: uri,
        },
        RedisService,
      ],
      exports: [RedisService],
    };
  }
}
