import type { SiteId, UniversalListing } from '@dealscrapper/shared-types';

export interface LlmExample {
  markdown: string;
  expectedOutput: UniversalListing;
}

export interface LlmSiteModule {
  readonly siteId: SiteId;
  readonly systemPrompt: string;
  readonly jsonSchema: object;
  buildUserPrompt(markdown: string): string;
  validate(raw: unknown): UniversalListing;
  getExamples(): LlmExample[];
}
