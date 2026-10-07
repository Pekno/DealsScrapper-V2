import { Injectable } from '@nestjs/common';
import { SiteSource } from '@dealscrapper/shared-types';
import type { UniversalListing, RetailSiteSource } from '@dealscrapper/shared-types';
import type { LlmSiteModule, LlmExample } from '../site.interface.js';
import { RETAIL_JSON_SCHEMA, validateRetailListing } from './retail.schema.js';
import { RETAIL_SYSTEM_PROMPT, buildRetailUserPrompt } from './retail.prompt.js';

/**
 * Shared LLM site module for the retail family. All four retail sites bind the
 * same schema/prompt/validator and differ only in `siteId`. To add another
 * retail site: add the enum value to RETAIL_SITE_SOURCES and a 3-line subclass
 * here — nothing else in the LLM layer changes.
 */
abstract class RetailSite implements LlmSiteModule {
  abstract readonly siteId: RetailSiteSource;
  readonly systemPrompt = RETAIL_SYSTEM_PROMPT;
  readonly jsonSchema: object = RETAIL_JSON_SCHEMA;

  buildUserPrompt(markdown: string): string {
    return buildRetailUserPrompt(markdown, this.getExamples());
  }

  validate(raw: unknown, markdown?: string): UniversalListing {
    return validateRetailListing(raw, this.siteId, markdown);
  }

  getExamples(): LlmExample[] {
    return [];
  }
}

@Injectable()
export class ElectroDepotSite extends RetailSite {
  readonly siteId = SiteSource.ELECTRODEPOT;
}

@Injectable()
export class FnacSite extends RetailSite {
  readonly siteId = SiteSource.FNAC;
}

@Injectable()
export class DartySite extends RetailSite {
  readonly siteId = SiteSource.DARTY;
}

@Injectable()
export class BoulangerSite extends RetailSite {
  readonly siteId = SiteSource.BOULANGER;
}
