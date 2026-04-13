/**
 * @fileoverview Articles controller for Elasticsearch-powered article search
 *
 * **Endpoints**:
 * - GET /articles/search - Search articles with full-text and filtering
 * - GET /articles/:id - Get single article by ID
 *
 * **Features**:
 * - Full-text search across title and description
 * - Site filtering (Dealabs, Vinted, LeBonCoin)
 * - Price range filtering
 * - Category filtering
 * - Site-specific filters
 * - Pagination
 */

import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ArticlesService } from './articles.service.js';
import { SearchArticlesDto } from './dto/search-articles.dto.js';
import {
  ArticleResponseDto,
  ArticleListResponseDto,
} from './dto/article-response.dto.js';
import {
  createSuccessResponse,
  type StandardApiResponse,
} from '@dealscrapper/shared-types';

@ApiTags('Articles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({
  description: 'Unauthorized - Invalid or missing JWT token',
})
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  /**
   * Search articles with Elasticsearch
   * GET /articles/search
   */
  @Get('search')
  @ApiOperation({
    summary: 'Search articles',
    description:
      'Search articles across all indexed sites with full-text search, filtering, and site-specific criteria. Results are sorted by scraped date (newest first).',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    type: String,
    description: 'Full-text search query (searches in title and description)',
    example: 'gaming laptop',
  })
  @ApiQuery({
    name: 'sites',
    required: false,
    type: String,
    description: 'Comma-separated list of sites to filter by (dealabs, vinted, leboncoin)',
    example: 'dealabs,vinted',
  })
  @ApiQuery({
    name: 'priceMin',
    required: false,
    type: Number,
    description: 'Minimum price filter',
    example: 50,
  })
  @ApiQuery({
    name: 'priceMax',
    required: false,
    type: Number,
    description: 'Maximum price filter',
    example: 500,
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: String,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'dealabs_temperatureMin',
    required: false,
    type: Number,
    description: '[Dealabs] Minimum temperature (deal hotness)',
    example: 100,
  })
  @ApiQuery({
    name: 'dealabs_temperatureMax',
    required: false,
    type: Number,
    description: '[Dealabs] Maximum temperature',
    example: 500,
  })
  @ApiQuery({
    name: 'dealabs_communityVerified',
    required: false,
    type: Boolean,
    description: '[Dealabs] Filter for community verified deals',
  })
  @ApiQuery({
    name: 'dealabs_freeShipping',
    required: false,
    type: Boolean,
    description: '[Dealabs] Filter for free shipping deals',
  })
  @ApiQuery({
    name: 'vinted_favoriteCountMin',
    required: false,
    type: Number,
    description: '[Vinted] Minimum favorite count',
  })
  @ApiQuery({
    name: 'vinted_brand',
    required: false,
    type: String,
    description: '[Vinted] Filter by brand',
    example: 'Nike',
  })
  @ApiQuery({
    name: 'vinted_size',
    required: false,
    type: String,
    description: '[Vinted] Filter by size',
    example: 'M',
  })
  @ApiQuery({
    name: 'vinted_condition',
    required: false,
    type: String,
    description: '[Vinted] Filter by condition',
    example: 'new_with_tags',
  })
  @ApiQuery({
    name: 'leboncoin_city',
    required: false,
    type: String,
    description: '[LeBonCoin] Filter by city',
    example: 'Paris',
  })
  @ApiQuery({
    name: 'leboncoin_region',
    required: false,
    type: String,
    description: '[LeBonCoin] Filter by region',
    example: 'Ile-de-France',
  })
  @ApiQuery({
    name: 'leboncoin_postcode',
    required: false,
    type: String,
    description: '[LeBonCoin] Filter by postcode',
    example: '75001',
  })
  @ApiQuery({
    name: 'leboncoin_proSeller',
    required: false,
    type: Boolean,
    description: '[LeBonCoin] Filter for professional sellers',
  })
  @ApiQuery({
    name: 'leboncoin_urgentFlag',
    required: false,
    type: Boolean,
    description: '[LeBonCoin] Filter for urgent listings',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: Number,
    description: 'Number of results to skip (for pagination)',
    example: 0,
  })
  @ApiQuery({
    name: 'size',
    required: false,
    type: Number,
    description: 'Number of results to return (max 100)',
    example: 20,
  })
  @ApiOkResponse({
    description: 'Articles retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Articles retrieved successfully' },
        data: { $ref: '#/components/schemas/ArticleListResponseDto' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid search parameters',
  })
  async search(
    @Query() query: SearchArticlesDto,
  ): Promise<StandardApiResponse<ArticleListResponseDto>> {
    const result = await this.articlesService.search(query);
    return createSuccessResponse(result, 'Articles retrieved successfully');
  }

  /**
   * Get a single article by ID
   * GET /articles/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get article by ID',
    description:
      'Retrieves a single article by its internal ID with full base and extension data.',
  })
  @ApiParam({
    name: 'id',
    description: 'Article ID (internal CUID)',
    example: 'clx1234567890',
  })
  @ApiOkResponse({
    description: 'Article retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Article retrieved successfully' },
        data: { $ref: '#/components/schemas/ArticleResponseDto' },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Article not found',
  })
  async getById(
    @Param('id') id: string,
  ): Promise<StandardApiResponse<ArticleResponseDto>> {
    const article = await this.articlesService.getById(id);
    return createSuccessResponse(article, 'Article retrieved successfully');
  }
}
