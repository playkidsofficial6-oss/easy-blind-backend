process.env.NODE_ENV = 'test';

import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

interface JobResponse {
  _id: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  status: string;
}

interface PaginatedJobsResponse {
  items: JobResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

describe('Easy Blind Backend CRUD APIs (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let httpServer: Server;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.TEST_MONGODB_URI = mongoServer.getUri('easy-blinds-test');
    process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
    process.env.API_PREFIX = 'api';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const configService = app.get(ConfigService);
    app.setGlobalPrefix(configService.get<string>('API_PREFIX', 'api'));
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Server;
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('creates, reads, updates, and deletes a job', async () => {
    const createPayload = {
      customerName: 'Aarav Sharma',
      customerEmail: 'aarav@example.com',
      customerPhone: '+919876543210',
      address: '12 MG Road, Bengaluru, Karnataka',
      productType: 'Motorized Blinds',
      quantity: 4,
      priority: 'high',
      notes: 'Customer prefers afternoon appointment.',
      scheduledAt: '2026-05-20T10:30:00.000Z',
    };

    const createResponse = await request(httpServer)
      .post('/api/v1/jobs')
      .send(createPayload)
      .expect(201);

    const createdJob = createResponse.body as JobResponse;
    const jobId = createdJob._id;
    expect(jobId).toBeDefined();
    expect(createdJob.customerEmail).toBe(createPayload.customerEmail);

    const listResponse = await request(httpServer)
      .get('/api/v1/jobs?search=aarav&limit=5&page=1')
      .expect(200);
    const jobList = listResponse.body as PaginatedJobsResponse;
    expect(jobList.items).toHaveLength(1);
    expect(jobList.meta.total).toBe(1);

    const readResponse = await request(httpServer)
      .get(`/api/v1/jobs/${jobId}`)
      .expect(200);
    const readJob = readResponse.body as JobResponse;
    expect(readJob.customerName).toBe(createPayload.customerName);

    const updateResponse = await request(httpServer)
      .patch(`/api/v1/jobs/${jobId}`)
      .send({ status: 'completed', quantity: 5 })
      .expect(200);
    const updatedJob = updateResponse.body as JobResponse;
    expect(updatedJob.status).toBe('completed');
    expect(updatedJob.quantity).toBe(5);

    await request(httpServer).delete(`/api/v1/jobs/${jobId}`).expect(200);
    await request(httpServer).get(`/api/v1/jobs/${jobId}`).expect(404);
  });

  it('rejects invalid payloads with validation errors', async () => {
    await request(httpServer)
      .post('/api/v1/jobs')
      .send({ customerName: 'A' })
      .expect(400);
  });
});
