import { DynamicModule } from '@nestjs/common';
export declare class MongoModule {
    static forRoot(uri: string, dbName: string): DynamicModule;
}
