import { Injectable } from '@nestjs/common';
import { SiteSource } from '@dealscrapper/shared-types';
import type { SiteId, UniversalListing } from '@dealscrapper/shared-types';
import type { LlmSiteModule, LlmExample } from '../site.interface.js';
import { DEALABS_JSON_SCHEMA, validateDealabsListing } from './dealabs.schema.js';
import { DEALABS_SYSTEM_PROMPT, buildDealabsUserPrompt } from './dealabs.prompt.js';

/**
 * Dealabs LLM site module.
 *
 * `getExamples()` currently returns an empty array — few-shot fixture loading
 * lives in test-only territory (`sites/dealabs/__tests__/dealabs.live.spec.ts`)
 * because the fixture files are not copied into `dist/` by `nest build`. If
 * production few-shot examples are wanted later, embed them as TS modules or
 * add an asset-copy step to `nest-cli.json`.
 */
@Injectable()
export class DealabsSite implements LlmSiteModule {
  readonly siteId: SiteId = SiteSource.DEALABS;
  readonly systemPrompt = DEALABS_SYSTEM_PROMPT;
  readonly jsonSchema: object = DEALABS_JSON_SCHEMA;

  buildUserPrompt(markdown: string): string {
    return buildDealabsUserPrompt(markdown, this.getExamples());
  }

  validate(raw: unknown, markdown?: string): UniversalListing {
    return validateDealabsListing(raw, markdown);
  }

  getExamples(): LlmExample[] {
    return [];
  }
}
