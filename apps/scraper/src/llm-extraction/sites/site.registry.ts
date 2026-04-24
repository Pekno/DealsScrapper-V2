import { Injectable, Inject } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import type { SiteId } from '@dealscrapper/shared-types';
import { scraperLogConfig } from '../../config/logging.config.js';
import type { LlmSiteModule } from './site.interface.js';
import { UnknownSiteError } from './llm.errors.js';

export const LLM_SITE_MODULES = 'LLM_SITE_MODULES';

@Injectable()
export class LlmSiteRegistry {
  private readonly logger = createServiceLogger(scraperLogConfig);
  private readonly registry = new Map<SiteId, LlmSiteModule>();

  constructor(
    @Inject(LLM_SITE_MODULES) siteModules: LlmSiteModule[]
  ) {
    for (const mod of siteModules) {
      this.registry.set(mod.siteId, mod);
      this.logger.log(`Registered LLM site module for: ${mod.siteId}`);
    }
  }

  get(siteId: SiteId): LlmSiteModule {
    const mod = this.registry.get(siteId);
    if (!mod) {
      throw new UnknownSiteError(siteId);
    }
    return mod;
  }
}
