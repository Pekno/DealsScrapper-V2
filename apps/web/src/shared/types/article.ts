/**
 * Article/Product types for the DealsScrapper application
 * Representing deals/products that match filters
 *
 * NOTE: These types are for FRONTEND display purposes.
 * For backend/database operations, use ArticleWrapper from '@dealscrapper/shared-types/article'.
 */
import React from 'react';
import type {
  SiteSource,
  DealabsSpecificFields,
  VintedSpecificFields,
  LeBonCoinSpecificFields,
} from '@dealscrapper/shared-types';

/**
 * Site-specific extension data for frontend display.
 * Optional fields based on article source.
 */
export interface ArticleSiteExtension {
  /** Dealabs-specific fields (when siteId === 'dealabs') */
  dealabs?: DealabsSpecificFields;
  /** Vinted-specific fields (when siteId === 'vinted') */
  vinted?: VintedSpecificFields;
  /** LeBonCoin-specific fields (when siteId === 'leboncoin') */
  leboncoin?: LeBonCoinSpecificFields;
}

/**
 * Main article/product interface representing a deal.
 * Uses flat structure with universal fields plus optional site-specific extension.
 */
export interface Article {
  id: string;
  externalId: string;
  title: string;
  description?: string;
  model?: string;
  category: string;
  categoryPath: string[];
  currentPrice: number;
  originalPrice: number;
  discountPercentage: number;
  discountAmount: number;
  merchant: string;
  storeLocation?: string;
  freeShipping: boolean;
  geographicRestrictions?: string[];
  membershipRequired: boolean;
  publishedAt?: Date;
  expiresAt?: Date;
  url: string;
  imageUrl?: string;
  isExpired: boolean;
  /** Site source identifier - use SiteSource enum for comparison */
  siteId: SiteSource | string;
  isActive: boolean;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  // Site-specific extension data (populated based on siteId)
  extension?: ArticleSiteExtension;
  // Legacy fields for backward compatibility (prefer using extension.dealabs.* instead)
  /** @deprecated Use extension.dealabs?.temperature */
  temperature?: number;
  /** @deprecated Use extension.dealabs?.commentCount */
  commentCount?: number;
  /** @deprecated Use extension.dealabs?.communityVerified */
  communityVerified?: boolean;
  /** @deprecated Use extension.dealabs?.isCoupon */
  isCoupon?: boolean;
  // Computed fields
  age?: number; // Hours since published
  heat?: number; // Alias for temperature
  price?: number; // Alias for currentPrice
}

// Extended article with filter matching information
export interface ArticleWithMatch extends Article {
  matchScore: number; // How well it matches the filter (0-10)
  matchedRules?: string[]; // Which filter rules it matched
  matchedAt: Date; // When the match was detected
}

// Pagination and search response for articles
export interface ArticleListResponse {
  articles: ArticleWithMatch[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Query parameters for fetching articles
export interface ArticleQuery {
  filterId?: string;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string; // Allow backend field names
  sortOrder?: 'asc' | 'desc';
  minScore?: number;
  maxPrice?: number;
  minPrice?: number;
  merchant?: string;
  category?: string;
  freeShipping?: boolean;
  activeOnly?: boolean;
}

// Available sort fields for articles
// NOTE: Only fields from base Article model are supported for server-side sorting.
// Site-specific fields (temperature, merchant, originalPrice, discountPercentage)
// are in extension tables and require client-side sorting.
export type ArticleSortField =
  | 'title'
  | 'currentPrice'
  | 'publishedAt'
  | 'scrapedAt'
  | 'score' // Match score
  | 'createdAt' // Match creation date
  | 'temperature'; // Site-specific (Dealabs) - client-side sorting only

// Sort configuration interface
export interface SortConfig {
  field: ArticleSortField;
  direction: 'asc' | 'desc';
}

// Table column configuration
export interface TableColumn {
  key: ArticleSortField | 'link';
  label: string;
  sortable: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (article: ArticleWithMatch) => React.ReactNode;
}

// Heat/temperature display configuration
export interface HeatConfig {
  value: number;
  label: string;
  color: string;
  icon: string;
}

// Product tooltip data for hovering over product names
export interface ProductTooltip {
  title: string;
  imageUrl?: string;
  price: number;
  originalPrice: number;
  discount: number;
  merchant: string;
  heat: number;
  description?: string;
}

// Mock data generator function type
export type ArticleGenerator = () => ArticleWithMatch[];

// Utility types for table state management
export interface TableState {
  sortConfig: SortConfig;
  searchTerm: string;
  currentPage: number;
  itemsPerPage: number;
  filteredArticles: ArticleWithMatch[];
  totalItems: number;
}

// Action types for table state reducer
export type TableAction =
  | { type: 'SET_SORT'; payload: SortConfig }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_ITEMS_PER_PAGE'; payload: number }
  | { type: 'SET_ARTICLES'; payload: ArticleWithMatch[] }
  | { type: 'RESET_FILTERS' };
