import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Listing extends Document {
  @Prop({ required: true })
  id: string;

  @Prop()
  city?: string;

  @Prop()
  availability?: boolean;

  @Prop()
  pricePerNight?: number;

  @Prop({ type: Object })
  attributes: Record<string, any>;

  @Prop({ required: true })
  source: string;
}

export const ListingSchema = SchemaFactory.createForClass(Listing);

// Create indexes for efficient querying and deduplication
ListingSchema.index({ city: 1 });
ListingSchema.index({ availability: 1 });
ListingSchema.index({ pricePerNight: 1 });
ListingSchema.index({ 'attributes.name': 1 });
ListingSchema.index({ 'attributes.country': 1 });
ListingSchema.index({ 'attributes.priceSegment': 1 });
ListingSchema.index({ id: 1, source: 1 }, { unique: true }); // Unique index to prevent duplicates
ListingSchema.index({ source: 1 });