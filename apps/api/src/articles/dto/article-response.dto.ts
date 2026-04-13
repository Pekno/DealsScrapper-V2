import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SiteSource } from '@dealscrapper/shared-types';

export class BaseArticleDto {
  @ApiProperty({
    description: 'Unique article identifier (internal CUID)',
    example: 'clx1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'External ID from the source site',
    example: '123456',
  })
  externalId: string;

  @ApiProperty({
    description: 'Source site of the article',
    example: SiteSource.DEALABS,
    enum: SiteSource,
  })
  source: SiteSource;

  @ApiProperty({
    description: 'Article title',
    example: 'iPhone 15 Pro - Great Deal!',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Article description',
    example: 'Brand new iPhone 15 Pro with warranty...',
  })
  description?: string | null;

  @ApiProperty({
    description: 'Article URL on the source site',
    example: 'https://www.dealabs.com/deals/iphone-15-pro-123456',
  })
  url: string;

  @ApiPropertyOptional({
    description: 'Article image URL',
    example: 'https://static.dealabs.com/image.jpg',
  })
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Current price of the article',
    example: 999.99,
  })
  currentPrice?: number | null;

  @ApiPropertyOptional({
    description: 'Category ID',
    example: 'cat-electronics-123',
  })
  categoryId?: string | null;

  @ApiPropertyOptional({
    description: 'Location (if applicable)',
    example: 'Paris, France',
  })
  location?: string | null;

  @ApiPropertyOptional({
    description: 'When the article was published on the source site',
    example: '2025-01-15T10:30:00Z',
  })
  publishedAt?: Date | null;

  @ApiProperty({
    description: 'When the article was scraped',
    example: '2025-01-15T14:22:30Z',
  })
  scrapedAt: Date;

  @ApiProperty({
    description: 'Whether the article is still active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Whether the article has expired',
    example: false,
  })
  isExpired: boolean;
}

export class DealabsExtensionDto {
  @ApiPropertyOptional({
    description: 'Deal temperature (hotness score)',
    example: 250,
  })
  temperature?: number | null;

  @ApiPropertyOptional({
    description: 'Number of comments on the deal',
    example: 42,
  })
  commentCount?: number | null;

  @ApiPropertyOptional({
    description: 'Whether the deal is community verified',
    example: true,
  })
  communityVerified?: boolean | null;

  @ApiPropertyOptional({
    description: 'Whether free shipping is available',
    example: true,
  })
  freeShipping?: boolean | null;

  @ApiPropertyOptional({
    description: 'Whether this is a coupon deal',
    example: false,
  })
  isCoupon?: boolean | null;

  @ApiPropertyOptional({
    description: 'Original price before discount',
    example: 1299.99,
  })
  originalPrice?: number | null;

  @ApiPropertyOptional({
    description: 'Discount percentage',
    example: 23,
  })
  discountPercentage?: number | null;

  @ApiPropertyOptional({
    description: 'Merchant name',
    example: 'Amazon',
  })
  merchant?: string | null;

  @ApiPropertyOptional({
    description: 'Deal expiration date',
    example: '2025-01-20T23:59:59Z',
  })
  expiresAt?: Date | null;
}

export class VintedExtensionDto {
  @ApiPropertyOptional({
    description: 'Number of favorites on the listing',
    example: 15,
  })
  favoriteCount?: number | null;

  @ApiPropertyOptional({
    description: 'Number of views on the listing',
    example: 234,
  })
  viewCount?: number | null;

  @ApiPropertyOptional({
    description: 'Whether the listing is boosted',
    example: false,
  })
  boosted?: boolean | null;

  @ApiPropertyOptional({
    description: 'Brand name',
    example: 'Nike',
  })
  brand?: string | null;

  @ApiPropertyOptional({
    description: 'Item size',
    example: 'M',
  })
  size?: string | null;

  @ApiPropertyOptional({
    description: 'Item color',
    example: 'Black',
  })
  color?: string | null;

  @ApiPropertyOptional({
    description: 'Item condition',
    example: 'new_with_tags',
  })
  condition?: string | null;

  @ApiPropertyOptional({
    description: 'Seller name',
    example: 'john_doe',
  })
  sellerName?: string | null;

  @ApiPropertyOptional({
    description: 'Seller rating',
    example: 4.8,
  })
  sellerRating?: number | null;

  @ApiPropertyOptional({
    description: 'Buyer protection fee',
    example: 2.5,
  })
  buyerProtectionFee?: number | null;
}

export class LeBonCoinExtensionDto {
  @ApiPropertyOptional({
    description: 'City of the listing',
    example: 'Paris',
  })
  city?: string | null;

  @ApiPropertyOptional({
    description: 'Postcode of the listing',
    example: '75001',
  })
  postcode?: string | null;

  @ApiPropertyOptional({
    description: 'Department of the listing',
    example: 'Paris',
  })
  department?: string | null;

  @ApiPropertyOptional({
    description: 'Region of the listing',
    example: 'Ile-de-France',
  })
  region?: string | null;

  @ApiPropertyOptional({
    description: 'Whether the seller is a professional',
    example: false,
  })
  proSeller?: boolean | null;

  @ApiPropertyOptional({
    description: 'Whether the listing is marked as urgent',
    example: true,
  })
  urgentFlag?: boolean | null;

  @ApiPropertyOptional({
    description: 'Whether the listing is a top announcement',
    example: false,
  })
  topAnnonce?: boolean | null;

  @ApiPropertyOptional({
    description: 'Available delivery options',
    example: ['colissimo', 'mondial_relay'],
    isArray: true,
    type: String,
  })
  deliveryOptions?: string[] | null;

  @ApiPropertyOptional({
    description: 'Shipping cost',
    example: 5.99,
  })
  shippingCost?: number | null;

  @ApiPropertyOptional({
    description: 'Item condition',
    example: 'like_new',
  })
  condition?: string | null;

  @ApiPropertyOptional({
    description: 'Seller name',
    example: 'jean_vendeur',
  })
  sellerName?: string | null;
}

export class ArticleResponseDto {
  @ApiProperty({
    description: 'Base article data common to all sites',
    type: BaseArticleDto,
  })
  base: BaseArticleDto;

  @ApiProperty({
    description: 'Source site of the article',
    example: SiteSource.DEALABS,
    enum: SiteSource,
  })
  source: SiteSource;

  @ApiPropertyOptional({
    description: 'Dealabs-specific extension data (only present for Dealabs articles)',
    type: DealabsExtensionDto,
  })
  dealabsExtension?: DealabsExtensionDto;

  @ApiPropertyOptional({
    description: 'Vinted-specific extension data (only present for Vinted articles)',
    type: VintedExtensionDto,
  })
  vintedExtension?: VintedExtensionDto;

  @ApiPropertyOptional({
    description: 'LeBonCoin-specific extension data (only present for LeBonCoin articles)',
    type: LeBonCoinExtensionDto,
  })
  leboncoinExtension?: LeBonCoinExtensionDto;
}

export class ArticleListResponseDto {
  @ApiProperty({
    description: 'List of articles',
    type: [ArticleResponseDto],
  })
  articles: ArticleResponseDto[];

  @ApiProperty({
    description: 'Total number of matching articles',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Number of results skipped',
    example: 0,
  })
  from: number;

  @ApiProperty({
    description: 'Number of results returned',
    example: 20,
  })
  size: number;
}
