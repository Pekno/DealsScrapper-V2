import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test, TestingModule } from '@nestjs/testing';
import { SiteSource } from '@dealscrapper/shared-types';
import type { UniversalListing } from '@dealscrapper/shared-types';
import { LeBonCoinAdapter } from '../leboncoin.adapter';
import { LlmExtractionService } from '../../../llm-extraction/llm-extraction.service';

const FIXTURE_DIR = join(
  __dirname,
  '..',
  '..',
  '..',
  'llm-extraction',
  'sites',
  'leboncoin',
  'fixtures',
);

const llmFallbackListing: UniversalListing = {
  externalId: 'llm-fallback',
  title: 'LLM fallback listing',
  description: null,
  url: 'https://www.leboncoin.fr/ad/voitures/000',
  imageUrl: null,
  siteId: SiteSource.LEBONCOIN,
  currentPrice: null,
  originalPrice: null,
  merchant: null,
  location: null,
  publishedAt: null,
  isActive: true,
  categorySlug: '',
  siteSpecificData: {
    type: SiteSource.LEBONCOIN,
    city: null,
    postcode: null,
    department: null,
    region: null,
    proSeller: null,
    sellerName: null,
    urgentFlag: null,
    topAnnonce: null,
    deliveryOptions: [],
    shippingCost: null,
    condition: null,
    attributes: null,
  },
};

describe('LeBonCoinAdapter hybrid selector-first extraction', () => {
  let adapter: LeBonCoinAdapter;
  let llmExtractionService: jest.Mocked<LlmExtractionService>;

  beforeEach(async () => {
    llmExtractionService = {
      extract: jest.fn().mockResolvedValue({ listing: llmFallbackListing, ollamaMs: 100 }),
    } as unknown as jest.Mocked<LlmExtractionService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeBonCoinAdapter,
        { provide: LlmExtractionService, useValue: llmExtractionService },
      ],
    }).compile();

    adapter = module.get<LeBonCoinAdapter>(LeBonCoinAdapter);
  });

  it('should skip the LLM for a priced card whose selectors all hit', async () => {
    // Arrange — real priced fixture exposes externalId, url and currentPrice
    const html = readFileSync(join(FIXTURE_DIR, 'leboncoin-001.html'), 'utf-8');

    // Act
    const result = await adapter.extractListings(
      html,
      'https://www.leboncoin.fr/recherche?category=15',
    );

    // Assert
    expect(llmExtractionService.extract).not.toHaveBeenCalled();
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].externalId).toBe('3155664945');
    expect(result.listings[0].currentPrice).toBe(195);
    expect(result.llmTimeMs).toBe(0);
  });

  it('should fall back to the LLM for a card with no parseable price', async () => {
    // Arrange — ad link present but no Generic_price paragraph
    const html =
      '<div data-qa-id="aditem_container">' +
      '<a href="/ad/voitures/123456789">x</a>' +
      '</div>';

    // Act
    const result = await adapter.extractListings(
      html,
      'https://www.leboncoin.fr/recherche?category=15',
    );

    // Assert
    expect(llmExtractionService.extract).toHaveBeenCalledTimes(1);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0].externalId).toBe('llm-fallback');
  });
});
