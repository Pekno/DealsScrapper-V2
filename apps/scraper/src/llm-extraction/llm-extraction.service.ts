import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { SharedConfigService } from '@dealscrapper/shared-config';
import type { SiteId, UniversalListing } from '@dealscrapper/shared-types';
import { scraperLogConfig } from '../config/logging.config.js';
import { OllamaService } from './ollama/ollama.service.js';
import { HtmlToMarkdownService } from './html-to-markdown/html-to-markdown.service.js';
import { LlmSiteRegistry } from './sites/site.registry.js';
import { UnknownSiteError, LlmValidationError } from './sites/llm.errors.js';
import { OllamaUnavailableError, OllamaTimeoutError } from './ollama/ollama.errors.js';

export interface LlmExtractionRequest {
  siteId: SiteId;
  listingHtml: string;
  sourceUrl: string;
}

type PendingTask = {
  run: () => Promise<UniversalListing>;
  resolve: (value: UniversalListing) => void;
  reject: (reason: unknown) => void;
};

@Injectable()
export class LlmExtractionService {
  private readonly logger = createServiceLogger(scraperLogConfig);
  private readonly concurrency: number;
  private running = 0;
  private readonly queue: PendingTask[] = [];

  constructor(
    private readonly ollama: OllamaService,
    private readonly htmlToMarkdown: HtmlToMarkdownService,
    private readonly registry: LlmSiteRegistry,
    private readonly sharedConfig: SharedConfigService
  ) {
    this.concurrency = this.sharedConfig.getOllamaConfig().concurrency;
  }

  async extract(req: LlmExtractionRequest): Promise<UniversalListing> {
    return new Promise<UniversalListing>((resolve, reject) => {
      this.queue.push({ run: () => this.doExtract(req), resolve, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.running++;
      task
        .run()
        .then(task.resolve, task.reject)
        .finally(() => {
          this.running--;
          this.drain();
        });
    }
  }

  private async doExtract(req: LlmExtractionRequest): Promise<UniversalListing> {
    let site;
    try {
      site = this.registry.get(req.siteId);
    } catch (err) {
      if (err instanceof UnknownSiteError) {
        this.logger.warn(`LLM extraction skipped — no site module registered for siteId=${req.siteId}`);
      }
      throw err;
    }

    const markdown = this.htmlToMarkdown.prepare(req.listingHtml, req.sourceUrl);

    this.logger.log(
      `Starting LLM extraction siteId=${req.siteId} markdownLength=${markdown.length} chars`,
    );

    const started = Date.now();
    let raw: string;
    try {
      raw = await this.ollama.generate({
        system: site.systemPrompt,
        prompt: site.buildUserPrompt(markdown),
        format: site.jsonSchema,
      });
    } catch (err) {
      if (err instanceof OllamaTimeoutError) {
        this.logger.error(
          `Ollama timeout siteId=${req.siteId} elapsedMs=${err.elapsedMs} — ${err.message}`,
        );
      } else if (err instanceof OllamaUnavailableError) {
        this.logger.error(
          `Ollama unavailable siteId=${req.siteId} — ${err.message}`,
        );
      }
      throw err;
    }

    const ollamaMs = Date.now() - started;
    this.logger.log(`Ollama responded siteId=${req.siteId} latencyMs=${ollamaMs} rawLength=${raw.length} chars`);

    const parsed: unknown = JSON.parse(raw);
    let listing: UniversalListing;
    try {
      listing = site.validate(parsed);
    } catch (err) {
      if (err instanceof LlmValidationError) {
        this.logger.warn(`LLM validation failed siteId=${req.siteId} — ${err.message}`);
      }
      throw err;
    }

    this.logger.debug(
      `LLM extraction succeeded siteId=${req.siteId} externalId=${listing.externalId} latencyMs=${Date.now() - started}`,
    );

    return listing;
  }
}
