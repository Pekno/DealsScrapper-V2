import { Module } from '@nestjs/common';
import { OllamaModule } from './ollama/ollama.module.js';
import { HtmlToMarkdownModule } from './html-to-markdown/html-to-markdown.module.js';
import { LlmSiteRegistry, LLM_SITE_MODULES } from './sites/site.registry.js';
import { LlmExtractionService } from './llm-extraction.service.js';
import { DealabsSite } from './sites/dealabs/dealabs.site.js';
import { VintedSite } from './sites/vinted/vinted.site.js';
import { LeBonCoinSite } from './sites/leboncoin/leboncoin.site.js';
import { ElectroDepotSite, FnacSite, DartySite, BoulangerSite } from './sites/retail/retail.site.js';

@Module({
  imports: [OllamaModule, HtmlToMarkdownModule],
  providers: [
    DealabsSite,
    VintedSite,
    LeBonCoinSite,
    ElectroDepotSite,
    FnacSite,
    DartySite,
    BoulangerSite,
    {
      provide: LLM_SITE_MODULES,
      useFactory: (
        dealabsSite: DealabsSite,
        vintedSite: VintedSite,
        lbcSite: LeBonCoinSite,
        electroDepotSite: ElectroDepotSite,
        fnacSite: FnacSite,
        dartySite: DartySite,
        boulangerSite: BoulangerSite,
      ) => [dealabsSite, vintedSite, lbcSite, electroDepotSite, fnacSite, dartySite, boulangerSite],
      inject: [DealabsSite, VintedSite, LeBonCoinSite, ElectroDepotSite, FnacSite, DartySite, BoulangerSite],
    },
    LlmSiteRegistry,
    LlmExtractionService,
  ],
  exports: [LlmExtractionService, OllamaModule],
})
export class LlmExtractionModule {}
