import { Test, TestingModule } from '@nestjs/testing';
import { join } from 'path';
import { LlmExtractionModule } from '../../../llm-extraction.module.js';
import { LlmExtractionService } from '../../../llm-extraction.service.js';
import { SharedConfigModule } from '@dealscrapper/shared-config';
import { loadDealabsFixtures } from '../fixtures/index.js';
import { validateDealabsListing } from '../dealabs.schema.js';
import type { LlmExample } from '../../site.interface.js';
import type { UniversalListing } from '@dealscrapper/shared-types';
import { SiteSource } from '@dealscrapper/shared-types';

const RUN_LIVE = process.env['LLM_TESTS'] === '1';

(RUN_LIVE ? describe : describe.skip)('Dealabs live extraction (requires Ollama)', () => {
  let service: LlmExtractionService;
  let examples: LlmExample[] = [];

  beforeAll(async () => {
    // Lazy-load fixtures here so the spec parses under Jest's CJS runtime
    // (no `--experimental-vm-modules`). `__dirname` is provided by ts-jest.
    examples = loadDealabsFixtures(join(__dirname, '..', 'fixtures'));

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        SharedConfigModule.forRoot({
          serviceName: 'SCRAPER',
          envConfig: {
            OLLAMA_URL: 'REQUIRED',
            OLLAMA_MODEL: 'OPTIONAL',
            LLM_CONCURRENCY: 'OPTIONAL',
            LLM_TIMEOUT_MS: 'OPTIONAL',
          },
        }),
        LlmExtractionModule,
      ],
    }).compile();

    service = module.get<LlmExtractionService>(LlmExtractionService);
  });

  it('loads fixtures successfully', () => {
    expect(examples.length).toBe(3);
  });

  for (let i = 0; i < 3; i++) {
    it(`should extract fixture dealabs-00${i + 1} successfully`, async () => {
      const example = examples[i];
      if (!example) throw new Error(`Fixture ${i} not loaded`);

      const result: UniversalListing = await service.extract({
        siteId: SiteSource.DEALABS,
        listingHtml: `<html><body>${example.markdown}</body></html>`,
        sourceUrl: 'https://www.dealabs.com/groupe/high-tech',
      });

      expect(() => validateDealabsListing(result)).not.toThrow();
      expect(result.externalId).toBeTruthy();
      expect(result.title).toBeTruthy();
      expect(result.url).toBeTruthy();

      if (result.currentPrice !== null) {
        expect(result.currentPrice).toBeGreaterThanOrEqual(0);
        expect(result.currentPrice).toBeLessThan(100_000_00);
      }

      const data = result.siteSpecificData as { temperature?: number; commentCount?: number };
      if (typeof data.temperature === 'number') {
        expect(data.temperature).toBeGreaterThanOrEqual(0);
        expect(data.temperature).toBeLessThan(100_000);
      }
    }, 60_000);
  }
});
