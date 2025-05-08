import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';
import { Listing, ListingSchema } from './schemas/listing.schema';
import { IngestionState, IngestionStateSchema } from './schemas/ingestion-state.schema';
import { IngestionService } from './ingestion.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Listing.name, schema: ListingSchema }, { name: IngestionState.name, schema: IngestionStateSchema },]),
  ],
  controllers: [ListingsController],
  providers: [ListingsService, IngestionService],
})
export class ListingsModule {}