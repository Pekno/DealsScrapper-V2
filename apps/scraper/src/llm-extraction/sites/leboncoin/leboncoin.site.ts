import { Injectable } from '@nestjs/common';
import { SiteSource } from '@dealscrapper/shared-types';
import type { SiteId, UniversalListing } from '@dealscrapper/shared-types';
import type { LlmSiteModule, LlmExample } from '../site.interface.js';
import { LEBONCOIN_JSON_SCHEMA, validateLeBonCoinListing } from './leboncoin.schema.js';
import { LEBONCOIN_SYSTEM_PROMPT, buildLeBonCoinUserPrompt } from './leboncoin.prompt.js';

/**
 * LeBonCoin LLM site module. See `DealabsSite` for the rationale behind
 * `getExamples()` returning an empty array.
 */
@Injectable()
export class LeBonCoinSite implements LlmSiteModule {
  readonly siteId: SiteId = SiteSource.LEBONCOIN;
  readonly systemPrompt = LEBONCOIN_SYSTEM_PROMPT;
  readonly jsonSchema: object = LEBONCOIN_JSON_SCHEMA;

  buildUserPrompt(markdown: string): string {
    return buildLeBonCoinUserPrompt(markdown, this.getExamples());
  }

  validate(raw: unknown): UniversalListing {
    return validateLeBonCoinListing(raw);
  }

  getExamples(): LlmExample[] {
    return [];
  }
}
