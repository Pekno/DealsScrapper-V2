import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SiteSource } from '@dealscrapper/shared-types';

export class CategoryDto {
  @ApiProperty({
    description: 'Unique category identifier',
    example: 'cldx123abc',
  })
  id: string;

  @ApiProperty({
    description: 'URL-friendly category identifier',
    example: 'pc-gaming',
  })
  slug: string;

  @ApiProperty({
    description: 'Human-readable category name',
    example: 'PC Gaming',
  })
  name: string;

  @ApiProperty({
    description: 'Site ID for this category (dealabs, vinted, leboncoin)',
    example: SiteSource.DEALABS,
  })
  siteId: string;

  @ApiProperty({
    description: 'Original category page URL on the source site',
    example: 'https://www.dealabs.com/groupe/pc-gaming',
  })
  sourceUrl: string;

  @ApiPropertyOptional({
    description: 'Parent category ID for hierarchy',
    example: 'cldx456xyz',
  })
  parentId?: string;

  @ApiProperty({
    description: 'Category hierarchy level (1=main, 2=sub, 3=specific)',
    example: 2,
    minimum: 1,
    maximum: 3,
  })
  level: number;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Deals on PC gaming hardware, software, and accessories',
  })
  description?: string;

  @ApiProperty({
    description: 'Number of deals found in this category',
    example: 156,
  })
  dealCount: number;

  @ApiProperty({
    description: 'Average community temperature/heat score',
    example: 78.5,
  })
  avgTemperature: number;

  @ApiProperty({
    description: 'Popular brands in this category',
    example: ['NVIDIA', 'AMD', 'Corsair'],
    type: [String],
  })
  popularBrands: string[];

  @ApiProperty({
    description: 'Whether this category is active for scraping',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Number of users monitoring this category',
    example: 24,
  })
  userCount: number;


  @ApiPropertyOptional({
    description:
      'Full display path showing the category hierarchy (e.g., "Femmes → Vêtements → Shorts")',
    example: 'Femmes → Vêtements → Shorts',
  })
  displayPath?: string;

  @ApiPropertyOptional({
    description:
      'Whether this category can be selected by users. Level 0 (main tabs) are not selectable.',
    example: true,
  })
  isSelectable?: boolean;

  @ApiProperty({
    description: 'Category creation timestamp',
    example: '2025-01-15T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Category last update timestamp',
    example: '2025-01-15T14:22:30Z',
  })
  updatedAt: Date;

  // REMOVED: scheduledJobId - use /filters/{id}/scraping-status endpoint
  // REMOVED: nextScheduledAt - use /filters/{id}/scraping-status endpoint
  // REMOVED: jobActive - use /filters/{id}/scraping-status endpoint
}

export class CreateCategoryDto {
  @ApiProperty({
    description: 'URL-friendly category identifier',
    example: 'pc-gaming',
  })
  slug: string;

  @ApiProperty({
    description: 'Human-readable category name',
    example: 'PC Gaming',
  })
  name: string;

  @ApiProperty({
    description: 'Site ID for this category (dealabs, vinted, leboncoin)',
    example: SiteSource.DEALABS,
  })
  siteId: string;

  @ApiProperty({
    description: 'Original category page URL on the source site',
    example: 'https://www.dealabs.com/groupe/pc-gaming',
  })
  sourceUrl: string;

  @ApiPropertyOptional({
    description: 'Parent category ID for hierarchy',
    example: 'cldx456xyz',
  })
  parentId?: string;

  @ApiProperty({
    description: 'Category hierarchy level (1=main, 2=sub, 3=specific)',
    example: 2,
    minimum: 1,
    maximum: 3,
  })
  level: number;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Deals on PC gaming hardware, software, and accessories',
  })
  description?: string;
}
