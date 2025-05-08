import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import * as JSONStream from 'JSONStream';
import { Listing } from './schemas/listing.schema';
import { IngestionState } from './schemas/ingestion-state.schema';

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
    @InjectModel(IngestionState.name) private ingestionStateModel: Model<IngestionState>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'dataIngestionCron' })
  async ingestData() {
    this.logger.log('Starting data ingestion');
    for (const source of this.sources) {
      this.logger.log(`Beginning ingestion for ${source.name}`);
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
    const state = await this.ingestionStateModel.findOne({ source: sourceName }).exec();
    const lastProcessedId = state?.lastProcessedId;
    let recordCount = state?.lastProcessedCount || 0;
    let newRecords = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let batch: any[] = [];
    const batchSize = sourceName === 'source2' ? 500 : 1000;
    let isSkipping = !!lastProcessedId;
    let currentId: string | undefined;

    if (lastProcessedId) {
      this.logger.log(`Resuming ${sourceName} from last processed ID: ${lastProcessedId}`);
    }

    return new Promise((resolve, reject) => {
      axios({
        method: 'get',
        url,
        responseType: 'stream',
        timeout: sourceName === 'source2' ? 60000 : 30000,
      })
        .then((response) => {
          const stream = response.data.pipe(JSONStream.parse('*'));

          stream.on('data', (data: { id?: any; city?: string; address?: { city?: string }; availability?: boolean; isAvailable?: boolean; pricePerNight?: string | number; priceForNight?: string | number }) => {
            try {
              currentId = data.id?.toString();
              if (!currentId) {
                this.logger.warn(`Skipping invalid record in ${sourceName}: missing id`);
                return;
              }

              if (isSkipping) {
                if (currentId === lastProcessedId) {
                  isSkipping = false;
                  this.logger.log(`Reached last processed ID for ${sourceName}, resuming ingestion`);
                }
                return;
              }

              const normalized = this.normalizeData(data, sourceName);
              batch.push({
                updateOne: {
                  filter: { id: normalized.id, source: normalized.source },
                  update: { $set: normalized },
                  upsert: true,
                },
              });
              recordCount++;
              newRecords++;

              if (newRecords % 1000 === 0) {
                const logCount = sourceName === 'source2' ? newRecords.toLocaleString() : this.formatInThousands(newRecords);
                this.logger.log(`Processed ${logCount} new records for ${sourceName}`);
              }

              if (batch.length >= batchSize) {
                stream.pause();
                this.listingModel
                  .bulkWrite(batch)
                  .then(async (result) => {
                    insertedCount += result.upsertedCount || 0;
                    updatedCount += result.modifiedCount || 0;

                    // Update ingestion state
                    await this.ingestionStateModel.findOneAndUpdate(
                      { source: sourceName },
                      { lastProcessedId: currentId, lastProcessedCount: recordCount, updatedAt: new Date() },
                      { upsert: true, new: true },
                    ).exec();

                    batch = [];
                    stream.resume();
                  })
                  .catch((error) => {
                    this.logger.error(`Failed to process batch for ${sourceName}: ${error.message}`);
                    stream.destroy(error);
                  });
              }
            } catch (error) {
              this.logger.error(`Error normalizing record in ${sourceName}: ${error.message}`);
            }
          });

          stream.on('end', async () => {
            try {
              if (batch.length > 0) {
                const result = await this.listingModel.bulkWrite(batch);
                insertedCount += result.upsertedCount || 0;
                updatedCount += result.modifiedCount || 0;

                // Update final ingestion state
                await this.ingestionStateModel.findOneAndUpdate(
                  { source: sourceName },
                  { lastProcessedId: currentId, lastProcessedCount: recordCount, updatedAt: new Date() },
                  { upsert: true, new: true },
                ).exec();
              }

              this.logger.log(
                `Ingestion completed for ${sourceName}: ${this.formatInThousands(recordCount)} records processed, ${this.formatInThousands(insertedCount)} inserted, ${this.formatInThousands(updatedCount)} updated`,
              );
              if (recordCount !== insertedCount + updatedCount) {
                this.logger.warn(
                  `Mismatch in ${sourceName}: ${this.formatInThousands(recordCount - (insertedCount + updatedCount))} records not processed`,
                );
              }
              resolve();
            } catch (error) {
              this.logger.error(`Final batch processing failed for ${sourceName}: ${error.message}`);
              reject(error);
            }
          });

          stream.on('error', (error: { message: any }) => {
            this.logger.error(`Stream error for ${sourceName}: ${error.message}`);
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

  private formatInThousands(count: number): string {
    if (count < 1000) {
      return `${count}`;
    }
    const thousands = Math.floor(count / 1000);
    return `${thousands}K`;
  }
}