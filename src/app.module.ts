import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ListingsModule } from './listings/listings.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/ingest'),
    ScheduleModule.forRoot(),
    ListingsModule,
  ],
})
export class AppModule {}
