import { Injectable, Logger } from '@nestjs/common';
import { SiteSource } from '@dealscrapper/shared-types';
import {
  ICategoryDiscoveryAdapter,
  CategoryMetadata,
  CategoryNode,
} from '../base/category-discovery-adapter.interface.js';

/**
 * Static-list category discovery for retail sites that block crawlers.
 *
 * ⚠️ ponytail: Fnac, Darty and Boulanger sit behind DataDome and returned
 * 403/hang-up even on robots.txt, so a sitemap crawl (like Électro Dépôt's)
 * couldn't be verified. These adapters return a small hand-seeded list of
 * top-level categories so the sites are functional, NOT empty. The slugs are
 * BEST-EFFORT and unverified — confirm/expand them against the live site once the
 * anti-bot path is solved, or replace this with a real sitemap parse if one is
 * found. The shared base keeps all three identical except their seed list.
 */
abstract class StaticRetailCategoryDiscoveryAdapter implements ICategoryDiscoveryAdapter {
  abstract readonly siteId: string;
  abstract readonly baseUrl: string;
  /** Best-effort top-level category seeds: { slug, name }. */
  protected abstract readonly seeds: ReadonlyArray<{ slug: string; name: string }>;

  protected readonly logger = new Logger(this.constructor.name);

  discoverCategories(): Promise<CategoryMetadata[]> {
    this.logger.warn(
      `${this.siteId}: using STATIC seed categories (${this.seeds.length}) — site blocks crawlers, slugs unverified`,
    );
    return Promise.resolve(
      this.seeds.map((s) => ({
        slug: s.slug,
        name: s.name,
        url: `${this.baseUrl}/${s.slug}`,
        parentId: null,
        isSelectable: true,
      })),
    );
  }

  async buildCategoryTree(): Promise<CategoryNode[]> {
    const cats = await this.discoverCategories();
    return cats.map((c) => ({ ...c, children: [] }));
  }
}

// ponytail: all seed slugs below are unverified guesses — fix against live site.
@Injectable()
export class FnacCategoryDiscoveryAdapter extends StaticRetailCategoryDiscoveryAdapter {
  readonly siteId = SiteSource.FNAC;
  readonly baseUrl = 'https://www.fnac.com';
  protected readonly seeds = [
    { slug: 'Tablette-tactile-iPad', name: 'Tablettes' },
    { slug: 'Ordinateur-portable', name: 'Ordinateurs portables' },
    { slug: 'Television-TV', name: 'Téléviseurs' },
    { slug: 'Telephone-portable-smartphone', name: 'Smartphones' },
    { slug: 'Casque-audio-Ecouteurs', name: 'Casques & écouteurs' },
  ] as const;
}

@Injectable()
export class DartyCategoryDiscoveryAdapter extends StaticRetailCategoryDiscoveryAdapter {
  readonly siteId = SiteSource.DARTY;
  readonly baseUrl = 'https://www.darty.com';
  protected readonly seeds = [
    { slug: 'lave_linge', name: 'Lave-linge' },
    { slug: 'refrigerateur', name: 'Réfrigérateurs' },
    { slug: 'televiseur', name: 'Téléviseurs' },
    { slug: 'ordinateur_portable', name: 'Ordinateurs portables' },
    { slug: 'smartphone', name: 'Smartphones' },
  ] as const;
}

// Boulanger now has a verified sitemap-based discovery adapter
// (../boulanger/boulanger-category-discovery.adapter.ts), so it's no longer here.
