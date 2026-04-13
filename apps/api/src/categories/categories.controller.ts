import { Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiAcceptedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CategoriesService } from './categories.service.js';
import { CategoryDto } from './dto/category.dto.js';
import {
  createSuccessResponse,
  type StandardApiResponse,
  SiteSource,
  UserRole,
} from '@dealscrapper/shared-types';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Get categories with optional search functionality
   * GET /categories?find=gaming
   */
  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get categories with optional search',
    description:
      'Retrieves active categories sorted by hierarchy level and name. Supports text search via the `find` parameter for searchable dropdowns. Categories are managed by scraping cron job. Requires authentication.',
  })
  @ApiQuery({
    name: 'find',
    required: false,
    type: String,
    description:
      'Search text to filter categories by name, slug, or description',
    example: 'gaming',
  })
  @ApiQuery({
    name: 'siteId',
    required: false,
    type: String,
    description:
      'Filter categories by site ID(s). Comma-separated for multiple sites.',
    example: 'dealabs,vinted',
  })
  @ApiOkResponse({
    description: 'Categories retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Categories retrieved successfully',
        },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/CategoryDto' },
        },
      },
    },
  })
  async findAll(
    @Query('find') find?: string,
    @Query('siteId') siteId?: string
  ): Promise<StandardApiResponse<CategoryDto[]>> {
    // Parse comma-separated site IDs into array
    const siteIds = siteId
      ? siteId.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const categories = await this.categoriesService.findAll(find, siteIds);
    return createSuccessResponse(
      categories,
      'Categories retrieved successfully'
    );
  }

  /**
   * Trigger category discovery refresh
   * POST /categories/refresh
   */
  @Post('refresh')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Trigger category discovery refresh',
    description:
      'Manually triggers the category discovery process to find new categories from deal sources. This calls the scheduler service to queue a discovery job. Requires admin role.',
  })
  @ApiAcceptedResponse({
    description: 'Category discovery job queued successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Category discovery job queued successfully',
        },
        data: {
          type: 'object',
          properties: {
            jobId: {
              type: 'string',
              description: 'Unique identifier for the queued discovery job',
            },
            message: {
              type: 'string',
              description: 'Human-readable message about the operation',
            },
            queuedAt: {
              type: 'string',
              description: 'ISO timestamp when the job was queued',
            },
            triggeredBy: {
              type: 'string',
              description: 'Source that triggered the discovery',
            },
          },
        },
      },
    },
  })
  async refreshCategories(
    @CurrentUser() user: { id: string }
  ): Promise<StandardApiResponse<{ jobId: string; message: string; queuedAt: string; triggeredBy: string }>> {
    const result = await this.categoriesService.triggerCategoryDiscovery(
      user.id
    );
    return createSuccessResponse(
      result,
      'Category discovery job queued successfully'
    );
  }

  /**
   * Get categories filtered by site
   * GET /categories/by-site?siteId=dealabs
   */
  @Get('by-site')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get categories filtered by site',
    description:
      'Retrieves active categories for a specific site (dealabs, vinted, leboncoin). Used by frontend to populate site-specific category selectors.',
  })
  @ApiQuery({
    name: 'siteId',
    required: true,
    type: String,
    enum: Object.values(SiteSource),
    description: 'Site ID to filter categories',
    example: SiteSource.DEALABS,
  })
  @ApiOkResponse({
    description: 'Categories retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Categories retrieved successfully',
        },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/CategoryDto' },
        },
      },
    },
  })
  async findBySite(
    @Query('siteId') siteId: string
  ): Promise<StandardApiResponse<CategoryDto[]>> {
    const categories = await this.categoriesService.findBySite(siteId);
    return createSuccessResponse(
      categories,
      `Categories for ${siteId} retrieved successfully`
    );
  }

  /**
   * Get category tree (hierarchical structure) by site
   * GET /categories/tree?siteId=leboncoin
   */
  @Get('tree')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get category tree (hierarchical structure) by site',
    description:
      'Retrieves categories in hierarchical format for sites with nested categories (e.g., LeBonCoin). Returns flat list for sites without hierarchy (e.g., Dealabs).',
  })
  @ApiQuery({
    name: 'siteId',
    required: true,
    type: String,
    enum: Object.values(SiteSource),
    description: 'Site ID to filter categories',
    example: SiteSource.LEBONCOIN,
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Include inactive categories in tree',
    example: false,
  })
  @ApiOkResponse({
    description: 'Category tree retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Category tree retrieved successfully',
        },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/CategoryDto' },
        },
      },
    },
  })
  async getCategoryTree(
    @Query('siteId') siteId: string,
    @Query('includeInactive') includeInactive?: boolean
  ): Promise<StandardApiResponse<CategoryDto[]>> {
    const categories = await this.categoriesService.getCategoryTree(
      siteId,
      includeInactive
    );
    return createSuccessResponse(
      categories,
      `Category tree for ${siteId} retrieved successfully`
    );
  }
}
