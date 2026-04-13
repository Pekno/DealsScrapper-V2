/**
 * Scheduler Worker Management E2E Tests
 *
 * Business Focus: Worker registration, heartbeat, and lifecycle management
 * Tests the worker coordination functionality that enables distributed scraping
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '@dealscrapper/database';
import { SchedulerModule } from '../../src/scheduler.module.js';
import { cleanupSchedulerTestData } from '../helpers/e2e-helpers.js';

describe('Worker Management and Coordination', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [SchedulerModule],
    }).compile();

    app = moduleRef.createNestApplication();
    prisma = moduleRef.get<PrismaService>(PrismaService);

    // Configure validation pipe to match main application
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      })
    );

    await app.init();
  });

  afterAll(async () => {
    await cleanupSchedulerTestData(prisma);
    await app.close();
  });

  beforeEach(async () => {
    await cleanupSchedulerTestData(prisma);
  });

  describe('Worker Registration and Lifecycle', () => {
    it('successfully registers a new scraper worker', async () => {
      // BUSINESS CONTEXT: New scraper workers need to join the distributed system

      // ACT: Register a worker with proper structure
      const registrationResponse = await request(app.getHttpServer())
        .post('/workers/register')
        .send({
          workerId: 'scraper-worker-001',
          endpoint: 'http://localhost:3002',
          capacity: {
            maxConcurrentJobs: 5,
            maxMemoryMB: 512,
            supportedJobTypes: ['SCRAPING', 'DATA_PROCESSING'],
          },
        })
        .expect(201);

      // BUSINESS EXPECTATION: Worker should be registered successfully
      expect(registrationResponse.body).toEqual(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('processes worker heartbeats to track availability', async () => {
      // BUSINESS CONTEXT: Workers need to report their health and availability

      // First register a worker
      await request(app.getHttpServer())
        .post('/workers/register')
        .send({
          workerId: 'scraper-worker-002',
          endpoint: 'http://localhost:3002',
          capacity: {
            maxConcurrentJobs: 10,
            maxMemoryMB: 1024,
            supportedJobTypes: ['SCRAPING'],
          },
        })
        .expect(201);

      // ACT: Send heartbeat
      const heartbeatResponse = await request(app.getHttpServer())
        .post('/workers/heartbeat')
        .send({
          workerId: 'scraper-worker-002',
          currentLoad: 3,
          status: 'active',
          timestamp: new Date().toISOString(),
        })
        .expect(200);

      // BUSINESS EXPECTATION: Heartbeat should be processed
      expect(heartbeatResponse.body).toEqual(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('allows workers to unregister from the system', async () => {
      // BUSINESS CONTEXT: Workers need to cleanly leave the distributed system

      // First register a worker
      await request(app.getHttpServer())
        .post('/workers/register')
        .send({
          workerId: 'scraper-worker-003',
          endpoint: 'http://localhost:3002',
          capacity: {
            maxConcurrentJobs: 8,
            maxMemoryMB: 768,
            supportedJobTypes: ['SCRAPING', 'CATEGORY_DISCOVERY'],
          },
        })
        .expect(201);

      // ACT: Unregister the worker
      const unregistrationResponse = await request(app.getHttpServer())
        .post('/workers/unregister')
        .send({
          workerId: 'scraper-worker-003',
        })
        .expect(200);

      // BUSINESS EXPECTATION: Worker should be unregistered successfully
      expect(unregistrationResponse.body).toEqual(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  describe('Worker Registration Validation', () => {
    it('rejects worker registration with invalid data', async () => {
      // BUSINESS CONTEXT: Invalid worker configurations should be rejected

      // ACT: Try to register with missing required fields
      const invalidRegistrationResponse = await request(app.getHttpServer())
        .post('/workers/register')
        .send({
          workerId: 'invalid-worker',
          // Missing endpoint and capacity
        })
        .expect(400); // Bad request due to missing required fields

      // BUSINESS EXPECTATION: Invalid registration should be rejected
      expect(invalidRegistrationResponse.body).toBeDefined();
    });

    it('rejects heartbeat from unregistered workers', async () => {
      // BUSINESS CONTEXT: Only registered workers should be able to send heartbeats

      // ACT: Send heartbeat without registering first
      const heartbeatResponse = await request(app.getHttpServer())
        .post('/workers/heartbeat')
        .send({
          workerId: 'unregistered-worker',
          currentLoad: 0,
          status: 'active',
          timestamp: new Date().toISOString(),
        })
        .expect(401); // Unauthorized worker

      // BUSINESS EXPECTATION: Unregistered worker heartbeat should be rejected
      expect(heartbeatResponse.body).toBeDefined();
    });
  });

  describe('Worker Capacity and Load Management', () => {
    it('supports different worker capacity configurations', async () => {
      // BUSINESS CONTEXT: Different workers may have different capacities

      const workers = [
        {
          workerId: 'high-capacity-worker',
          endpoint: 'http://localhost:3002',
          capacity: {
            maxConcurrentJobs: 20,
            maxMemoryMB: 2048,
            supportedJobTypes: [
              'SCRAPING',
              'DATA_PROCESSING',
              'CATEGORY_DISCOVERY',
            ],
          },
        },
        {
          workerId: 'low-capacity-worker',
          endpoint: 'http://localhost:3003',
          capacity: {
            maxConcurrentJobs: 2,
            maxMemoryMB: 256,
            supportedJobTypes: ['SCRAPING'],
          },
        },
      ];

      // ACT: Register workers with different capacities
      for (const worker of workers) {
        const response = await request(app.getHttpServer())
          .post('/workers/register')
          .send(worker)
          .expect(201);

        // BUSINESS EXPECTATION: Each worker should be registered successfully
        expect(response.body.success).toBe(true);
      }
    });

    it('tracks worker load through heartbeat updates', async () => {
      // BUSINESS CONTEXT: System needs to know how busy workers are

      // Register a worker
      await request(app.getHttpServer())
        .post('/workers/register')
        .send({
          workerId: 'load-tracking-worker',
          endpoint: 'http://localhost:3002',
          capacity: {
            maxConcurrentJobs: 10,
            maxMemoryMB: 1024,
            supportedJobTypes: ['SCRAPING'],
          },
        })
        .expect(201);

      // ACT: Send heartbeats with different load levels
      const loadLevels = [0, 3, 7, 10];

      for (const load of loadLevels) {
        const heartbeatResponse = await request(app.getHttpServer())
          .post('/workers/heartbeat')
          .send({
            workerId: 'load-tracking-worker',
            currentLoad: load,
            status: load < 10 ? 'active' : 'busy',
            timestamp: new Date().toISOString(),
          })
          .expect(200);

        // BUSINESS EXPECTATION: Load updates should be accepted
        expect(heartbeatResponse.body.success).toBe(true);
      }
    });
  });

  describe('System Integration', () => {
    it('supports concurrent worker operations without conflicts', async () => {
      // BUSINESS CONTEXT: Multiple workers should be able to operate simultaneously

      const concurrentOperations = [
        request(app.getHttpServer())
          .post('/workers/register')
          .send({
            workerId: 'concurrent-worker-1',
            endpoint: 'http://localhost:3002',
            capacity: {
              maxConcurrentJobs: 5,
              maxMemoryMB: 512,
              supportedJobTypes: ['SCRAPING'],
            },
          }),
        request(app.getHttpServer())
          .post('/workers/register')
          .send({
            workerId: 'concurrent-worker-2',
            endpoint: 'http://localhost:3003',
            capacity: {
              maxConcurrentJobs: 8,
              maxMemoryMB: 768,
              supportedJobTypes: ['SCRAPING', 'DATA_PROCESSING'],
            },
          }),
      ];

      // ACT: Perform concurrent registrations
      const results = await Promise.all(concurrentOperations);

      // BUSINESS EXPECTATION: Both workers should register successfully
      results.forEach((result) => {
        expect(result.status).toBe(201);
        expect(result.body.success).toBe(true);
      });
    });

    it('maintains system stability during worker lifecycle operations', async () => {
      // BUSINESS CONTEXT: Worker operations shouldn't affect system health

      // Register, heartbeat, and unregister in sequence
      const workerId = 'stability-test-worker';

      // Register
      await request(app.getHttpServer())
        .post('/workers/register')
        .send({
          workerId,
          endpoint: 'http://localhost:3002',
          capacity: {
            maxConcurrentJobs: 5,
            maxMemoryMB: 512,
            supportedJobTypes: ['SCRAPING'],
          },
        })
        .expect(201);

      // Heartbeat
      await request(app.getHttpServer())
        .post('/workers/heartbeat')
        .send({
          workerId,
          currentLoad: 2,
          status: 'active',
          timestamp: new Date().toISOString(),
        })
        .expect(200);

      // Check system health during worker operations
      const healthResponse = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Unregister
      await request(app.getHttpServer())
        .post('/workers/unregister')
        .send({ workerId })
        .expect(200);

      // BUSINESS EXPECTATION: System should remain healthy throughout
      expect(healthResponse.body.success).toBe(true);
      expect(healthResponse.body.data.status).toBe('healthy');
    });
  });
});
