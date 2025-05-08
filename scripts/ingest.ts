import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { IngestionService } from '../src/listings/ingestion.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ingestionService = app.get(IngestionService);
  await ingestionService.manualIngest();
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});