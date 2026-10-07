import { Module } from '@nestjs/common';
import { CategoryDiscoveryAdapterRegistry } from './category-discovery-adapter.registry.js';
import { DealabsCategoryDiscoveryAdapter } from './dealabs/dealabs-category-discovery.adapter.js';
import { VintedCategoryDiscoveryAdapter } from './vinted/vinted-category-discovery.adapter.js';
import { LeBonCoinCategoryDiscoveryAdapter } from './leboncoin/leboncoin-category-discovery.adapter.js';
import { ElectroDepotCategoryDiscoveryAdapter } from './electrodepot/electrodepot-category-discovery.adapter.js';
import {
  FnacCategoryDiscoveryAdapter,
  DartyCategoryDiscoveryAdapter,
} from './retail/retail-static-discovery.js';
import { BoulangerCategoryDiscoveryAdapter } from './boulanger/boulanger-category-discovery.adapter.js';
import { PrismaService } from '@dealscrapper/database';
import { PuppeteerPoolModule } from '../puppeteer-pool/puppeteer-pool.module.js';

@Module({
  imports: [PuppeteerPoolModule],
  providers: [
    // Database
    PrismaService,
    // Site-specific adapters
    DealabsCategoryDiscoveryAdapter,
    VintedCategoryDiscoveryAdapter,
    LeBonCoinCategoryDiscoveryAdapter,
    ElectroDepotCategoryDiscoveryAdapter,
    FnacCategoryDiscoveryAdapter,
    DartyCategoryDiscoveryAdapter,
    BoulangerCategoryDiscoveryAdapter,
    // Adapter registry
    CategoryDiscoveryAdapterRegistry,
  ],
  exports: [
    CategoryDiscoveryAdapterRegistry,
    DealabsCategoryDiscoveryAdapter,
    VintedCategoryDiscoveryAdapter,
    LeBonCoinCategoryDiscoveryAdapter,
    ElectroDepotCategoryDiscoveryAdapter,
    FnacCategoryDiscoveryAdapter,
    DartyCategoryDiscoveryAdapter,
    BoulangerCategoryDiscoveryAdapter,
  ],
})
export class CategoryDiscoveryModule {}
