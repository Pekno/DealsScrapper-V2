/**
 * ProductCard - Individual product card component for grid layout
 * Features: product information display, pricing, heat score, match score
 */
import React, { useState } from 'react';
import * as styles from './ProductCard.css';
import type { ArticleWithMatch } from '@/shared/types/article';
import { SiteBadge } from './SiteBadge';
import { useSiteRegistry } from '@/shared/hooks';

export interface ProductCardProps {
  /** Product article data */
  article: ArticleWithMatch;
  /** Show discount calculation */
  showDiscount?: boolean;
  /** Card size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Get product category icon based on category
 */
const getCategoryIcon = (category: string): string => {
  const lowerCategory = category.toLowerCase();
  if (lowerCategory.includes('laptop') || lowerCategory.includes('computer'))
    return '💻';
  if (lowerCategory.includes('gaming')) return '🎮';
  if (lowerCategory.includes('appliance')) return '🏠';
  if (lowerCategory.includes('fashion') || lowerCategory.includes('clothing'))
    return '👕';
  if (lowerCategory.includes('travel')) return '✈️';
  if (lowerCategory.includes('smartphone') || lowerCategory.includes('phone'))
    return '📱';
  if (lowerCategory.includes('headphone') || lowerCategory.includes('audio'))
    return '🎧';
  if (lowerCategory.includes('camera')) return '📷';
  if (lowerCategory.includes('watch')) return '⌚';
  if (lowerCategory.includes('tv') || lowerCategory.includes('monitor'))
    return '📺';
  return '🛍️';
};

/**
 * Heat display component with color coding
 */
interface HeatDisplayProps {
  temperature: number;
}

const HeatDisplay: React.FC<HeatDisplayProps> = ({ temperature }) => {
  const getHeatConfig = (temp: number) => {
    if (temp >= 90) return { color: '#DC2626', label: 'Hot' };
    if (temp >= 70) return { color: '#EA580C', label: 'Warm' };
    if (temp >= 50) return { color: '#D97706', label: 'Cool' };
    return { color: '#6B7280', label: 'Cold' };
  };

  const config = getHeatConfig(temperature);

  return (
    <span
      className={styles.heatScore}
      style={{ color: config.color }}
      title={`${config.label}: ${temperature}°`}
    >
      🔥 {temperature}
    </span>
  );
};

/**
 * Format currency value
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

/**
 * Calculate discount percentage
 */
const calculateDiscountPercentage = (
  originalPrice: number,
  currentPrice: number
): number => {
  if (originalPrice <= currentPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
};

/**
 * ProductCard Component
 */
export const ProductCard: React.FC<ProductCardProps> = ({
  article,
  showDiscount = true,
  size = 'md',
}) => {
  const [imageError, setImageError] = useState(false);
  const { getSiteByName } = useSiteRegistry();
  const discountPercentage = calculateDiscountPercentage(
    article.originalPrice,
    article.currentPrice
  );
  const hasDiscount = discountPercentage > 0;
  const categoryIcon = getCategoryIcon(article.category);

  return (
    <div className={`${styles.card} ${styles.cardSize[size]}`}>
      {/* Product Image */}
      <div className={styles.imageContainer}>
        {article.imageUrl && !imageError ? (
          <img
            src={article.imageUrl}
            alt={article.title}
            className={styles.productImage}
            onError={() => setImageError(true)}
          />
        ) : null}
        <div
          className={`${styles.imagePlaceholder} ${article.imageUrl && !imageError ? styles.hidden : ''}`}
        >
          <span className={styles.placeholderIcon}>{categoryIcon}</span>
        </div>
      </div>

      {/* Product Information */}
      <div className={styles.content}>
        <div className={styles.titleContainer}>
          <span className={styles.categoryIcon}>{categoryIcon}</span>
          <h3 className={styles.productTitle}>{article.title}</h3>
        </div>

        {/* Price Section */}
        <div className={styles.pricingSection}>
          {hasDiscount && (
            <div className={styles.originalPrice}>
              {formatCurrency(article.originalPrice)}
            </div>
          )}
          <div className={styles.currentPrice}>
            💰 {formatCurrency(article.currentPrice)}
          </div>
          {hasDiscount && showDiscount && (
            <div className={styles.discount}>💸 {discountPercentage}% OFF</div>
          )}
        </div>

        {/* Merchant */}
        <div className={styles.merchant}>🏪 {article.merchant}</div>

        {/* Site Badge */}
        {article.siteId && (
          <div style={{ marginTop: '8px' }}>
            <SiteBadge
              source={article.siteId}
              siteInfo={getSiteByName(article.siteId.toLowerCase())}
              size="small"
              showIcon
            />
          </div>
        )}

        {/* Scores Row */}
        <div className={styles.scoresRow}>
          {article.temperature !== undefined && (
            <HeatDisplay temperature={article.temperature} />
          )}
          {article.matchScore && (
            <span
              className={styles.matchScore}
              title={`Match Score: ${article.matchScore.toFixed(1)}`}
            >
              ⭐ {article.matchScore.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* View Button */}
      <div className={styles.actionRow}>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.viewButton}
          aria-label={`View ${article.title} deal`}
        >
          View Deal 🔗
        </a>
      </div>
    </div>
  );
};

export default ProductCard;
