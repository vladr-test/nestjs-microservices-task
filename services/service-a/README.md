# Service A - Data Management Service

## Overview

Service A handles data fetching, file processing, and record management. It fetches data from external APIs, processes uploaded files, stores records in MongoDB, and publishes events to Redis for Service B to consume.

## Core Logic

### 1. Data Fetching (`/data/fetch`)
- Fetches data from external HTTP/HTTPS APIs
- Supports JSON and Excel output formats
- Validates API responses and handles errors (timeouts, 404s, invalid data)
- Saves fetched data to local filesystem (`data/` directory)
- Publishes `DATA_FETCHED` event to Redis with metadata (URL, format, record count, duration)

### 2. File Upload (`/data/upload`)
- Accepts JSON and Excel files (`.json`, `.xlsx`, `.xls`)
- Validates file format, size (max 50MB), and content
- Parses file content and extracts records
- Inserts records into MongoDB `records` collection with metadata:
  - `_id`: Auto-generated ObjectId
  - `createdAt`, `updatedAt`: Timestamps
  - `sourceFile`: Original filename
- Creates indexes for efficient searching (text search, date sorting)
- Publishes `FILE_UPLOADED` event with upload statistics

### 3. Record Search (`/records/search`)
- Full-text search across all record fields using MongoDB text indexes
- Supports pagination (`page`, `limit`)
- Supports sorting by any field (`sortBy`, `sortOrder`)
- Returns paginated results with total count
- Publishes `RECORDS_SEARCHED` event with query metadata

### 4. Record Retrieval (`/records/:id`)
- Retrieves a single record by MongoDB ObjectId
- Publishes `RECORD_RETRIEVED` event

### 5. Event Publishing
- Publishes all API actions to Redis channel `service-a-events`
- Stores time series data in Redis using RedisTimeSeries module
- Each action creates/updates time series with action name as key
- Time series retention: 30 days
- Used by Service B for logging and analytics