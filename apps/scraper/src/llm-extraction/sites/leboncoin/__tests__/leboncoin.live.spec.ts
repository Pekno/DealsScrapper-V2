import { Test, TestingModule } from '@nestjs/testing';
import { join } from 'path';
import { LlmExtractionModule } from '../../../llm-extraction.module.js';
import { LlmExtractionService } from '../../../llm-extraction.service.js';
import { SharedConfigModule } from '@dealscrapper/shared-config';
import { loadLeBonCoinFixtures } from '../fixtures/index.js';
import { validateLeBonCoinListing } from '../leboncoin.schema.js';
import type { LlmExample } from '../../site.interface.js';
import type { UniversalListing } from '@dealscrapper/shared-types';
import { SiteSource } from '@dealscrapper/shared-types';

const RUN_LIVE = process.env['LLM_TESTS'] === '1';

(RUN_LIVE ? describe : describe.skip)('LeBonCoin live extraction (requires Ollama)', () => {
  let service: LlmExtractionService;
  let examples: LlmExample[] = [];

  beforeAll(async () => {
    examples = loadLeBonCoinFixtures(join(__dirname, '..', 'fixtures'));

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
    it(`should extract fixture leboncoin-00${i + 1} successfully`, async () => {
      const example = examples[i];
      if (!example) throw new Error(`Fixture ${i} not loaded`);

      const result: UniversalListing = await service.extract({
        siteId: SiteSource.LEBONCOIN,
        listingHtml: `<html><body>${example.markdown}</body></html>`,
        sourceUrl: 'https://www.leboncoin.fr/recherche?category=15',
      });

      expect(() => validateLeBonCoinListing(result)).not.toThrow();
      expect(result.externalId).toBeTruthy();
      expect(result.title).toBeTruthy();
      expect(result.url).toBeTruthy();

      if (result.currentPrice !== null) {
        expect(result.currentPrice).toBeGreaterThanOrEqual(0);
        expect(result.currentPrice).toBeLessThan(100_000_000);
      }
    }, 60_000);
  }
});
