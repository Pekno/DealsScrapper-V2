/**
 * SiteBadge - Small badge component displaying site source with brand color
 * Used to indicate which platform (Dealabs, Vinted, LeBonCoin) an article is from
 *
 * Pure presentational component — callers must resolve site info via useSiteRegistry
 * and pass it as the `siteInfo` prop. This avoids N hook instances in list contexts.
 */
import React from 'react';
import { SiteSource } from '@dealscrapper/shared-types';
import type { SiteInfo } from '@/shared/hooks/useSiteRegistry';
import * as styles from './SiteBadge.css';
import { dataCy } from '@/shared/lib/test-utils';

export interface SiteBadgeProps {
  /** Resolved site information from useSiteRegistry */
  siteInfo: SiteInfo | undefined;
  /** Original source string — used only for icon selection */
  source: string | SiteSource;
  /** Badge size variant */
  size?: 'small' | 'medium' | 'large';
  /** Whether to show site icon/emoji */
  showIcon?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Get site emoji icon
 */
const getSiteIcon = (source: string): string => {
  switch (source) {
    case SiteSource.DEALABS:
    case 'dealabs':
      return '🔥'; // Hot deals
    case SiteSource.VINTED:
    case 'vinted':
      return '👕'; // Fashion/clothing
    case SiteSource.LEBONCOIN:
    case 'leboncoin':
      return '🏷️'; // Marketplace
    default:
      return '📦';
  }
};

/**
 * SiteBadge Component
 * Displays a colored badge with site name and optional icon.
 * Callers are responsible for resolving siteInfo via useSiteRegistry.
 */
export const SiteBadge: React.FC<SiteBadgeProps> = ({
  siteInfo,
  source,
  size = 'small',
  showIcon = false,
  className = '',
}) => {
  if (!siteInfo) {
    return null;
  }

  // Normalize source to lowercase for icon lookup
  const normalizedSource = typeof source === 'string' ? source.toLowerCase() : source;
  const icon = getSiteIcon(normalizedSource);

  return (
    <span
      className={`${styles.siteBadge.base} ${styles.siteBadge[size]} ${className}`}
      style={{
        backgroundColor: `${siteInfo.color}20`, // 20% opacity
        color: siteInfo.color,
        borderColor: siteInfo.color,
      }}
      title={`Source: ${siteInfo.displayName}`}
      {...dataCy(`site-badge-${siteInfo.name}`)}
    >
      {showIcon && <span className={styles.siteBadge.icon}>{icon}</span>}
      <span className={styles.siteBadge.name}>{siteInfo.displayName}</span>
    </span>
  );
};

export default SiteBadge;
