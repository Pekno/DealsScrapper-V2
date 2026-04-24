import { Injectable } from '@nestjs/common';
import { SiteSource } from '@dealscrapper/shared-types';
import type { SiteId, UniversalListing } from '@dealscrapper/shared-types';
import type { LlmSiteModule, LlmExample } from '../site.interface.js';
import { VINTED_JSON_SCHEMA, validateVintedListing } from './vinted.schema.js';
import { VINTED_SYSTEM_PROMPT, buildVintedUserPrompt } from './vinted.prompt.js';

/**
 * Vinted LLM site module. See `DealabsSite` for the rationale behind
 * `getExamples()` returning an empty array.
 */
@Injectable()
export class VintedSite implements LlmSiteModule {
  readonly siteId: SiteId = SiteSource.VINTED;
  readonly systemPrompt = VINTED_SYSTEM_PROMPT;
  readonly jsonSchema: object = VINTED_JSON_SCHEMA;

  buildUserPrompt(markdown: string): string {
    return buildVintedUserPrompt(markdown, this.getExamples());
  }

  validate(raw: unknown): UniversalListing {
    return validateVintedListing(raw);
  }

  getExamples(): LlmExample[] {
    return [];
  }
}
