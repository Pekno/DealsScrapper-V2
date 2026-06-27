import { Test, TestingModule } from '@nestjs/testing';
import { join } from 'path';
import { LlmExtractionModule } from '../../../llm-extraction.module.js';
import { LlmExtractionService } from '../../../llm-extraction.service.js';
import { SharedConfigModule } from '@dealscrapper/shared-config';
import { loadVintedFixtures } from '../fixtures/index.js';
import { validateVintedListing } from '../vinted.schema.js';
import type { LlmExample } from '../../site.interface.js';
import { SiteSource } from '@dealscrapper/shared-types';

const RUN_LIVE = process.env['LLM_TESTS'] === '1';

(RUN_LIVE ? describe : describe.skip)('Vinted live extraction (requires Ollama)', () => {
  let service: LlmExtractionService;
  let examples: LlmExample[] = [];

  beforeAll(async () => {
    examples = loadVintedFixtures(join(__dirname, '..', 'fixtures'));

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
    it(`should extract fixture vinted-00${i + 1} successfully`, async () => {
      const example = examples[i];
      if (!example) throw new Error(`Fixture ${i} not loaded`);

      const { listing: result } = await service.extract({
        siteId: SiteSource.VINTED,
        listingHtml: `<html><body>${example.markdown}</body></html>`,
        sourceUrl: 'https://www.vinted.fr/catalog/1904-women',
      });

      expect(() => validateVintedListing(result)).not.toThrow();

      const expected = example.expectedOutput;
      const expectedData = expected.siteSpecificData as { favoriteCount: number | null; brand: string | null; size: string | null; itemCondition: string };
      const resultData = result.siteSpecificData as { favoriteCount: number | null; brand: string | null; size: string | null; itemCondition: string };

      expect(result.externalId).toBe(expected.externalId);
      expect(result.title).toBe(expected.title);
      expect(result.url).toBe(expected.url);
      expect(result.currentPrice).toBe(expected.currentPrice);
      if (expectedData.favoriteCount !== null) expect(resultData.favoriteCount).toBe(expectedData.favoriteCount);
      if (expectedData.brand !== null) expect(resultData.brand).toBe(expectedData.brand);
      if (expectedData.size !== null) expect(resultData.size).toBe(expectedData.size);
      expect(resultData.itemCondition).toBe(expectedData.itemCondition);
    }, 60_000);
  }
});
