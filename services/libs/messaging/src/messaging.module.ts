import { DynamicModule, Module, Global } from '@nestjs/common';
import { MessagingService } from './messaging.service';

@Global()
@Module({})
export class MessagingModule {
  static forRoot(uri: string): DynamicModule {
    return {
      module: MessagingModule,
      providers: [
        {
          provide: 'MESSAGING_URI',
          useValue: uri,
        },
        MessagingService,
      ],
      exports: [MessagingService],
    };
  }
}
