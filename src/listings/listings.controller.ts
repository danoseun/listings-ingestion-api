import { Controller, Get, Query } from '@nestjs/common';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  async findAll(
    @Query('source') source: string,
    @Query('city') city: string,
    @Query('availability') availability: string,
    @Query('pricePerNightMin') pricePerNightMin: string,
    @Query('pricePerNightMax') pricePerNightMax: string,
    @Query('name') name: string,
    @Query('country') country: string,
    @Query('priceSegment') priceSegment: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const filters = { source, city, availability, pricePerNightMin, pricePerNightMax, name, country, priceSegment };
    return this.listingsService.findAll(filters, Number(page), Number(limit));
  }
}
