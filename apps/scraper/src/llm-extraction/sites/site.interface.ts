import type { SiteId, UniversalListing } from '@dealscrapper/shared-types';

export interface LlmExample {
  /**
   * Raw listing HTML the example was derived from. This is the input contract
   * the production pipeline uses (`base-site-adapter` passes raw element HTML to
   * `LlmExtractionService.extract`, which runs `HtmlToMarkdownService.prepare`
   * exactly once). Live specs must feed this — never `markdown` — so they
   * exercise the same single-conversion path as production.
   */
  html: string;
  /**
   * The example's listing HTML already converted to Markdown. Intended for
   * few-shot prompt construction. Must NOT be fed back through `prepare`, which
   * would double-convert (escaping Markdown syntax and collapsing structure).
   */
  markdown: string;
  expectedOutput: UniversalListing;
}

export interface LlmSiteModule {
  readonly siteId: SiteId;
  readonly systemPrompt: string;
  readonly jsonSchema: object;
  buildUserPrompt(markdown: string): string;
  /**
   * Validates and normalises the raw LLM JSON into a {@link UniversalListing}.
   *
   * `markdown` is the same prepared Markdown that was fed to the model. It is
   * optional so callers that only want to re-validate an already-extracted
   * listing (e.g. tests) can omit it. When provided, a site module may use it to
   * deterministically backfill fields the small reader model is unreliable at
   * extracting but that are trivially present as fixed tokens in the Markdown
   * (e.g. the Dealabs `123°` temperature). This is a precision recovery, never a
   * fabrication: values are only sourced from the Markdown actually shown.
   */
  validate(raw: unknown, markdown?: string): UniversalListing;
  getExamples(): LlmExample[];
}
