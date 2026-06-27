import { ScraperHealthService } from '../../../src/health/scraper-health.service';
import { OllamaUnavailableError } from '../../../src/llm-extraction/ollama/ollama.errors';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { PrismaService } from '@dealscrapper/database';
import { PuppeteerPoolService } from '../../../src/puppeteer-pool/puppeteer-pool.service';
import { OllamaService } from '../../../src/llm-extraction/ollama/ollama.service';
import { LlmExtractionService } from '../../../src/llm-extraction/llm-extraction.service.js';

// Minimal pool stats that satisfy PoolStats
const basePoolStats = {
  totalInstances: 2,
  availableInstances: 2,
  busyInstances: 0,
  queueLength: 0,
  totalRequests: 10,
  avgWaitTime: 5,
  queuedRequests: 0,
  successfulRequests: 9,
  failedRequests: 1,
  healthStatus: 'healthy' as const,
  memoryUsageMB: 200,
  memoryThresholdMB: 2048,
};

function makeService(overrides: {
  listModels?: jest.Mock;
  ollamaModel?: string;
}): ScraperHealthService {
  const puppeteerPool = {
    getStats: jest.fn().mockReturnValue(basePoolStats),
  } as unknown as PuppeteerPoolService;

  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  } as unknown as PrismaService;

  const configuredModel = overrides.ollamaModel ?? 'qwen2.5:3b-instruct';
  const sharedConfig = {
    get: jest.fn((key: string) => {
      if (key === 'APP_VERSION') return '0.0.1';
      if (key === 'NODE_ENV') return 'test';
      return undefined;
    }),
    getOllamaConfig: jest.fn().mockReturnValue({
      url: 'http://localhost:11434',
      model: configuredModel,
      concurrency: 2,
      timeoutMs: 30000,
    }),
  } as unknown as SharedConfigService;

  const ollamaService = {
    listModels: overrides.listModels ?? jest.fn().mockResolvedValue([]),
  } as unknown as OllamaService;

  const mockLlmExtraction = {
    getStats: jest.fn().mockReturnValue({
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      avgExtractionTimeMs: 0,
      lastExtractionTimeMs: 0,
    }),
  } as unknown as LlmExtractionService;

  return new ScraperHealthService(puppeteerPool, prisma, sharedConfig, ollamaService, mockLlmExtraction);
}

describe('ScraperHealthService — Ollama health check', () => {
  describe('checkOllama (via getHealth)', () => {
    it('reports healthy when Ollama is reachable and the configured model is present', async () => {
      // Arrange
      const listModels = jest.fn().mockResolvedValue(['qwen2.5:3b-instruct', 'llama3:8b']);
      const service = makeService({ listModels, ollamaModel: 'qwen2.5:3b-instruct' });

      // Act
      const health = await service.getHealth();

      // Assert
      expect(health).toHaveProperty('ollama', 'healthy');
    });

    it('reports degraded when Ollama is reachable but the configured model is missing', async () => {
      // Arrange
      const listModels = jest.fn().mockResolvedValue(['llama3:8b', 'mistral:7b']);
      const service = makeService({ listModels, ollamaModel: 'qwen2.5:3b-instruct' });

      // Act
      const health = await service.getHealth();

      // Assert
      expect(health).toHaveProperty('ollama', 'degraded');
    });

    it('reports unhealthy when Ollama is unreachable (OllamaUnavailableError)', async () => {
      // Arrange
      const listModels = jest.fn().mockRejectedValue(new OllamaUnavailableError(new Error('ECONNREFUSED')));
      const service = makeService({ listModels, ollamaModel: 'qwen2.5:3b-instruct' });

      // Act
      const health = await service.getHealth();

      // Assert
      expect(health).toHaveProperty('ollama', 'unhealthy');
    });
  });

  describe('checkOllama (via getReadiness dependencies)', () => {
    it('includes ollama key in readiness dependencies', async () => {
      // Arrange
      const listModels = jest.fn().mockResolvedValue(['qwen2.5:3b-instruct']);
      const service = makeService({ listModels, ollamaModel: 'qwen2.5:3b-instruct' });

      // Act
      const readiness = await service.getReadiness();

      // Assert
      expect(readiness.dependencies).toHaveProperty('ollama', 'healthy');
    });
  });

  describe('model matching', () => {
    it('matches a model when its name starts with the configured model prefix', async () => {
      // Arrange — Ollama often returns versioned names like 'qwen2.5:3b-instruct-q4_0'
      const listModels = jest.fn().mockResolvedValue(['qwen2.5:3b-instruct-q4_0']);
      const service = makeService({ listModels, ollamaModel: 'qwen2.5:3b-instruct' });

      // Act
      const health = await service.getHealth();

      // Assert — prefix match should count as healthy
      expect(health).toHaveProperty('ollama', 'healthy');
    });
  });
});
