# Tech Assessment Backend Solution

## Overview
This is a NestJS backend solution for ingesting JSON data from S3, storing it in MongoDB, and exposing it via a filterable API.

## Setup
1. **Prerequisites**:
   - Node.js (v18+)
   - MongoDB (running locally or via Docker)
   - npm or yarn

2. **Installation**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Create a `.env` file:
   ```
   MONGODB_URI=mongodb://localhost:27017/<db-name>
   ```

4. **Run the Application**:
   ```bash
   npm run start:dev
   ```

5. **Run Manual Ingestion**:
   ```bash
   npx ts-node scripts/ingest.ts
   ```

6. **Run Tests**:
   ```bash
   npm run test
   ```

## API
- **GET /listings**: Retrieve listings with optional filters.
  - Query Parameters:
    - `source`: Filter by source (e.g., `source1`, `source2`).
    - `city`: Filter by city (partial match).
    - `availability`: Filter by availability (true/false).
    - `pricePerNightMin`: Minimum price per night.
    - `pricePerNightMax`: Maximum price per night.
    - `name`: Filter by name (partial match).
    - `country`: Filter by country (partial match).
    - `priceSegment`: Filter by price segment (high/medium/low).
    - `page`: Page number (default: 1).
    - `limit`: Items per page (default: 10).

  - Examples: 
      - `GET /listings?city=Paris&availability=true&pricePerNightMin=200`
      - `GET /listings?source=source1&city=Paris&availability=true&pricePerNightMin=200`

## Extending for New JSON Sources
To support new JSON sources with different structures:
1. Add the new source to the `sources` array in `ingestion.service.ts` with its URL and name.
2. Update the `normalizeData` method to map new fields to the unified schema (e.g., add new fields to `city`, `availability`, etc.).
3. Add indexes for new filterable fields in `listing.schema.ts`.
4. Update the `findAll` method in `listings.service.ts` to support new filter parameters.


## Notes
- The solution uses streaming to handle large JSON files (up to 1GB).
- The solution ensures that ingestion resumes from where it stopped. For this an ingestion schema is created to store and track the state.
- Data duplication was prevented by doing the following:
  - Creating a compound unique index on `id` and `source` in the listings collection to prevent duplicate insertions at the database level. This ensures that MongoDB rejects any document with the same id and source combination.
  - Upsert During Ingestion: Instead of using `insertMany`, I used `bulkWrite` with updateOne operations in upsert mode `(upsert: true)`.This checks if a document with the same `id` and `source` exists; if it does, it updates the document; if not, it inserts a new one.
  - To verify that there are no duplicates after ingestion, run:
    ```bash
    db.listings.aggregate([
        { $group: { _id: { id: "$id", source: "$source" }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
    ]);
    ```
- MongoDB indexes ensure efficient querying.
- The data model is extensible via the `attributes` field.
- The ingestion runs hourly via a cron job and can be triggered manually.

## Improvements
1. Performance Optimisation
   - Ingestion Bottlenecks: The current streaming approach (JSONStream with batch upserts) is memory-efficient but can be slow for very large files (eg., source2 with more data size). Parallel processing or distributed ingestion could improve throughput(e.g., `Bull with Redis` or `Kafka` for very large files).
   - Database Performance: MongoDB indexes are in place, but heavy read/write operations under high load may require sharding or replication.
   - API Response Time: The `GET /listings` endpoint uses pagination, but complex queries (e.g., regex on city) can be slow without caching.
   - Monitor index usage with `explain()` and remove unused indexes to reduce write overhead.

2. Reliability and Fault Tolerance
   - Error Recovery: The ingestion process lacks retry mechanisms for transient failures (e.g., network issues with S3 or MongoDB timeouts).
   - Idempotency: Deduplication via unique indexes and upserts is in place and robust, but ingestion failures mid-process could leave partial data.
   - Monitoring: Lack of metrics or alerts for ingestion failures, API errors, or performance degradation.

3. Scalability
   - Horizontal Scaling: The single Node.js process may become a bottleneck under high load. A containerized, distributed architecture may be considered in place.
   - Source Scalability: Adding more sources or larger files requires dynamic source management and load balancing.
   - Database Scalability: MongoDB may need to scale out (sharding) or use a read replica for high read traffic. 

4. Maintainability
   - Configuration: Hardcoded URLs and batch sizes limit flexibility. We could move those to environment variables or a configuration service.
   - Logging: Structured logging and centralized log aggregation are needed and helpful for debugging.

5. Security
   - API Security: Some form of authentication or rate limiting especially on the `GET /listings` endpoint would be useful here in a production setting