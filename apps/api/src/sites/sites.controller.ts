import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SitesService } from './sites.service.js';
import { SiteResponseDto, SitesListResponseDto } from './dto/site.dto.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { SiteSource, UserRole } from '@dealscrapper/shared-types';

/**
 * Sites Controller
 *
 * Provides endpoints for retrieving site information.
 * All endpoints are public (no authentication required).
 */
@ApiTags('sites')
@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  /**
   * Get all active sites
   * Returns site metadata needed for frontend display (colors, names)
   */
  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all active sites',
    description:
      'Returns all active sites with their metadata (id, name, color, iconUrl). Used by frontend for site selection and display.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active sites',
    type: SitesListResponseDto,
  })
  async findAll(): Promise<SitesListResponseDto> {
    const sites = await this.sitesService.findAll();
    return { sites };
  }

  /**
   * Get all sites including inactive (admin only)
   */
  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all sites including inactive (admin only)',
    description:
      'Returns all sites including inactive ones. Requires admin role.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all sites including inactive',
    type: SitesListResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin role required',
  })
  async findAllAdmin(): Promise<SitesListResponseDto> {
    const sites = await this.sitesService.findAllIncludingInactive();
    return { sites };
  }

  /**
   * Get a specific site by ID
   */
  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Get a specific site by ID',
    description: 'Returns a single site by its ID if active',
  })
  @ApiParam({
    name: 'id',
    description: 'Site ID (e.g., dealabs, vinted, leboncoin)',
    example: SiteSource.DEALABS,
  })
  @ApiResponse({
    status: 200,
    description: 'Site details',
    type: SiteResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Site not found or inactive',
  })
  async findOne(@Param('id') id: string): Promise<SiteResponseDto> {
    return this.sitesService.findOne(id);
  }
}
