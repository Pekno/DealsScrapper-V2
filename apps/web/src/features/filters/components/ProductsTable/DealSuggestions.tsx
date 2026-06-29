/**
 * DealSuggestions - Renders cross-site "also found on" matches for an expanded row.
 * Lazily fetches via useSuggestions (only when `enabled`).
 */
import React from 'react';
import type { ProductSuggestion } from '@dealscrapper/shared-types';
import { useSuggestions } from '../../hooks/useSuggestions';
import { formatRelativeTime } from '@/shared/lib/date-utils';
import { dataCy } from '@/shared/lib/test-utils';
import { SiteBadge } from '@/shared/ui';
import type { SiteInfo } from '@/shared/hooks/useSiteRegistry';
import * as styles from './DealSuggestions.css';

export interface DealSuggestionsProps {
  /** Source article to find cross-site matches for */
  articleId: string;
  /** Whether the row is expanded — drives the lazy fetch */
  enabled: boolean;
  /** Site lookup hoisted from the parent table — passed to SiteBadge */
  getSiteByName: (name: string) => SiteInfo | undefined;
}

/**
 * Format price with EUR currency, mirroring the table's price formatting.
 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

function SuggestionRow({
  suggestion,
  getSiteByName,
}: {
  suggestion: ProductSuggestion;
  getSiteByName: (name: string) => SiteInfo | undefined;
}): React.ReactElement {
  return (
    <div className={styles.item} {...dataCy(`suggestion-${suggestion.articleId}`)}>
      <SiteBadge
        source={suggestion.source}
        siteInfo={getSiteByName(String(suggestion.source).toLowerCase())}
        size="small"
        showIcon
      />
      <a
        href={suggestion.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.titleLink}
        title={suggestion.title}
      >
        {suggestion.title}
      </a>
      {suggestion.currentPrice != null && (
        <span className={styles.price}>{formatPrice(suggestion.currentPrice)}</span>
      )}
      <span className={styles.time}>{formatRelativeTime(suggestion.scrapedAt)}</span>
    </div>
  );
}

export const DealSuggestions: React.FC<DealSuggestionsProps> = ({
  articleId,
  enabled,
  getSiteByName,
}) => {
  const { suggestions, isLoading, isError } = useSuggestions(articleId, enabled);

  return (
    <div className={styles.container} {...dataCy(`suggestions-${articleId}`)}>
      <div className={styles.heading}>Also found on</div>
      {isLoading ? (
        <div className={styles.message}>Loading matches…</div>
      ) : isError ? (
        <div className={styles.message}>Could not load matches.</div>
      ) : suggestions.length === 0 ? (
        <div className={styles.message}>No matches found on other sites</div>
      ) : (
        <div className={styles.list}>
          {suggestions.map((suggestion) => (
            <SuggestionRow
              key={suggestion.articleId}
              suggestion={suggestion}
              getSiteByName={getSiteByName}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DealSuggestions;
