# Easy Blind Backend

**Easy Blind Backend** is a production-style NestJS REST API for Easy-Blinds job management. It uses **MongoDB with Mongoose**, environment-based configuration, validated DTOs, clean modules, service-layer business logic, consistent error responses, Swagger API documentation, and e2e CRUD verification.

## Technology Stack

| Layer | Implementation |
|---|---|
| Runtime | Node.js with TypeScript |
| Framework | NestJS |
| Database | MongoDB |
| ODM | Mongoose via `@nestjs/mongoose` |
| Validation | `class-validator` and `class-transformer` |
| API Documentation | Swagger at `/docs` |
| Security Middleware | Helmet and CORS |
| Compression | `compression` middleware |
| Testing | Jest, Supertest, and `mongodb-memory-server` |

## Environment Configuration

Create a `.env` file in this backend root. A working local example is already provided.

```bash
NODE_ENV=development
PORT=4000
API_PREFIX=api
CORS_ORIGIN=*
MONGODB_URI=mongodb://127.0.0.1:27017/easy-blinds
```

The MongoDB connection is configured in `src/database/database.module.ts` with `MongooseModule.forRootAsync`. The application reads `MONGODB_URI` through `@nestjs/config` and fails early if the value is missing or invalid.

## Installation

```bash
npm install
```

## Running the Backend

```bash
# development mode
npm run start:dev

# production build
npm run build
npm run start:prod
```

After startup, the API is available at `http://localhost:4000/api/v1`, and Swagger documentation is available at `http://localhost:4000/docs`.

## CRUD API Routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/v1/jobs` | Create a new job |
| `GET` | `/api/v1/jobs` | Read jobs with pagination, search, and filters |
| `GET` | `/api/v1/jobs/:id` | Read one job by MongoDB ObjectId |
| `PATCH` | `/api/v1/jobs/:id` | Update a job |
| `DELETE` | `/api/v1/jobs/:id` | Delete a job |
| `GET` | `/api/v1/health` | Check application and MongoDB readiness |

## Example Requests

### Create Job

```bash
curl -X POST http://localhost:4000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Aarav Sharma",
    "customerEmail": "aarav@example.com",
    "customerPhone": "+919876543210",
    "address": "12 MG Road, Bengaluru, Karnataka",
    "productType": "Motorized Blinds",
    "quantity": 4,
    "priority": "high",
    "notes": "Customer prefers afternoon appointment.",
    "scheduledAt": "2026-05-20T10:30:00.000Z"
  }'
```

### Read Jobs

```bash
curl "http://localhost:4000/api/v1/jobs?page=1&limit=10&search=aarav"
```

### Update Job

```bash
curl -X PATCH http://localhost:4000/api/v1/jobs/<JOB_ID> \
  -H "Content-Type: application/json" \
  -d '{ "status": "completed", "quantity": 5 }'
```

### Delete Job

```bash
curl -X DELETE http://localhost:4000/api/v1/jobs/<JOB_ID>
```

## Validation and Error Handling

Incoming request bodies are validated globally using NestJS `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and transformation enabled. Invalid MongoDB ids are rejected with `400 Bad Request`, missing jobs return `404 Not Found`, and unexpected errors are normalized through a global exception filter.

## Verification Commands

```bash
npm run lint
npm run build
npm run test:e2e
npm run check
```

The e2e test uses `mongodb-memory-server`, so CRUD verification can run without a separately installed MongoDB instance.
