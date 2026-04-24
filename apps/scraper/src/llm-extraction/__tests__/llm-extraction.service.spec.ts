import { Test, TestingModule } from '@nestjs/testing';
import { LlmExtractionService } from '../llm-extraction.service.js';
import { OllamaService } from '../ollama/ollama.service.js';
import { HtmlToMarkdownService } from '../html-to-markdown/html-to-markdown.service.js';
import { LlmSiteRegistry } from '../sites/site.registry.js';
import { OllamaUnavailableError, OllamaTimeoutError } from '../ollama/ollama.errors.js';
import { UnknownSiteError, LlmValidationError } from '../sites/llm.errors.js';
import { SharedConfigService } from '@dealscrapper/shared-config';
import type { UniversalListing } from '@dealscrapper/shared-types';
import { SiteSource } from '@dealscrapper/shared-types';

const mockOllamaGenerate = jest.fn();
const mockPrepare = jest.fn();
const mockRegistryGet = jest.fn();

const mockListing: UniversalListing = {
  externalId: 'deal-123',
  title: 'Test Deal',
  description: null,
  url: 'https://www.dealabs.com/deal/123',
  imageUrl: null,
  siteId: SiteSource.DEALABS,
  currentPrice: 99,
  originalPrice: null,
  merchant: null,
  location: null,
  publishedAt: new Date('2024-01-01'),
  isActive: true,
  categorySlug: 'high-tech',
  siteSpecificData: {
    type: SiteSource.DEALABS,
    temperature: 100,
    commentCount: 5,
    communityVerified: false,
    freeShipping: false,
    isCoupon: false,
    discountPercentage: null,
    expiresAt: null,
  },
};

const mockSiteModule = {
  siteId: SiteSource.DEALABS,
  systemPrompt: 'Extract deal data',
  jsonSchema: { type: 'object' },
  buildUserPrompt: (md: string) => `Extract from: ${md}`,
  validate: jest.fn(),
  getExamples: () => [],
};

describe('LlmExtractionService', () => {
  let service: LlmExtractionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSiteModule.validate.mockReturnValue(mockListing);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmExtractionService,
        {
          provide: OllamaService,
          useValue: { generate: mockOllamaGenerate },
        },
        {
          provide: HtmlToMarkdownService,
          useValue: { prepare: mockPrepare },
        },
        {
          provide: LlmSiteRegistry,
          useValue: { get: mockRegistryGet },
        },
        {
          provide: SharedConfigService,
          useValue: {
            getOllamaConfig: () => ({ concurrency: 2, url: '', model: '', timeoutMs: 30000 }),
          },
        },
      ],
    }).compile();

    service = module.get(LlmExtractionService);
  });

  const req = {
    siteId: SiteSource.DEALABS,
    listingHtml: '<div>Deal</div>',
    sourceUrl: 'https://www.dealabs.com/deal/123',
  };

  it('extracts a listing on the happy path', async () => {
    // Arrange
    mockPrepare.mockReturnValue('## Deal markdown');
    mockRegistryGet.mockReturnValue(mockSiteModule);
    mockOllamaGenerate.mockResolvedValueOnce(JSON.stringify({ title: 'Test' }));

    // Act
    const result = await service.extract(req);

    // Assert
    expect(result).toBe(mockListing);
    expect(mockPrepare).toHaveBeenCalledWith(req.listingHtml, req.sourceUrl);
    expect(mockOllamaGenerate).toHaveBeenCalledTimes(1);
    expect(mockSiteModule.validate).toHaveBeenCalledTimes(1);
  });

  it('throws UnknownSiteError when site is not registered', async () => {
    // Arrange
    mockRegistryGet.mockImplementation(() => {
      throw new UnknownSiteError('unknown-site');
    });

    // Act & Assert
    await expect(service.extract(req)).rejects.toThrow(UnknownSiteError);
  });

  it('throws LlmValidationError when site validate rejects the output', async () => {
    // Arrange
    mockPrepare.mockReturnValue('## markdown');
    mockRegistryGet.mockReturnValue(mockSiteModule);
    mockOllamaGenerate.mockResolvedValueOnce(JSON.stringify({ bad: 'data' }));
    mockSiteModule.validate.mockImplementation(() => {
      throw new LlmValidationError('missing externalId');
    });

    // Act & Assert
    await expect(service.extract(req)).rejects.toThrow(LlmValidationError);
  });

  it('propagates OllamaUnavailableError', async () => {
    // Arrange
    mockPrepare.mockReturnValue('## markdown');
    mockRegistryGet.mockReturnValue(mockSiteModule);
    mockOllamaGenerate.mockRejectedValueOnce(new OllamaUnavailableError());

    // Act & Assert
    await expect(service.extract(req)).rejects.toThrow(OllamaUnavailableError);
  });

  it('propagates OllamaTimeoutError', async () => {
    // Arrange
    mockPrepare.mockReturnValue('## markdown');
    mockRegistryGet.mockReturnValue(mockSiteModule);
    mockOllamaGenerate.mockRejectedValueOnce(new OllamaTimeoutError());

    // Act & Assert
    await expect(service.extract(req)).rejects.toThrow(OllamaTimeoutError);
  });

  describe('concurrency semaphore', () => {
    it('runs at most LLM_CONCURRENCY extract() calls in parallel', async () => {
      // Arrange — rebuild service with concurrency = 2 and a stub that tracks peak in-flight
      let inFlight = 0;
      let peakInFlight = 0;
      const releasers: Array<() => void> = [];
      const trackedGenerate = jest.fn().mockImplementation(() => {
        inFlight++;
        peakInFlight = Math.max(peakInFlight, inFlight);
        return new Promise<string>((resolve) => {
          releasers.push(() => {
            inFlight--;
            resolve(JSON.stringify({ ok: true }));
          });
        });
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          LlmExtractionService,
          { provide: OllamaService, useValue: { generate: trackedGenerate } },
          { provide: HtmlToMarkdownService, useValue: { prepare: () => '## markdown' } },
          { provide: LlmSiteRegistry, useValue: { get: () => mockSiteModule } },
          {
            provide: SharedConfigService,
            useValue: {
              getOllamaConfig: () => ({ concurrency: 2, url: '', model: '', timeoutMs: 30000 }),
            },
          },
        ],
      }).compile();

      const boundedService = module.get(LlmExtractionService);
      mockSiteModule.validate.mockReturnValue(mockListing);

      // Act — fire 4 concurrent extract() calls
      const promises = [0, 1, 2, 3].map(() => boundedService.extract(req));

      // Yield so the semaphore has a chance to start the first batch
      await new Promise((r) => setImmediate(r));

      // Assert peak during first batch — only 2 should be running
      expect(peakInFlight).toBe(2);
      expect(trackedGenerate).toHaveBeenCalledTimes(2);

      // Release the first two, let the next two start
      releasers[0]!();
      releasers[1]!();
      await new Promise((r) => setImmediate(r));
      await new Promise((r) => setImmediate(r));

      expect(trackedGenerate).toHaveBeenCalledTimes(4);
      expect(peakInFlight).toBe(2); // never exceeded the cap

      // Release remaining two, all four should resolve
      releasers[2]!();
      releasers[3]!();

      const results = await Promise.all(promises);
      expect(results).toHaveLength(4);
      expect(peakInFlight).toBe(2);
    });
  });
});
