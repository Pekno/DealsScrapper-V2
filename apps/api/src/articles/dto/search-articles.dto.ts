import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SiteSource } from '@dealscrapper/shared-types';
import { transformBooleanParam } from '../../common/utils/sanitize.utils.js';

export class SearchArticlesDto {
  // =============================================================================
  // Full-text and basic filtering
  // =============================================================================

  @ApiPropertyOptional({
    description: 'Full-text search query (searches in title and description)',
    example: 'gaming laptop',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by site sources',
    example: [SiteSource.DEALABS, SiteSource.VINTED],
    enum: SiteSource,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(SiteSource, { each: true })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((s) => s.trim());
    }
    return value;
  })
  sites?: SiteSource[];

  @ApiPropertyOptional({
    description: 'Minimum price filter',
    example: 50,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000000)
  priceMin?: number;

  @ApiPropertyOptional({
    description: 'Maximum price filter',
    example: 500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(10000000)
  priceMax?: number;

  @ApiPropertyOptional({
    description: 'Filter by category ID',
    example: 'cat-electronics-123',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  // =============================================================================
  // Dealabs-specific filters
  // =============================================================================

  @ApiPropertyOptional({
    description: '[Dealabs] Minimum temperature (deal hotness)',
    example: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dealabs_temperatureMin?: number;

  @ApiPropertyOptional({
    description: '[Dealabs] Maximum temperature (deal hotness)',
    example: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dealabs_temperatureMax?: number;

  @ApiPropertyOptional({
    description: '[Dealabs] Filter for community verified deals only',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => transformBooleanParam(value))
  @IsBoolean()
  dealabs_communityVerified?: boolean;

  @ApiPropertyOptional({
    description: '[Dealabs] Filter for deals with free shipping',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => transformBooleanParam(value))
  @IsBoolean()
  dealabs_freeShipping?: boolean;

  // =============================================================================
  // Vinted-specific filters
  // =============================================================================

  @ApiPropertyOptional({
    description: '[Vinted] Minimum favorite count',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vinted_favoriteCountMin?: number;

  @ApiPropertyOptional({
    description: '[Vinted] Filter by brand name',
    example: 'Nike',
  })
  @IsOptional()
  @IsString()
  vinted_brand?: string;

  @ApiPropertyOptional({
    description: '[Vinted] Filter by size',
    example: 'M',
  })
  @IsOptional()
  @IsString()
  vinted_size?: string;

  @ApiPropertyOptional({
    description: '[Vinted] Filter by condition',
    example: 'new_with_tags',
  })
  @IsOptional()
  @IsString()
  vinted_condition?: string;

  // =============================================================================
  // LeBonCoin-specific filters
  // =============================================================================

  @ApiPropertyOptional({
    description: '[LeBonCoin] Filter by city',
    example: 'Paris',
  })
  @IsOptional()
  @IsString()
  leboncoin_city?: string;

  @ApiPropertyOptional({
    description: '[LeBonCoin] Filter by region',
    example: 'Ile-de-France',
  })
  @IsOptional()
  @IsString()
  leboncoin_region?: string;

  @ApiPropertyOptional({
    description: '[LeBonCoin] Filter by postcode',
    example: '75001',
  })
  @IsOptional()
  @IsString()
  leboncoin_postcode?: string;

  @ApiPropertyOptional({
    description: '[LeBonCoin] Filter for professional sellers only',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => transformBooleanParam(value))
  @IsBoolean()
  leboncoin_proSeller?: boolean;

  @ApiPropertyOptional({
    description: '[LeBonCoin] Filter for urgent listings',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => transformBooleanParam(value))
  @IsBoolean()
  leboncoin_urgentFlag?: boolean;

  // =============================================================================
  // Pagination
  // =============================================================================

  @ApiPropertyOptional({
    description: 'Number of results to skip (for pagination)',
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  from?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of results to return',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  size?: number = 20;
}
