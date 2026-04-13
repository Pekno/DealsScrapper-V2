/**
 * ProductsTableRow - Individual table row component for a single article
 * Renders dynamic columns based on shared-types column definitions
 */
import React from 'react';
import moment from 'moment';
import * as tableStyles from '../MatchesTable.css';
import type { ArticleWithMatch } from '@/shared/types/article';
import { formatDateTime } from '@/shared/lib/date-utils';
import { dataCy } from '@/shared/lib/test-utils';
import { SiteBadge } from '@/shared/ui';
import type { TableColumnDefinition } from '@dealscrapper/shared-types';
import type { SiteInfo } from '@/shared/hooks/useSiteRegistry';

export interface ProductsTableRowProps {
  /** Article data to display */
  article: ArticleWithMatch;
  /** Dynamic columns from shared-types */
  columns: TableColumnDefinition[];
  /** Site lookup function hoisted from the parent table — avoids one hook call per row */
  getSiteByName: (name: string) => SiteInfo | undefined;
}

/**
 * Format price with currency
 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
}

/**
 * Get heat color based on temperature
 */
function getHeatColor(temperature: number): string {
  if (temperature >= 150) return '#DC2626';
  if (temperature >= 100) return '#F59E0B';
  if (temperature >= 50) return '#10B981';
  return '#6B7280';
}

/**
 * Render the consolidated site details cell as compact tags
 */
function renderSiteDetails(article: ArticleWithMatch): React.ReactNode {
  const data = article as unknown as Record<string, unknown>;
  const tags: React.ReactNode[] = [];

  // Dealabs attributes
  if (data.temperature != null && typeof data.temperature === 'number') {
    tags.push(
      <span
        key="temperature"
        className={tableStyles.detailsTagHeat}
        style={{ color: getHeatColor(data.temperature) }}
      >
        {data.temperature}°
      </span>
    );
  }

  if (
    data.discountPercentage != null &&
    typeof data.discountPercentage === 'number' &&
    data.discountPercentage > 0
  ) {
    tags.push(
      <span key="discount" className={tableStyles.detailsTagDiscount}>
        -{Math.round(data.discountPercentage)}%
      </span>
    );
  }

  if (data.merchant && typeof data.merchant === 'string') {
    tags.push(
      <span key="merchant" className={tableStyles.detailsTag}>
        <span className={tableStyles.detailsTagLabel}>Shop</span> {data.merchant}
      </span>
    );
  }

  if (data.freeShipping === true) {
    tags.push(
      <span key="freeShipping" className={tableStyles.detailsTag}>
        Free shipping
      </span>
    );
  }

  // Vinted attributes
  if (data.brand && typeof data.brand === 'string') {
    tags.push(
      <span key="brand" className={tableStyles.detailsTag}>
        <span className={tableStyles.detailsTagLabel}>Brand</span> {data.brand}
      </span>
    );
  }

  if (data.size && typeof data.size === 'string') {
    tags.push(
      <span key="size" className={tableStyles.detailsTag}>
        <span className={tableStyles.detailsTagLabel}>Size</span> {data.size}
      </span>
    );
  }

  if (data.condition && typeof data.condition === 'string') {
    tags.push(
      <span key="condition" className={tableStyles.detailsTag}>
        {data.condition}
      </span>
    );
  }

  if (data.favoriteCount != null && typeof data.favoriteCount === 'number') {
    tags.push(
      <span key="favorites" className={tableStyles.detailsTag}>
        {data.favoriteCount} fav
      </span>
    );
  }

  if (data.color && typeof data.color === 'string') {
    tags.push(
      <span key="color" className={tableStyles.detailsTag}>
        {data.color}
      </span>
    );
  }

  // LeBonCoin attributes
  if (data.city && typeof data.city === 'string') {
    tags.push(
      <span key="city" className={tableStyles.detailsTag}>
        {data.city}
      </span>
    );
  }

  if (data.proSeller === true) {
    tags.push(
      <span key="pro" className={tableStyles.detailsTag}>
        Pro
      </span>
    );
  }

  if (data.shippingCost != null && typeof data.shippingCost === 'number') {
    tags.push(
      <span key="shipping" className={tableStyles.detailsTag}>
        <span className={tableStyles.detailsTagLabel}>Ship</span> {formatPrice(data.shippingCost)}
      </span>
    );
  }

  if (data.urgentFlag === true) {
    tags.push(
      <span key="urgent" className={tableStyles.detailsTag} style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
        Urgent
      </span>
    );
  }

  if (tags.length === 0) {
    return <span style={{ color: '#9CA3AF' }}>-</span>;
  }

  return <div className={tableStyles.detailsTagList}>{tags}</div>;
}

/**
 * Format relative time using moment.js
 */
function formatRelativeTime(date: string | Date): string {
  return moment(date).fromNow();
}

/**
 * Format match score - Display as percentage (assuming 0-100 range from backend)
 */
function formatScore(score: number): string {
  const percentage = Math.round(score || 0);
  return `${percentage}%`;
}

/**
 * Render cell content based on column definition and article data
 */
function renderCellContent(
  column: TableColumnDefinition,
  article: ArticleWithMatch,
  getSiteByName: (name: string) => SiteInfo | undefined
): React.ReactNode {
  const key = column.key;
  // Use type assertion through unknown to safely access dynamic properties
  const value = (article as unknown as Record<string, unknown>)[key];

  switch (key) {
    case 'title':
      return (
        <>
          {article.imageUrl ? (
            <img
              src={article.imageUrl}
              alt={article.title}
              className={tableStyles.productThumbnail}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const nextElement = e.currentTarget
                  .nextElementSibling as HTMLElement;
                if (nextElement) nextElement.style.display = 'flex';
              }}
            />
          ) : (
            <div className={tableStyles.thumbnailPlaceholder}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
          )}
          <div className={tableStyles.productTitle}>
            {article.title}
            {article.siteId && (
              <div style={{ marginTop: '4px' }}>
                <SiteBadge
                  source={article.siteId}
                  siteInfo={getSiteByName(article.siteId.toLowerCase())}
                  size="small"
                  showIcon
                />
              </div>
            )}
          </div>
          {/* Product Tooltip */}
          <div className={tableStyles.productTooltip}>
            {article.imageUrl ? (
              <img
                src={article.imageUrl}
                alt={article.title}
                className={tableStyles.productTooltipImage}
              />
            ) : (
              <div className={tableStyles.productTooltipImagePlaceholder}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
            )}
            <h4 className={tableStyles.productTooltipTitle}>{article.title}</h4>
          </div>
        </>
      );

    case 'temperature':
      return (
        <span
          style={{
            color: getHeatColor(article.temperature || 0),
            fontWeight: '700',
          }}
        >
          {article.temperature || 0}°
        </span>
      );

    case 'originalPrice':
      if (
        article.originalPrice &&
        article.originalPrice > 0 &&
        article.originalPrice > article.currentPrice
      ) {
        return (
          <span className={tableStyles.originalPrice}>
            {formatPrice(article.originalPrice)}
          </span>
        );
      }
      return null;

    case 'discountPercentage':
      if (
        article.discountPercentage != null &&
        article.discountPercentage !== 0 &&
        Number(article.discountPercentage) > 0
      ) {
        return (
          <span className={tableStyles.discountBadge}>
            -{Math.round(Number(article.discountPercentage))}%
          </span>
        );
      }
      return null;

    case 'currentPrice':
      return (
        <span className={tableStyles.currentPrice}>
          {formatPrice(article.currentPrice)}
        </span>
      );

    case 'merchant':
      return article.merchant || 'Unknown';

    case 'score':
      return (
        <span className={tableStyles.scoreBadge}>
          {formatScore(article.matchScore)}
        </span>
      );

    case 'publishedAt':
      return renderDateCell(article);

    case 'siteDetails':
      return renderSiteDetails(article);

    // Vinted-specific columns
    case 'brand':
      return typeof value === 'string' ? value : '-';

    case 'size':
      return typeof value === 'string' ? value : '-';

    case 'condition':
      return typeof value === 'string' ? value : '-';

    case 'favoriteCount':
      return typeof value === 'number' ? value.toString() : '-';

    case 'color':
      return typeof value === 'string' ? value : '-';

    // LeBonCoin-specific columns
    case 'city':
      return typeof value === 'string' ? value : '-';

    case 'proSeller':
      return value === true ? 'Yes' : value === false ? 'No' : '-';

    case 'shippingCost':
      return typeof value === 'number' ? formatPrice(value) : '-';

    case 'urgentFlag':
      return value === true ? 'Yes' : '-';

    // Dealabs-specific columns
    case 'freeShipping':
      return value === true ? 'Free' : '-';

    default:
      // Generic rendering for unknown columns
      if (value === null || value === undefined) {
        return '-';
      }
      if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
      }
      if (typeof value === 'number') {
        if (column.format === 'currency') {
          return formatPrice(value);
        }
        if (column.format === 'percentage') {
          return `${Math.round(value)}%`;
        }
        return value.toString();
      }
      if (value instanceof Date) {
        return formatRelativeTime(value);
      }
      return String(value);
  }
}

/**
 * Render the date cell with tooltips for expired/active articles
 */
function renderDateCell(article: ArticleWithMatch): React.ReactNode {
  if (article.isExpired && article.expiresAt) {
    const expiredDate = new Date(article.expiresAt);
    const scrapedDate = article.createdAt || new Date();

    return (
      <>
        <span style={{ color: '#DC2626', fontWeight: '600' }}>
          {formatRelativeTime(expiredDate)}
        </span>
        <span className={tableStyles.expiredDateTooltip}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
            ⚠️ EXPIRED
          </div>
          <div>Expired at: {formatDateTime(expiredDate)}</div>
          <div>Scraped at: {formatDateTime(scrapedDate)}</div>
          {article.publishedAt && (
            <div>
              Published at: {formatDateTime(new Date(article.publishedAt))}
            </div>
          )}
        </span>
      </>
    );
  }

  const publishedDate = article.publishedAt
    ? new Date(article.publishedAt)
    : new Date();
  const scrapedDate = article.createdAt || new Date();

  return (
    <>
      {formatRelativeTime(publishedDate)}
      <span className={tableStyles.dateTooltip}>
        <div>Published at: {formatDateTime(publishedDate)}</div>
        <div>Scraped at: {formatDateTime(scrapedDate)}</div>
        {article.expiresAt && (
          <div>
            Expires at: {formatDateTime(new Date(article.expiresAt))}
          </div>
        )}
      </span>
    </>
  );
}

/**
 * Get the appropriate cell CSS class based on column key
 */
function getCellClass(columnKey: string): string {
  const classMap: Record<string, string> = {
    title: tableStyles.productNameCell,
    temperature: tableStyles.heatCell,
    originalPrice: tableStyles.priceCell,
    discountPercentage: tableStyles.discountCell,
    currentPrice: tableStyles.priceCell,
    merchant: tableStyles.shopCell,
    score: tableStyles.scoreCell,
    publishedAt: tableStyles.dateCell,
    siteDetails: tableStyles.detailsCell,
  };
  return classMap[columnKey] || '';
}

export const ProductsTableRow: React.FC<ProductsTableRowProps> = ({
  article,
  columns,
  getSiteByName,
}) => {
  /**
   * Handle row click to redirect to deal URL
   */
  const handleRowClick = (): void => {
    if (article.url) {
      window.open(article.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <tr
      key={article.id}
      className={
        article.isExpired ? tableStyles.expiredTableRow : tableStyles.tableRow
      }
      onClick={handleRowClick}
      style={{ cursor: 'pointer' }}
      title={`Click to view deal: ${article.title}${article.isExpired ? ' (EXPIRED)' : ''}`}
      {...dataCy(`match-${article.id}`)}
    >
      {columns.map((column) => (
        <td
          key={column.key}
          className={getCellClass(column.key)}
          style={{ textAlign: column.align || 'left' }}
          {...dataCy(`cell-${column.key}`)}
        >
          {renderCellContent(column, article, getSiteByName)}
        </td>
      ))}
    </tr>
  );
};

export default ProductsTableRow;
