import type {
  FilterExpressionInput,
  DigestFrequency,
} from '../types/filter-expression.types.js';
import { CategoryDto } from '../../categories/dto/category.dto.js';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SiteSource } from '@dealscrapper/shared-types';

export class FilterStatsDto {
  totalMatches: number;
  matchesLast24h: number;
  matchesLast7d: number;
  avgScore: number;
  topScore: number;
  lastMatchAt?: Date;
}

export class FilterResponseDto {
  @ApiProperty({
    description: 'Unique filter identifier',
    example: 'cldx123abc',
  })
  id: string;

  @ApiProperty({
    description: 'User ID who owns this filter',
    example: 'user123',
  })
  userId: string;

  @ApiProperty({
    description: 'Filter name for easy identification',
    example: 'Gaming Laptop Deals',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Detailed description of what this filter monitors',
    example: 'Monitor high-end gaming laptops under $1500 with RTX graphics',
  })
  description?: string;

  @ApiProperty({
    description: 'Whether this filter is actively monitoring deals',
    example: true,
  })
  active: boolean;

  @ApiProperty({
    description: 'Filter creation timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Filter last update timestamp',
    example: '2025-01-15T14:22:30Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description:
      'Categories being monitored by this filter (for scheduling info, use /filters/:id/scraping-status endpoint)',
    type: [CategoryDto],
  })
  categories: CategoryDto[];

  @ApiProperty({
    description: 'Sites where this filter matches articles (derived from categories)',
    example: [SiteSource.DEALABS, SiteSource.VINTED],
    isArray: true,
  })
  enabledSites: string[];

  @ApiProperty({
    description: 'Complex filtering rules and criteria for deal matching',
  })
  filterExpression: FilterExpressionInput;

  @ApiProperty({
    description: 'Send immediate notifications when deals match this filter',
    example: true,
  })
  immediateNotifications: boolean;

  @ApiProperty({
    description: 'Frequency for digest notifications with matched deals',
    example: 'daily',
    enum: ['hourly', 'daily', 'weekly', 'disabled'],
  })
  digestFrequency: DigestFrequency;

  @ApiProperty({
    description: 'Maximum number of notifications per day to prevent spam',
    example: 50,
    minimum: 1,
    maximum: 200,
  })
  maxNotificationsPerDay: number;

  @ApiPropertyOptional({
    description: 'Timestamp of the last match',
    example: '2025-01-15T14:22:30Z',
  })
  lastMatchAt?: Date;

  @ApiPropertyOptional({
    description:
      'Comprehensive filter statistics including matches, scores, and performance metrics',
    type: FilterStatsDto,
  })
  stats?: FilterStatsDto;

  // REMOVED: totalMatches - now only in stats object
  // REMOVED: matchesLast24h - now only in stats object
  // REMOVED: nextScheduledAt - now handled per-category in the categories array
}

export class FilterListResponseDto {
  filters: FilterResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class MatchResponseDto {
  id: string;
  filterId: string;
  filterName: string;
  articleId: string;
  score: number;
  notified: boolean;
  notifiedAt?: Date;
  createdAt: Date;

  article: {
    id: string;
    title: string;
    currentPrice: number;
    originalPrice?: number;
    // Site-specific fields (from extension tables - may be undefined for non-Dealabs articles)
    temperature?: number;
    merchant?: string;
    categoryId: string;
    siteId: string; // Site identifier for the article
    url: string;
    imageUrl?: string;
    scrapedAt: Date;
    publishedAt?: Date;
    expiresAt?: Date;
    isExpired: boolean;
  };
}

export class MatchListResponseDto {
  matches: MatchResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
