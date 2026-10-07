import { ApiProperty } from '@nestjs/swagger';
import { SiteSource } from '@dealscrapper/shared-types';

/**
 * Swagger DTO mirroring the `ProductSuggestion` shared type.
 *
 * A cross-site article suggested as the SAME product as a matched deal
 * ("also found on" suggestions). Structurally identical to
 * `ProductSuggestion`, so the service can return that type directly while
 * this DTO documents the response shape for OpenAPI.
 */
export class ProductSuggestionDto {
  @ApiProperty({
    description: 'Suggested article ID (internal CUID / Elasticsearch _id)',
    example: 'clx1234567890',
  })
  articleId: string;

  @ApiProperty({
    description: 'Source site of the suggested article',
    example: SiteSource.VINTED,
    enum: SiteSource,
  })
  source: SiteSource;

  @ApiProperty({
    description: 'Title of the suggested article',
    example: 'iPhone 15 Pro 256GB',
  })
  title: string;

  @ApiProperty({
    description: 'Current price of the suggested article (null if unknown)',
    example: 899.99,
    nullable: true,
    type: Number,
  })
  currentPrice: number | null;

  @ApiProperty({
    description: 'URL of the suggested article on its source site',
    example: 'https://www.vinted.fr/items/123456',
  })
  url: string;

  @ApiProperty({
    description: 'When the suggested article was scraped',
    example: '2025-01-15T14:22:30Z',
  })
  scrapedAt: Date;

  @ApiProperty({
    description: 'Relevance score from Elasticsearch (higher is more similar)',
    example: 12.4,
  })
  score: number;
}
