/**
 * Site source discriminator enum
 * Extracted to a separate file to avoid pulling in @prisma/client dependencies
 * when only the SiteSource enum is needed.
 */
export enum SiteSource {
  DEALABS = 'dealabs',
  VINTED = 'vinted',
  LEBONCOIN = 'leboncoin',
}
