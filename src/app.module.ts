// import { Module } from '@nestjs/common';
// import { MongooseModule } from '@nestjs/mongoose';
// import { ScheduleModule } from '@nestjs/schedule';
// import { ListingsModule } from './listings/listings.module';

// @Module({
//   imports: [
//     MongooseModule.forRoot('mongodb://localhost:27017/ingest'),
//     ScheduleModule.forRoot(),
//     ListingsModule,
//   ],
// })
// export class AppModule {}

// src/app.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ListingsModule } from './listings/listings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
    ScheduleModule.forRoot(),
    ListingsModule,
  ],
})
export class AppModule {}