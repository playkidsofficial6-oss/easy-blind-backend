process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-with-enough-length';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-with-enough-length';
process.env.JWT_EXPIRES_IN = '1h';

import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

interface UserResponse {
  _id: string;
  name: string;
  email: string;
  role: string;
  passwordHash?: string;
}

interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  user: UserResponse;
}

describe('Easy Blind Backend CRUD APIs (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let httpServer: Server;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    process.env.TEST_MONGO_URI = mongoServer.getUri('easy-blinds-test');
    process.env.MONGO_URI = process.env.TEST_MONGO_URI;
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

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Easy Blind Backend API')
      .setVersion('1.0.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/swagger', app, document);

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
    const registerResponse = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({
        name: 'Job Admin',
        email: 'jobadmin@example.com',
        password: 'SecurePass123!',
        role: 'Owner',
      })
      .expect(201);
    const token = (registerResponse.body as AuthResponse).accessToken;

    const createPayload = {
      firstName: 'Aarav',
      lastName: 'Sharma',
      customerEmail: 'aarav@example.com',
      customerPhone: '+919876543210',
      address: '12 MG Road, Bengaluru, Karnataka',
      productType: 'Motorized Blinds',
      quantity: 4,
      priority: 'High',
      notes: 'Customer prefers afternoon appointment.',
      scheduledAt: '2026-05-20T10:30:00.000Z',
    };

    const createResponse = await request(httpServer)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send(createPayload)
      .expect(201);

    const createdJob = createResponse.body as JobResponse;
    const jobId = createdJob._id;
    expect(jobId).toBeDefined();
    expect(createdJob.customerEmail).toBe(createPayload.customerEmail);

    const listResponse = await request(httpServer)
      .get('/api/v1/jobs?search=aarav&limit=5&page=1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const jobList = listResponse.body as PaginatedJobsResponse;
    expect(jobList.items).toHaveLength(1);
    expect(jobList.meta.total).toBe(1);

    const readResponse = await request(httpServer)
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const readJob = readResponse.body as JobResponse;
    expect(readJob.customerEmail).toBe(createPayload.customerEmail);

    const updateResponse = await request(httpServer)
      .patch(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'Completed', quantity: 5 })
      .expect(200);
    const updatedJob = updateResponse.body as JobResponse;
    expect(updatedJob.status).toBe('Completed');
    expect(updatedJob.quantity).toBe(5);

    await request(httpServer)
      .delete(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(httpServer)
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('rejects invalid payloads with validation errors', async () => {
    const loginResponse = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: 'jobadmin@example.com', password: 'SecurePass123!' })
      .expect(200);
    const token = (loginResponse.body as AuthResponse).accessToken;

    await request(httpServer)
      .post('/api/v1/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerName: 'A' })
      .expect(400);
  });

  it('registers a user, prevents duplicate registration, logs in, and reads protected profile', async () => {
    const registerPayload = {
      name: 'Meera Nair',
      email: 'meera@example.com',
      password: 'SecurePass123!',
      role: 'Owner',
    };

    const registerResponse = await request(httpServer)
      .post('/api/v1/auth/register')
      .send(registerPayload)
      .expect(201);
    const registered = registerResponse.body as AuthResponse;

    expect(registered.accessToken).toBeDefined();
    expect(registered.tokenType).toBe('Bearer');
    expect(registered.user.email).toBe(registerPayload.email);
    expect(registered.user.passwordHash).toBeUndefined();

    await request(httpServer)
      .post('/api/v1/auth/register')
      .send(registerPayload)
      .expect(409);

    const loginResponse = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({
        email: registerPayload.email,
        password: registerPayload.password,
      })
      .expect(200);
    const loggedIn = loginResponse.body as AuthResponse;

    expect(loggedIn.accessToken).toBeDefined();
    expect(loggedIn.user._id).toBe(registered.user._id);

    await request(httpServer).get('/api/v1/auth/profile').expect(401);

    const profileResponse = await request(httpServer)
      .get('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${loggedIn.accessToken}`)
      .expect(200);
    const profile = profileResponse.body as UserResponse;

    expect(profile.email).toBe(registerPayload.email);
    expect(profile.passwordHash).toBeUndefined();

    const updatedProfileResponse = await request(httpServer)
      .patch('/api/v1/auth/profile')
      .set('Authorization', `Bearer ${loggedIn.accessToken}`)
      .send({ name: 'Meera Nair Updated' })
      .expect(200);
    const updatedProfile = updatedProfileResponse.body as UserResponse;

    expect(updatedProfile.name).toBe('Meera Nair Updated');
  });

  it('protects user management routes with JWT authentication', async () => {
    await request(httpServer).get('/api/v1/users').expect(401);

    const loginResponse = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: 'meera@example.com', password: 'SecurePass123!' })
      .expect(200);
    const loggedIn = loginResponse.body as AuthResponse;

    const usersResponse = await request(httpServer)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${loggedIn.accessToken}`)
      .expect(200);
    const users = usersResponse.body as UserResponse[];

    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users.every((user) => user.passwordHash === undefined)).toBe(true);
  });

  it('serves Swagger documentation UI at /api/swagger and document JSON at /api/swagger-json', async () => {
    const res = await request(httpServer).get('/api/swagger/').expect(200);
    expect(res.text).toContain('swagger-ui');

    const jsonRes = await request(httpServer)
      .get('/api/swagger-json')
      .expect(200);
    expect(jsonRes.body.openapi).toBeDefined();
    expect(jsonRes.body.info.title).toBe('Easy Blind Backend API');
  });
});
