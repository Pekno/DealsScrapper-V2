import { Module } from '@nestjs/common';
import { OllamaModule } from './ollama/ollama.module.js';
import { HtmlToMarkdownModule } from './html-to-markdown/html-to-markdown.module.js';
import { LlmSiteRegistry, LLM_SITE_MODULES } from './sites/site.registry.js';
import { LlmExtractionService } from './llm-extraction.service.js';
import { DealabsSite } from './sites/dealabs/dealabs.site.js';
import { VintedSite } from './sites/vinted/vinted.site.js';
import { LeBonCoinSite } from './sites/leboncoin/leboncoin.site.js';

@Module({
  imports: [OllamaModule, HtmlToMarkdownModule],
  providers: [
    DealabsSite,
    VintedSite,
    LeBonCoinSite,
    {
      provide: LLM_SITE_MODULES,
      useFactory: (dealabsSite: DealabsSite, vintedSite: VintedSite, lbcSite: LeBonCoinSite) => [dealabsSite, vintedSite, lbcSite],
      inject: [DealabsSite, VintedSite, LeBonCoinSite],
    },
    LlmSiteRegistry,
    LlmExtractionService,
  ],
  exports: [LlmExtractionService, OllamaModule],
})
export class LlmExtractionModule {}
