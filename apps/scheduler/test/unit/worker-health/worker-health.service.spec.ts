import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WorkerHealthService } from '../../../src/worker-health/worker-health.service';
import type {
  WorkerCapacity,
  WorkerMetrics,
} from '../../../src/types/scheduler.types';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WorkerHealthService Business Logic', () => {
  let service: WorkerHealthService;

  // Test data factories for business scenarios
  const createWorkerCapacity = (overrides = {}): WorkerCapacity => ({
    maxConcurrentJobs: 5,
    maxMemoryMB: 2048,
    supportedJobTypes: ['scrape-category'],
    ...overrides,
  });

  const createWorkerMetrics = (overrides = {}): WorkerMetrics => ({
    id: 'worker-001',
    endpoint: 'http://localhost:3002',
    capacity: createWorkerCapacity(),
    currentLoad: 0,
    lastHeartbeat: new Date(),
    status: 'active',
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkerHealthService],
    }).compile();

    service = module.get<WorkerHealthService>(WorkerHealthService);

    // Reset axios mock
    mockedAxios.get.mockClear();
  });

  describe('Worker Registration and Management', () => {
    it('registers worker with valid configuration', async () => {
      // Arrange
      const capacity = createWorkerCapacity({
        maxConcurrentJobs: 10,
        supportedJobTypes: ['scrape-category', 'discovery'],
      });

      // Act
      await service.registerWorker(
        'scraper-001',
        'http://localhost:3002',
        capacity
      );

      // Assert
      const workers = service.getAllRegisteredWorkers();
      expect(workers).toHaveLength(1);
      expect(workers[0]).toMatchObject({
        id: 'scraper-001',
        endpoint: 'http://localhost:3002',
        capacity,
        currentLoad: 0,
        status: 'active',
      });
    });

    it('normalizes worker endpoint URLs correctly', async () => {
      // Arrange - Various endpoint formats
      const capacity = createWorkerCapacity();

      // Act - Register with different endpoint formats
      await service.registerWorker('worker-1', 'localhost:3001', capacity);
      await service.registerWorker(
        'worker-2',
        'http://localhost:3002/',
        capacity
      ); // trailing slash
      await service.registerWorker(
        'worker-3',
        'https://worker.example.com',
        capacity
      );

      // Assert
      const workers = service.getAllRegisteredWorkers();
      expect(workers[0].endpoint).toBe('http://localhost:3001');
      expect(workers[1].endpoint).toBe('http://localhost:3002');
      expect(workers[2].endpoint).toBe('https://worker.example.com');
    });

    it('validates worker registration parameters', async () => {
      // Arrange - Invalid parameters
      const validCapacity = createWorkerCapacity();

      // Act & Assert - Invalid worker ID
      await expect(
        service.registerWorker('', 'http://localhost:3002', validCapacity)
      ).rejects.toThrow('Invalid worker ID');

      // Invalid endpoint
      await expect(
        service.registerWorker('worker-1', '', validCapacity)
      ).rejects.toThrow('Invalid endpoint');

      // Invalid capacity
      await expect(
        service.registerWorker('worker-1', 'http://localhost:3002', null as any)
      ).rejects.toThrow('Invalid capacity object');

      // Invalid maxConcurrentJobs
      await expect(
        service.registerWorker('worker-1', 'http://localhost:3002', {
          ...validCapacity,
          maxConcurrentJobs: 0,
        })
      ).rejects.toThrow('Invalid maxConcurrentJobs');

      // Invalid supportedJobTypes
      await expect(
        service.registerWorker('worker-1', 'http://localhost:3002', {
          ...validCapacity,
          supportedJobTypes: [],
        })
      ).rejects.toThrow('Invalid supportedJobTypes');
    });

    it('unregisters worker and cleans up resources', async () => {
      // Arrange - Registered worker
      await service.registerWorker(
        'temp-worker',
        'http://localhost:3003',
        createWorkerCapacity()
      );
      expect(service.getAllRegisteredWorkers()).toHaveLength(1);

      // Act
      await service.unregisterWorker('temp-worker');

      // Assert
      expect(service.getAllRegisteredWorkers()).toHaveLength(0);
      expect(service.isWorkerRegistered('temp-worker')).toBe(false);
    });
  });

  describe('Worker Heartbeat and Load Management', () => {
    beforeEach(async () => {
      // Register a test worker
      await service.registerWorker(
        'test-worker',
        'http://localhost:3002',
        createWorkerCapacity({ maxConcurrentJobs: 10 })
      );
    });

    it('updates worker load with valid heartbeat', () => {
      // Act
      service.updateWorkerLoad('test-worker', 3);

      // Assert
      const workers = service.getAllRegisteredWorkers();
      const worker = workers.find((w) => w.id === 'test-worker');
      expect(worker?.currentLoad).toBe(3);
      expect(worker?.lastHeartbeat).toBeInstanceOf(Date);
    });

    it('validates heartbeat parameters', () => {
      // Act & Assert - Invalid worker ID
      expect(() => service.updateWorkerLoad('', 1)).toThrow(
        'Invalid worker ID'
      );
      expect(() => service.updateWorkerLoad(null as any, 1)).toThrow(
        'Invalid worker ID'
      );

      // Invalid load values
      expect(() => service.updateWorkerLoad('test-worker', -1)).toThrow(
        'Invalid current load value'
      );
      expect(() => service.updateWorkerLoad('test-worker', NaN)).toThrow(
        'Invalid current load value'
      );
      expect(() => service.updateWorkerLoad('test-worker', Infinity)).toThrow(
        'Invalid current load value'
      );
    });

    it('rejects heartbeat from unregistered worker', () => {
      // Act & Assert
      expect(() => service.updateWorkerLoad('unknown-worker', 2)).toThrow(
        UnauthorizedException
      );
    });

    it('checks worker registration status correctly', async () => {
      // Assert
      expect(service.isWorkerRegistered('test-worker')).toBe(true);
      expect(service.isWorkerRegistered('non-existent-worker')).toBe(false);
    });
  });

  describe('Worker Health Verification', () => {
    beforeEach(async () => {
      // Register multiple test workers
      await service.registerWorker(
        'healthy-worker',
        'http://localhost:3001',
        createWorkerCapacity({ maxConcurrentJobs: 5 })
      );
      await service.registerWorker(
        'busy-worker',
        'http://localhost:3002',
        createWorkerCapacity({ maxConcurrentJobs: 2 })
      );
      await service.registerWorker(
        'unhealthy-worker',
        'http://localhost:3003',
        createWorkerCapacity()
      );
    });

    it('returns healthy workers with available capacity', async () => {
      // Arrange - Mock successful health checks
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: { currentLoad: 2 } }) // healthy-worker
        .mockResolvedValueOnce({ status: 200, data: { currentLoad: 2 } }) // busy-worker - at capacity
        .mockRejectedValueOnce(new Error('Connection refused')); // unhealthy-worker

      // Act
      const availableWorkers = await service.getAvailableWorkers();

      // Assert - Should return only healthy workers with available capacity
      expect(availableWorkers).toHaveLength(1);
      expect(availableWorkers[0].id).toBe('healthy-worker');
      expect(availableWorkers[0].currentLoad).toBe(2);
      expect(availableWorkers[0].status).toBe('active');
    });

    it('handles health check failures gracefully', async () => {
      // Arrange - All workers fail health checks
      mockedAxios.get.mockRejectedValue(new Error('Service unavailable'));

      // Act
      const availableWorkers = await service.getAvailableWorkers();

      // Assert - Should return empty array, not crash
      expect(availableWorkers).toHaveLength(0);
    });

    it('caches health check results to avoid overwhelming workers', async () => {
      // Arrange - Mock successful health check
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { currentLoad: 1 },
      });

      // Act - Call getAvailableWorkers twice quickly
      await service.getAvailableWorkers();
      await service.getAvailableWorkers();

      // Assert - Should make HTTP requests only on first call (3 workers), then use cache
      // First call checks all 3 workers, second call uses cached results
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });

    it('processes workers in batches to prevent overwhelming', async () => {
      // Arrange - Register many workers to test batching
      const workerPromises = [];
      for (let i = 0; i < 10; i++) {
        workerPromises.push(
          service.registerWorker(
            `batch-worker-${i}`,
            `http://localhost:300${i}`,
            createWorkerCapacity()
          )
        );
      }
      await Promise.all(workerPromises);

      // Mock health checks
      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: { currentLoad: 0 },
      });

      // Act
      await service.getAvailableWorkers();

      // Assert - Should make reasonable number of concurrent requests (batched)
      expect(mockedAxios.get).toHaveBeenCalled();
    });
  });

  describe('Stale Worker Cleanup', () => {
    beforeEach(async () => {
      // Register test workers
      await service.registerWorker(
        'active-worker',
        'http://localhost:3001',
        createWorkerCapacity()
      );
      await service.registerWorker(
        'stale-worker',
        'http://localhost:3002',
        createWorkerCapacity()
      );
    });

    it('removes workers with stale heartbeats', async () => {
      // Arrange - Simulate stale worker by manually setting old heartbeat
      const workers = service.getAllRegisteredWorkers();
      const staleWorker = workers.find((w) => w.id === 'stale-worker');
      if (staleWorker) {
        // Set heartbeat to 6 minutes ago (beyond 5-minute threshold)
        (staleWorker as any).lastHeartbeat = new Date(Date.now() - 6 * 60 * 1000);
      }

      // Act - Trigger cleanup
      await service.cleanupStaleRegistrations();

      // Assert - Stale worker should be removed
      const remainingWorkers = service.getAllRegisteredWorkers();
      expect(remainingWorkers).toHaveLength(1);
      expect(remainingWorkers[0].id).toBe('active-worker');
    });

    it('preserves active workers during cleanup', async () => {
      // Arrange - Both workers are active (recent heartbeats)
      service.updateWorkerLoad('active-worker', 1);
      service.updateWorkerLoad('stale-worker', 2);

      // Act
      await service.cleanupStaleRegistrations();

      // Assert - Both workers should remain
      expect(service.getAllRegisteredWorkers()).toHaveLength(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles malformed health check responses', async () => {
      // Arrange
      await service.registerWorker(
        'test-worker',
        'http://localhost:3001',
        createWorkerCapacity()
      );
      mockedAxios.get.mockResolvedValue({ status: 200, data: null }); // Malformed response

      // Act
      const availableWorkers = await service.getAvailableWorkers();

      // Assert - Should handle gracefully without crashing
      expect(availableWorkers).toBeDefined();
    });

    it('handles network timeouts during health checks', async () => {
      // Arrange
      await service.registerWorker(
        'timeout-worker',
        'http://localhost:3001',
        createWorkerCapacity()
      );
      mockedAxios.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout',
      });

      // Act
      const availableWorkers = await service.getAvailableWorkers();

      // Assert - Should return empty array for unreachable workers
      expect(availableWorkers).toHaveLength(0);
    });

    it('handles empty worker registry gracefully', async () => {
      // Act - No workers registered
      const availableWorkers = await service.getAvailableWorkers();

      // Assert
      expect(availableWorkers).toHaveLength(0);
      expect(service.getAllRegisteredWorkers()).toHaveLength(0);
    });
  });

  describe('Business Scenarios', () => {
    it('manages scraper farm with multiple workers during peak load', async () => {
      // Arrange - Simulate scraper farm with different worker types
      await service.registerWorker(
        'scraper-1',
        'http://scraper-1:3002',
        createWorkerCapacity({
          maxConcurrentJobs: 10,
          supportedJobTypes: ['scrape-category'],
        })
      );
      await service.registerWorker(
        'scraper-2',
        'http://scraper-2:3002',
        createWorkerCapacity({
          maxConcurrentJobs: 15,
          supportedJobTypes: ['scrape-category'],
        })
      );
      await service.registerWorker(
        'discovery-worker',
        'http://discovery:3003',
        createWorkerCapacity({
          maxConcurrentJobs: 5,
          supportedJobTypes: ['discovery'],
        })
      );

      // Simulate different load states
      service.updateWorkerLoad('scraper-1', 8); // High load but available
      service.updateWorkerLoad('scraper-2', 15); // At capacity
      service.updateWorkerLoad('discovery-worker', 2); // Available

      // Mock health checks
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: { currentLoad: 8 } }) // scraper-1
        .mockResolvedValueOnce({ status: 200, data: { currentLoad: 15 } }) // scraper-2
        .mockResolvedValueOnce({ status: 200, data: { currentLoad: 2 } }); // discovery-worker

      // Act
      const availableWorkers = await service.getAvailableWorkers();

      // Assert - Should return only workers with available capacity
      expect(availableWorkers).toHaveLength(2);
      expect(availableWorkers.map((w) => w.id)).toEqual(
        expect.arrayContaining(['scraper-1', 'discovery-worker'])
      );
    });

    it('handles worker auto-scaling scenario', async () => {
      // Arrange - Start with one worker
      await service.registerWorker(
        'initial-worker',
        'http://localhost:3001',
        createWorkerCapacity()
      );
      expect(service.getAllRegisteredWorkers()).toHaveLength(1);

      // Act - Simulate scaling up (new workers joining)
      await service.registerWorker(
        'scale-worker-1',
        'http://localhost:3002',
        createWorkerCapacity()
      );
      await service.registerWorker(
        'scale-worker-2',
        'http://localhost:3003',
        createWorkerCapacity()
      );
      expect(service.getAllRegisteredWorkers()).toHaveLength(3);

      // Act - Simulate scaling down (workers leaving)
      await service.unregisterWorker('scale-worker-1');
      await service.unregisterWorker('scale-worker-2');

      // Assert - Should handle scaling operations smoothly
      expect(service.getAllRegisteredWorkers()).toHaveLength(1);
      expect(service.getAllRegisteredWorkers()[0].id).toBe('initial-worker');
    });
  });
});
