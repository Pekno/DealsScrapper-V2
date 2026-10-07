/**
 * Site Definitions - Single source of truth for site configuration
 *
 * Sites are defined here in code and auto-synced to the database on API startup.
 * Adding a new site = add to SITE_DEFINITIONS -> auto-syncs on next startup
 * Removing a site = remove from SITE_DEFINITIONS -> deactivated (not deleted) on next startup
 */

/**
 * Site definition interface for code-based configuration
 */
export interface SiteDefinition {
  /** Display name for the site */
  name: string;
  /** Base URL for the site (e.g., homepage) */
  baseUrl: string;
  /** URL for category discovery/listing page */
  categoryDiscoveryUrl: string;
  /** Brand color in hex format */
  color: string;
  /** Optional icon URL */
  iconUrl?: string;
}

/**
 * Site definitions - the source of truth for all supported sites
 * These are synced to the database on API startup
 *
 * Adding a new site requires:
 * 1. Add entry here with all required fields
 * 2. Create site adapter in apps/scraper/src/adapters/
 * 3. API will auto-sync to database on startup
 */
export const SITE_DEFINITIONS: Record<string, SiteDefinition> = {
  dealabs: {
    name: 'Dealabs',
    baseUrl: 'https://www.dealabs.com',
    categoryDiscoveryUrl: 'https://www.dealabs.com/groupe/',
    color: '#FF6B00',
  },
  vinted: {
    name: 'Vinted',
    baseUrl: 'https://www.vinted.fr',
    categoryDiscoveryUrl: 'https://www.vinted.fr/catalog',
    color: '#09B1BA',
  },
  leboncoin: {
    name: 'LeBonCoin',
    baseUrl: 'https://www.leboncoin.fr',
    categoryDiscoveryUrl: 'https://www.leboncoin.fr/categories',
    color: '#4A90D9',
  },
  electrodepot: {
    name: 'Électro Dépôt',
    baseUrl: 'https://www.electrodepot.fr',
    categoryDiscoveryUrl: 'https://www.electrodepot.fr/sitemap-arbo.xml',
    color: '#E2001A',
  },
  fnac: {
    name: 'Fnac',
    baseUrl: 'https://www.fnac.com',
    categoryDiscoveryUrl: 'https://www.fnac.com',
    color: '#E1A925',
  },
  darty: {
    name: 'Darty',
    baseUrl: 'https://www.darty.com',
    categoryDiscoveryUrl: 'https://www.darty.com',
    color: '#EE1C2E',
  },
  boulanger: {
    name: 'Boulanger',
    baseUrl: 'https://www.boulanger.com',
    categoryDiscoveryUrl: 'https://www.boulanger.com/sitemap_categorie.xml',
    color: '#E3001B',
  },
} as const;

/**
 * Type representing valid site IDs
 */
export type SiteId = keyof typeof SITE_DEFINITIONS;

/**
 * Array of all valid site IDs
 */
export const SITE_IDS = Object.keys(SITE_DEFINITIONS);

/**
 * Check if a string is a valid site ID
 */
export function isValidSiteId(id: string): id is SiteId {
  return id in SITE_DEFINITIONS;
}
