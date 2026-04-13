import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { FiltersService, type ScrapingStatusResponse } from './filters.service.js';
import { CreateFilterDto } from './dto/create-filter.dto.js';
import { UpdateFilterDto } from './dto/update-filter.dto.js';
import { FilterQueryDto } from './dto/filter-query.dto.js';
import {
  FilterResponseDto,
  FilterListResponseDto,
  MatchListResponseDto,
  FilterStatsDto,
} from './dto/filter-response.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import {
  createSuccessResponse,
  type StandardApiResponse,
  type AuthenticatedRequest,
} from '@dealscrapper/shared-types';
@ApiTags('Filters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({
  description: 'Unauthorized - Invalid or missing JWT token',
})
@Controller('filters')
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}

  /**
   * Create a new filter
   * POST /filters
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new filter',
    description:
      'Creates a new deal monitoring filter with smart filtering capabilities including price range, keywords, categories, and notification settings.',
  })
  @ApiBody({ type: CreateFilterDto })
  @ApiCreatedResponse({
    description: 'Filter created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Filter created successfully' },
        data: { $ref: '#/components/schemas/FilterResponseDto' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid filter configuration' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() createFilterDto: CreateFilterDto
  ): Promise<StandardApiResponse<FilterResponseDto>> {
    const filter = await this.filtersService.create(
      req.user.id,
      createFilterDto
    );
    return createSuccessResponse(filter, 'Filter created successfully');
  }

  /**
   * Get all filters for the authenticated user
   * GET /filters
   */
  @Get()
  @ApiOperation({
    summary: 'Get all user filters',
    description:
      'Retrieves all filters belonging to the authenticated user with pagination, search, and filtering options.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'active',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Filter by category',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in name and description',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Sort field (default: createdAt)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order (default: desc)',
  })
  @ApiOkResponse({
    description: 'Filters retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Filters retrieved successfully' },
        data: { $ref: '#/components/schemas/FilterListResponseDto' },
      },
    },
  })
  async findAll(
    @Request() req: AuthenticatedRequest,
    @Query() query: FilterQueryDto
  ): Promise<StandardApiResponse<FilterListResponseDto>> {
    const filters = await this.filtersService.findAll(req.user.id, query);
    return createSuccessResponse(filters, 'Filters retrieved successfully');
  }

  /**
   * Get the total count of filters for the authenticated user
   * GET /filters/count
   */
  @Get('count')
  @ApiOperation({
    summary: 'Get user filter count',
    description:
      'Retrieves the total number of filters belonging to the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Filter count retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: { type: 'number', example: 6 },
        message: {
          type: 'string',
          example: 'Filter count retrieved successfully',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Bad request - invalid parameters',
  })
  async getFiltersCount(
    @Request() req: AuthenticatedRequest
  ): Promise<StandardApiResponse<number>> {
    const count = await this.filtersService.getFiltersCount(req.user.id);
    return createSuccessResponse(count, 'Filter count retrieved successfully');
  }

  /**
   * Get a specific filter by ID
   * GET /filters/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get filter by ID',
    description:
      'Retrieves a specific filter by its ID with categories, statistics and match information. For scraping job status and timing, use the /filters/:id/scraping-status endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Filter ID' })
  @ApiOkResponse({
    description: 'Filter retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Filter retrieved successfully' },
        data: { $ref: '#/components/schemas/FilterResponseDto' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Filter not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - filter belongs to another user',
  })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<StandardApiResponse<FilterResponseDto>> {
    const filter = await this.filtersService.findOne(req.user.id, id);
    return createSuccessResponse(filter, 'Filter retrieved successfully');
  }

  /**
   * Update a filter
   * PATCH /filters/:id
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update filter',
    description:
      'Updates an existing filter configuration. Triggers category monitoring recalculation if categories change.',
  })
  @ApiParam({ name: 'id', description: 'Filter ID' })
  @ApiBody({ type: UpdateFilterDto })
  @ApiOkResponse({
    description: 'Filter updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Filter updated successfully' },
        data: { $ref: '#/components/schemas/FilterResponseDto' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid filter configuration' })
  @ApiNotFoundResponse({ description: 'Filter not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - filter belongs to another user',
  })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() updateFilterDto: UpdateFilterDto
  ): Promise<StandardApiResponse<FilterResponseDto>> {
    const updatedFilter = await this.filtersService.update(
      req.user.id,
      id,
      updateFilterDto
    );
    return createSuccessResponse(updatedFilter, 'Filter updated successfully');
  }

  /**
   * Delete a filter
   * DELETE /filters/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete filter',
    description:
      'Permanently deletes a filter and all its matches. Triggers category monitoring cleanup for unused categories.',
  })
  @ApiParam({ name: 'id', description: 'Filter ID' })
  @ApiOkResponse({
    description: 'Filter deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Filter deleted successfully' },
        data: { type: 'null' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Filter not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - filter belongs to another user',
  })
  async remove(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<StandardApiResponse<null>> {
    await this.filtersService.remove(req.user.id, id);
    return createSuccessResponse(null, 'Filter deleted successfully');
  }

  /**
   * Toggle filter active/inactive status
   * POST /filters/:id/toggle
   */
  @Post(':id/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle filter status',
    description:
      'Toggles filter between active and inactive state. Inactive filters stop generating new matches and notifications.',
  })
  @ApiParam({ name: 'id', description: 'Filter ID' })
  @ApiOkResponse({
    description: 'Filter status toggled successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Filter status toggled successfully',
        },
        data: { $ref: '#/components/schemas/FilterResponseDto' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Filter not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - filter belongs to another user',
  })
  async toggleActive(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<StandardApiResponse<FilterResponseDto>> {
    const toggledFilter = await this.filtersService.toggleActive(
      req.user.id,
      id
    );
    return createSuccessResponse(
      toggledFilter,
      'Filter status toggled successfully'
    );
  }

  /**
   * Get matches for a specific filter
   * GET /filters/:id/matches
   */
  @Get(':id/matches')
  @ApiOperation({
    summary: 'Get filter matches',
    description:
      'Retrieves all deals that matched this filter, sorted by score and creation date. Includes deal details and scoring breakdown.',
  })
  @ApiParam({ name: 'id', description: 'Filter ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in article titles and descriptions',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description:
      'Sort field (title, currentPrice, publishedAt, scrapedAt, score, createdAt). Note: site-specific fields like temperature are not supported.',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort order (default: desc)',
  })
  @ApiOkResponse({
    description: 'Matches retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Matches retrieved successfully' },
        data: { $ref: '#/components/schemas/MatchListResponseDto' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Filter not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - filter belongs to another user',
  })
  async getMatches(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc'
  ): Promise<StandardApiResponse<MatchListResponseDto>> {
    const matches = await this.filtersService.getMatches(
      req.user.id,
      id,
      parseInt(page, 10),
      parseInt(limit, 10),
      search,
      sortBy,
      sortOrder
    );
    return createSuccessResponse(matches, 'Matches retrieved successfully');
  }

  /**
   * Get filter statistics
   * GET /filters/:id/stats
   */
  @Get(':id/stats')
  @ApiOperation({
    summary: 'Get filter statistics',
    description:
      'Retrieves detailed statistics for a filter including match counts, average scores, and performance metrics.',
  })
  @ApiParam({ name: 'id', description: 'Filter ID' })
  @ApiOkResponse({
    description: 'Filter statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Filter statistics retrieved successfully',
        },
        data: {
          type: 'object',
          properties: {
            totalMatches: {
              type: 'number',
              description: 'Total number of matches',
            },
            matchesLast24h: {
              type: 'number',
              description: 'Matches in last 24 hours',
            },
            matchesLast7d: {
              type: 'number',
              description: 'Matches in last 7 days',
            },
            avgScore: { type: 'number', description: 'Average match score' },
            topScore: { type: 'number', description: 'Highest match score' },
            lastMatchAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last match timestamp',
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Filter not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - filter belongs to another user',
  })
  async getStats(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<StandardApiResponse<FilterStatsDto>> {
    const stats = await this.filtersService.getFilterStats(req.user.id, id);
    return createSuccessResponse(
      stats,
      'Filter statistics retrieved successfully'
    );
  }

  // NOTE: testFilter endpoint removed - was a stub returning fake data.
  // To implement filter testing, use the FilterMatcherService with sample articles.

  /**
   * Get scraping job status summary for filter's categories
   * GET /filters/:id/scraping-status
   */
  @Get(':id/scraping-status')
  @ApiOperation({
    summary: 'Get scraping job status for filter',
    description:
      'Retrieves scraping job status for all categories associated with this filter, including execution status and timing.',
  })
  @ApiParam({ name: 'id', description: 'Filter ID' })
  @ApiOkResponse({
    description: 'Scraping status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Scraping status retrieved successfully',
        },
        data: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  categoryId: { type: 'string', example: 'cat-123' },
                  categoryName: { type: 'string', example: 'gaming' },
                  scheduledJob: {
                    type: 'object',
                    properties: {
                      id: { type: 'string', example: 'job-456' },
                      nextScheduledAt: { type: 'string', format: 'date-time' },
                      isActive: { type: 'boolean' },
                    },
                  },
                  latestExecution: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: { type: 'string', example: 'scraping-789' },
                      status: { type: 'string', example: 'completed' },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                      executionTimeMs: { type: 'number', example: 33000 },
                      dealsFound: { type: 'number', example: 42 },
                      dealsProcessed: { type: 'number', example: 40 },
                    },
                  },
                },
              },
            },
            nextScrapingAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Filter not found' })
  @ApiForbiddenResponse({
    description: 'Access denied - filter belongs to another user',
  })
  async getScrapingStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<StandardApiResponse<ScrapingStatusResponse>> {
    const status = await this.filtersService.getScrapingStatus(req.user.id, id);
    return createSuccessResponse(
      status,
      'Scraping status retrieved successfully'
    );
  }
}
