import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SiteSource } from '@dealscrapper/shared-types';

/**
 * Response DTO for site data
 */
export class SiteResponseDto {
  @ApiProperty({
    description: 'Unique site identifier',
    example: SiteSource.DEALABS,
  })
  id: string;

  @ApiProperty({
    description: 'Display name for the site',
    example: 'Dealabs',
  })
  name: string;

  @ApiProperty({
    description: 'Brand color in hex format',
    example: '#FF6B00',
  })
  color: string;

  @ApiProperty({
    description: 'Whether the site is currently active',
    example: true,
  })
  isActive: boolean;

  @ApiPropertyOptional({
    description: 'Icon URL for the site',
    example: 'https://example.com/icons/dealabs.png',
  })
  iconUrl?: string;
}

/**
 * Response DTO for sites list endpoint
 */
export class SitesListResponseDto {
  @ApiProperty({
    description: 'List of active sites',
    type: [SiteResponseDto],
  })
  sites: SiteResponseDto[];
}
