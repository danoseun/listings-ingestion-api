import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import * as JSONStream from 'JSONStream';
import { Listing } from './schemas/listing.schema';
import * as crypto from 'crypto';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly sources = [
    {
      url: 'https://buenro-tech-assessment-materials.s3.eu-north-1.amazonaws.com/structured_generated_data.json',
      name: 'source1',
    },
    {
      url: 'https://buenro-tech-assessment-materials.s3.eu-north-1.amazonaws.com/large_generated_data.json',
      name: 'source2',
    },
  ];

  constructor(
    @InjectModel(Listing.name) private listingModel: Model<Listing>,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS, { name: 'dataIngestionCron' })
  async ingestData() {
    this.logger.log('Starting data ingestion');
    for (const source of this.sources) {
      try {
        await this.processSource(source.url, source.name);
      } catch (error) {
        this.logger.error(`Failed to process ${source.name}: ${error.message}`);
        throw error;
      }
    }
    this.logger.log('Data ingestion completed');
  }

  async manualIngest() {
    this.logger.log('Starting manual ingestion');
    await this.ingestData();
  }

  private async processSource(url: string, sourceName: string): Promise<void> {
    this.logger.log(`Processing source: ${sourceName}`);
    return new Promise((resolve, reject) => {
      let recordCount = 0;
      let insertedCount = 0;
      let updatedCount = 0;
      let batch: any[] = [];
      const batchSize = sourceName === 'source2' ? 500 : 1000;

      axios({
        method: 'get',
        url,
        responseType: 'stream',
        timeout: sourceName === 'source2' ? 60000 : 30000,
      })
        .then((response) => {
          const stream = response.data.pipe(JSONStream.parse('*'));

          stream.on('data', (data: { id?: any; city?: string; address?: { city?: string; }; availability?: boolean; isAvailable?: boolean; pricePerNight?: string | number; priceForNight?: string | number; }) => {
            try {
              const normalized = this.normalizeData(data, sourceName);
              if (!normalized.id) {
                this.logger.warn(
                  `Skipping invalid record in ${sourceName}: missing id`,
                );
                return;
              }
              batch.push({
                updateOne: {
                  filter: { id: normalized.id, source: normalized.source },
                  update: { $set: normalized },
                  upsert: true,
                },
              });
              recordCount++;
              if (recordCount % 1000 === 0) {
                this.logger.log(
                  `Processed ${recordCount} records for ${sourceName}`,
                );
              }

              if (batch.length >= batchSize) {
                stream.pause();
                this.listingModel
                  .bulkWrite(batch)
                  .then((result) => {
                    insertedCount += result.upsertedCount || 0;
                    updatedCount += result.modifiedCount || 0;
                    batch = [];
                    stream.resume();
                  })
                  .catch((error) => {
                    this.logger.error(
                      `Failed to process batch for ${sourceName}: ${error.message}`,
                    );
                    stream.destroy(error);
                  });
              }
            } catch (error) {
              this.logger.error(
                `Error normalizing record in ${sourceName}: ${error.message}`,
              );
            }
          });

          stream.on('end', async () => {
            try {
              if (batch.length > 0) {
                const result = await this.listingModel.bulkWrite(batch);
                insertedCount += result.upsertedCount || 0;
                updatedCount += result.modifiedCount || 0;
              }
              this.logger.log(
                `Ingestion completed for ${sourceName}: ${recordCount} records processed, ${insertedCount} inserted, ${updatedCount} updated`,
              );
              if (recordCount !== insertedCount + updatedCount) {
                this.logger.warn(
                  `Mismatch in ${sourceName}: ${recordCount - (insertedCount + updatedCount)} records not processed`,
                );
              }
              resolve();
            } catch (error) {
              this.logger.error(
                `Final batch processing failed for ${sourceName}: ${error.message}`,
              );
              reject(error);
            }
          });

          stream.on('error', (error: { message: any; }) => {
            this.logger.error(
              `Stream error for ${sourceName}: ${error.message}`,
            );
            reject(error);
          });
        })
        .catch((error) => {
          this.logger.error(`Failed to fetch ${sourceName}: ${error.message}`);
          reject(error);
        });
    });
  }

  private normalizeData(
    data: {
      id?: any;
      city?: string;
      address?: { city?: string };
      availability?: boolean;
      isAvailable?: boolean;
      pricePerNight?: string | number;
      priceForNight?: string | number;
    },
    source: string,
  ): Partial<Listing> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data record');
    }

    const base: Partial<Listing> = {
      id: data.id?.toString(),
      source,
      attributes: { ...data },
    };

    if (data.city || data.address?.city) {
      base.city = data.city || data.address?.city;
    }
    if (data.availability !== undefined) {
      base.availability = data.availability;
    } else if (data.isAvailable !== undefined) {
      base.availability = data.isAvailable;
    }
    if (data.pricePerNight) {
      base.pricePerNight = Number(data.pricePerNight);
    } else if (data.priceForNight) {
      base.pricePerNight = Number(data.priceForNight);
    }

    return base;
  }
}
