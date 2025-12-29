# Service B - Logging & Reporting Service

## Overview

Service B handles event logging, log querying, and PDF report generation. It subscribes to events from Service A via Redis, stores logs in MongoDB, and generates PDF reports with charts from time series data.

## Core Logic

### 1. Event Subscription
- Subscribes to Redis channel `service-a-events` on startup
- Listens for events published by Service A
- Automatically logs all received events to MongoDB `event_logs` collection
- Each log entry contains:
  - `event`: Event type (e.g., `DATA_FETCHED`, `FILE_UPLOADED`)
  - `data`: Event payload with metadata
  - `timestamp`: Unix timestamp
  - `service`: Source service name
  - `createdAt`: Date object

### 2. Log Querying (`/logs`)
- Queries stored event logs with filters:
  - `type`: Filter by event type
  - `startDate`, `endDate`: Date range filtering
  - `page`, `limit`: Pagination
- Returns paginated results with total count
- Uses MongoDB indexes for efficient querying:
  - Index on `timestamp` (descending)
  - Index on `event`
  - Index on `service`
  - Index on `createdAt`

### 3. PDF Report Generation (`/reports/pdf`)
- Generates PDF reports with embedded charts
- Fetches time series data from Redis using RedisTimeSeries
- Groups data by event type
- Creates charts using Chart.js (rendered to canvas)
- Generates PDF using PDFKit with:
  - Report header with date range
  - Charts for each event type showing frequency over time
  - Summary statistics
- Returns PDF as downloadable file

### 4. Time Series Data Retrieval
- Queries RedisTimeSeries for aggregated event data
- Groups events by type and time buckets
- Calculates statistics (count, average duration) per event type
- Used for chart generation in PDF reports