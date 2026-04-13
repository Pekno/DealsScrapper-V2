import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsEnum,
  IsDate,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import {
  DealType,
  ExclusivityLevel,
  UrgencyLevel,
  StockLevel,
  MerchantType,
  SiteSource,
} from '@dealscrapper/shared-types';

export class CreateCategoryDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString()
  siteId: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsNumber()
  @Min(1)
  @Max(3)
  level: number;

  @IsString()
  sourceUrl: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  popularBrands?: string[] = [];
}

export class CreateDealDto {
  @IsString()
  externalId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  subcategory?: string;

  @IsOptional()
  @IsString()
  productType?: string;

  @IsArray()
  @IsString({ each: true })
  categoryPath: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cashbackAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  loyaltyPoints?: number;

  @IsOptional()
  @IsString()
  merchant?: string;

  @IsOptional()
  @IsEnum(MerchantType)
  merchantType?: MerchantType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  merchantRating?: number;

  @IsOptional()
  @IsString()
  storeLocation?: string;

  @IsOptional()
  @IsEnum(DealType)
  dealType?: DealType;

  @IsOptional()
  @IsEnum(ExclusivityLevel)
  exclusivityLevel?: ExclusivityLevel;

  @IsOptional()
  @IsEnum(UrgencyLevel)
  urgencyLevel?: UrgencyLevel;

  @IsOptional()
  @IsEnum(StockLevel)
  stockLevel?: StockLevel;

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  freeShipping: boolean = false;

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  pickupAvailable: boolean = false;

  @IsArray()
  @IsString({ each: true })
  deliveryMethods: string[] = [];

  @IsArray()
  @IsString({ each: true })
  geographicRestrictions: string[] = [];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99)
  ageRestriction?: number;

  @IsOptional()
  @IsString()
  membershipRequired?: string;

  @IsNumber()
  @Min(-500)
  @Max(5000)
  temperature: number = 0;

  @IsNumber()
  @Min(0)
  voteCount: number = 0;

  @IsNumber()
  @Min(0)
  upvotes: number = 0;

  @IsNumber()
  @Min(0)
  downvotes: number = 0;

  @IsNumber()
  @Min(0)
  commentCount: number = 0;

  @IsNumber()
  @Min(0)
  viewCount: number = 0;

  @IsNumber()
  @Min(0)
  shareCount: number = 0;

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  communityVerified: boolean = false;

  @IsOptional()
  @IsString()
  contributorLevel?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishedAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dealAge?: number;

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  affiliateUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords: string[] = [];

  @IsArray()
  @IsString({ each: true })
  tags: string[] = [];

  @IsArray()
  @IsString({ each: true })
  searchTerms: string[] = [];

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isExpired: boolean = false;

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isCoupon: boolean = false;

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isSponsored: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  qualityScore?: number;

  @IsString()
  source: string = SiteSource.DEALABS;

  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isActive: boolean = true;
}

export class ScrapeRequestDto {
  @IsString()
  categoryUrl: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsBoolean()
  enableFiltering?: boolean = true;

  @IsOptional()
  @IsBoolean()
  forceFullScrape?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxPages?: number = 3;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(10000)
  delayBetweenRequests?: number = 2000;

  @IsOptional()
  @IsBoolean()
  useProxy?: boolean = false;
}

export class ScrapeResponseDto {
  categoryUrl: string;
  categorySlug: string;
  newDealsFound: number;
  totalProcessed: number;
  duplicatesSkipped: number;
  sponsoredFiltered: number;
  errors: string[];
  scrapeDuration: number;
  efficiency: number;
  nextScrapeIn: number;
  success: boolean;
}
