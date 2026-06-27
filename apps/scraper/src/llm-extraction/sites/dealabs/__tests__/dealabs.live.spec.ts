import { Test, TestingModule } from '@nestjs/testing';
import { join } from 'path';
import { LlmExtractionModule } from '../../../llm-extraction.module.js';
import { LlmExtractionService } from '../../../llm-extraction.service.js';
import { SharedConfigModule } from '@dealscrapper/shared-config';
import { loadDealabsFixtures } from '../fixtures/index.js';
import { validateDealabsListing } from '../dealabs.schema.js';
import type { LlmExample } from '../../site.interface.js';
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

      const { listing: result } = await service.extract({
        siteId: SiteSource.DEALABS,
        listingHtml: `<html><body>${example.markdown}</body></html>`,
        sourceUrl: 'https://www.dealabs.com/groupe/high-tech',
      });

      expect(() => validateDealabsListing(result)).not.toThrow();

      const expected = example.expectedOutput;
      const expectedData = expected.siteSpecificData as { temperature: number | null; commentCount: number | null };
      const resultData = result.siteSpecificData as { temperature: number | null; commentCount: number | null };

      expect(result.externalId).toBe(expected.externalId);
      expect(result.title).toBe(expected.title);
      expect(result.url).toBe(expected.url);
      expect(result.currentPrice).toBe(expected.currentPrice);
      expect(result.originalPrice).toBe(expected.originalPrice);
      expect(result.merchant).toBe(expected.merchant);
      if (expectedData.temperature !== null) expect(resultData.temperature).toBe(expectedData.temperature);
      if (expectedData.commentCount !== null) expect(resultData.commentCount).toBe(expectedData.commentCount);
    }, 60_000);
  }
});
