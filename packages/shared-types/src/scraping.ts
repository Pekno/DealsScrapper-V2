// Scraping-related types shared across services

import { RawDeal } from './deals.js';
import { ScrapeJobStatus } from './enums.js';

export interface CategoryStructure {
  id: string;
  slug: string;
  name: string;
  siteId: string; // 'dealabs' | 'vinted' | 'leboncoin'
  sourceUrl: string; // Original category page URL
  parentId?: string | null; // Parent category ID (FK)
  level: number;
  description?: string;
  dealCount: number;
  avgTemperature: number;
  popularBrands: string[];
  isActive: boolean;
  userCount: number;
}

export interface ScrapeResult {
  success: boolean;
  categoryId: string;
  categoryUrl: string;
  categorySlug: string;
  totalDealsFound: number;
  newDealsCount: number;
  pagesScraped: number;
  maxPagesConfigured: number;
  scrapeDuration: number;
  error: string | null;
  timestamp: Date;
  // Legacy fields for backward compatibility
  milestoneId: string | null;
  milestoneReached: boolean;
  efficiency: number;
  nextScrapeDelay: number;
}

export interface ScrapeJob {
  id: string;
  categoryId: string;
  categorySlug: string;
  status: ScrapeJobStatus;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  source: 'adaptive_scheduler' | 'manual' | 'cron';
  dealsFound?: number;
  error?: string;
}

export interface AdaptiveSchedulingMetrics {
  activeSchedules: number;
  avgEfficiency: number;
  avgDealsPerHour: number;
  categoriesMonitored: number;
  lastUpdateTime: Date;
}
