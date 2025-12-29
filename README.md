# NestJS Microservices Application

A microservices application built with NestJS, featuring two services that communicate via Redis messaging, with MongoDB for data persistence.

## Architecture

This application consists of:

- **Service A** (Port 3000): Data fetching, file upload, and search APIs
- **Service B** (Port 3002): Event logging, querying, and PDF report generation
- **MongoDB** (Port 27017): Primary database for both services
- **Redis** (Port 6379): Message broker and caching layer

## Prerequisites

Before running this application, ensure you have the following installed:

- [Docker](https://www.docker.com/get-started) (version 20.10 or higher)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0 or higher)
- [Node.js](https://nodejs.org/) (version 20 or higher) - if running locally without Docker
- [npm](https://www.npmjs.com/) (version 9 or higher) - if running locally without Docker

## Quick Start with Docker Compose

The easiest way to run the entire application is using Docker Compose:

1. **Clone the repository** (if applicable):
   ```bash
   git clone <repository-url>
   cd nestjs-microservices-task
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration if needed (default values should work for local development).

3. **Start all services**:
   ```bash
   docker-compose up -d
   ```

4. **Check service status**:
   ```bash
   docker-compose ps
   ```

5. **View logs**:
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f service-a
   docker-compose logs -f service-b
   ```

6. **Stop all services**:
   ```bash
   docker-compose down
   ```

7. **Stop and remove volumes** (clean slate):
   ```bash
   docker-compose down -v
   ```

## API Documentation

Once the services are running, you can access the Swagger API documentation:

- **Service A**: http://localhost:3000/api
- **Service B**: http://localhost:3002/api

## Service Details

### Service A

- **Port**: 3000
- **Database**: `service_a_db`
- **Features**:
  - Data fetching and file operations
  - File upload (JSON and Excel)
  - Record search and retrieval
  - Data persistence

**Endpoints**:
- Swagger UI: http://localhost:3000/api

### Service B

- **Port**: 3002
- **Database**: `service_b_db`
- **Features**:
  - Event logging and querying
  - PDF report generation with charts
  - Event subscription from Service A

**Endpoints**:
- Swagger UI: http://localhost:3002/api

## Data Storage

This section describes where data is stored in the application:

### MongoDB Databases

Data is persisted in MongoDB using Docker volumes:

- **MongoDB Volume**: `mongo_data` (Docker managed volume)
  - **Location in container**: `/data/db`
  - **Service A Database**: `service_a_db` - Stores data records, file metadata, and search indexes
  - **Service B Database**: `service_b_db` - Stores event logs and report metadata

**Note**: MongoDB data persists even after containers are stopped. To completely remove MongoDB data, use `docker-compose down -v`.

### Redis Data

Redis is used for caching and message queuing:

- **Redis Volume**: `redis_data` (Docker managed volume)
  - **Location in container**: `/data`
  - Stores cached data and message queue entries

**Note**: Redis data persists by default. To clear Redis data, remove the volume with `docker-compose down -v`.

### Data Persistence Summary

| Storage Type | Location | Persistence |
|-------------|----------|-------------|
| MongoDB Data | Docker volume `mongo_data` | Persists until volume is removed |
| Redis Data | Docker volume `redis_data` | Persists until volume is removed |
| Service A Data Files | `./services/service-a/data/` | Persists on host filesystem |
| Service A Uploads | `./services/service-a/uploads/` | Persists on host filesystem |

### Clearing Data

To clear all data:

```bash
# Stop containers and remove volumes (clears MongoDB and Redis data)
docker-compose down -v

# Manually remove file directories (clears uploaded files)
rm -rf ./services/service-a/data/*
rm -rf ./services/service-a/uploads/*
```

## Project Structure

This is a **monorepo** using npm workspaces for efficient dependency management:

```
nestjs-microservices-task/
├── package.json                # Root workspace configuration
├── docker-compose.yml          # Docker Compose configuration
├── .env.example                # Environment variables template
├── services/
│   ├── libs/                   # Shared libraries (workspace packages)
│   │   ├── mongo/              # MongoDB module (@libs/mongo)
│   │   ├── redis/              # Redis module (@libs/redis)
│   │   └── messaging/          # Messaging module (@libs/messaging)
│   ├── service-a/              # Service A application
│   │   ├── src/
│   │   │   ├── data/           # Data module
│   │   │   ├── records/        # Records module
│   │   │   └── events/         # Events module
│   │   └── Dockerfile
│   └── service-b/              # Service B application
│       ├── src/
│       │   ├── logs/           # Logs module
│       │   ├── reports/        # Reports module
│       │   └── events/          # Events module
│       └── Dockerfile
```