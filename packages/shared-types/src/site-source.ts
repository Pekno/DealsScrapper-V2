/**
 * Site source discriminator enum
 * Extracted to a separate file to avoid pulling in @prisma/client dependencies
 * when only the SiteSource enum is needed.
 */
export enum SiteSource {
  DEALABS = 'dealabs',
  VINTED = 'vinted',
  LEBONCOIN = 'leboncoin',
  // Retail product-listing sites. They share one extension table (ArticleRetail)
  // and one LLM "retail" site module — only their adapter config differs.
  ELECTRODEPOT = 'electrodepot',
  FNAC = 'fnac',
  DARTY = 'darty',
  BOULANGER = 'boulanger',
}

/**
 * The SiteSources that belong to the retail family (shared ArticleRetail table,
 * shared LLM retail module). Single source of truth — extend here when adding
 * another retail site and the wrappers/validators follow automatically.
 */
export const RETAIL_SITE_SOURCES = [
  SiteSource.ELECTRODEPOT,
  SiteSource.FNAC,
  SiteSource.DARTY,
  SiteSource.BOULANGER,
] as const;

export type RetailSiteSource = (typeof RETAIL_SITE_SOURCES)[number];
