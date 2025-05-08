import { Test, TestingModule } from '@nestjs/testing';
import { ListingsService } from './listings.service';
import { getModelToken } from '@nestjs/mongoose';
import { Listing } from './schemas/listing.schema';

describe('ListingsService', () => {
  let service: ListingsService;
  let model: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: getModelToken(Listing.name),
          useValue: {
            find: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
            countDocuments: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
    model = module.get(getModelToken(Listing.name));
  });

  it('should filter by city', async () => {
    model.lean.mockResolvedValue([{ id: '123', city: 'Paris' }]);
    model.countDocuments.mockResolvedValue(1);

    const result = await service.findAll({ city: 'Paris' }, 1, 10);
    expect(result.items).toEqual([{ id: '123', city: 'Paris' }]);
    expect(model.find).toHaveBeenCalledWith({ city: { $regex: 'Paris', $options: 'i' } });
  });

  it('should filter by source', async () => {
    model.lean.mockResolvedValue([{ id: '123', source: 'source1' }]);
    model.countDocuments.mockResolvedValue(1);

    const result = await service.findAll({ source: 'source1' }, 1, 10);
    expect(result.items).toEqual([{ id: '123', source: 'source1' }]);
    expect(model.find).toHaveBeenCalledWith({ source: 'source1' });
  });

  it('should filter by source and city', async () => {
    model.lean.mockResolvedValue([{ id: '123', source: 'source1', city: 'Paris' }]);
    model.countDocuments.mockResolvedValue(1);

    const result = await service.findAll({ source: 'source1', city: 'Paris' }, 1, 10);
    expect(result.items).toEqual([{ id: '123', source: 'source1', city: 'Paris' }]);
    expect(model.find).toHaveBeenCalledWith({
      source: 'source1',
      city: { $regex: 'Paris', $options: 'i' },
    });
  });
});