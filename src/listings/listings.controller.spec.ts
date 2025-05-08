import { Test, TestingModule } from '@nestjs/testing';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

describe('ListingsController', () => {
  let controller: ListingsController;
  let service: ListingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [
        {
          provide: ListingsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }),
          },
        },
      ],
    }).compile();

    controller = module.get<ListingsController>(ListingsController);
    service = module.get<ListingsService>(ListingsService);
  });


  it('should return filtered listings by city', async () => {
    const result = { items: [{ id: '123', city: 'Paris', source: 'source1' }], total: 1, page: 1, limit: 10 };
    //@ts-ignore
    jest.spyOn(service, 'findAll').mockResolvedValue(result);

    const response = await controller.findAll(
      undefined,
      'Paris',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '1',
      '10',
    );
    expect(response).toEqual(result);
    expect(service.findAll).toHaveBeenCalledWith({ city: 'Paris' }, 1, 10);
  });

  it('should return filtered listings by source', async () => {
    const result = { items: [{ id: '123', source: 'source1' }], total: 1, page: 1, limit: 10 };
    //@ts-ignore
    jest.spyOn(service, 'findAll').mockResolvedValue(result);

    const response = await controller.findAll(
      'source1',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '1',
      '10',
    );
    expect(response).toEqual(result);
    expect(service.findAll).toHaveBeenCalledWith({ source: 'source1' }, 1, 10);
  });
});