import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class IngestionState extends Document {
  @Prop({ required: true, unique: true })
  source: string;

  @Prop()
  lastProcessedId?: string;

  @Prop({ default: 0 })
  lastProcessedCount: number;
}

export const IngestionStateSchema = SchemaFactory.createForClass(IngestionState);