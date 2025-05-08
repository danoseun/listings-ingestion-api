import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Listing } from './schemas/listing.schema';

@Injectable()
export class ListingsService {
  constructor(@InjectModel(Listing.name) private listingModel: Model<Listing>) {}

  async findAll(filters: any, page: number, limit: number) {
    const query: any = {};

    if (filters.source) {
      query.source = filters.source;
    }
    
    if (filters.city) {
      query.city = { $regex: filters.city, $options: 'i' };
    }
    if (filters.availability !== undefined) {
      query.availability = filters.availability === 'true';
    }
    if (filters.pricePerNightMin) {
      query.pricePerNight = { $gte: Number(filters.pricePerNightMin) };
    }
    if (filters.pricePerNightMax) {
      query.pricePerNight = { ...query.pricePerNight, $lte: Number(filters.pricePerNightMax) };
    }
    if (filters.name) {
      query['attributes.name'] = { $regex: filters.name, $options: 'i' };
    }
    if (filters.country) {
      query['attributes.country'] = { $regex: filters.country, $options: 'i' };
    }
    if (filters.priceSegment) {
      query['attributes.priceSegment'] = filters.priceSegment;
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.listingModel.find(query).skip(skip).limit(limit).lean(),
      this.listingModel.countDocuments(query),
    ]);

    return { items, total, page, limit };
  }
}
