import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, Site } from '@dealscrapper/database';
import { SiteResponseDto } from './dto/site.dto.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../config/logging.config.js';

/**
 * Sites Service
 *
 * Provides read operations for site data from the database.
 * Sites are synced from code definitions by SiteSyncService on startup.
 */
@Injectable()
export class SitesService {
  private readonly logger = createServiceLogger(apiLogConfig);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all active sites
   * @returns Array of active site DTOs
   */
  async findAll(): Promise<SiteResponseDto[]> {
    const sites = await this.prisma.site.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    this.logger.debug(`Found ${sites.length} active sites`);

    return sites.map((site) => this.mapToResponseDto(site));
  }

  /**
   * Find a specific site by ID
   * @param id - Site ID to find
   * @returns Site DTO
   * @throws NotFoundException if site not found or inactive
   */
  async findOne(id: string): Promise<SiteResponseDto> {
    const site = await this.prisma.site.findUnique({
      where: { id },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID '${id}' not found`);
    }

    if (!site.isActive) {
      throw new NotFoundException(`Site with ID '${id}' is not active`);
    }

    return this.mapToResponseDto(site);
  }

  /**
   * Find all sites (including inactive) - for admin purposes
   * @returns Array of all site DTOs
   */
  async findAllIncludingInactive(): Promise<SiteResponseDto[]> {
    const sites = await this.prisma.site.findMany({
      orderBy: { name: 'asc' },
    });

    return sites.map((site) => this.mapToResponseDto(site));
  }

  /**
   * Map database Site entity to response DTO
   */
  private mapToResponseDto(site: Site): SiteResponseDto {
    return {
      id: site.id,
      name: site.name,
      color: site.color,
      isActive: site.isActive,
      iconUrl: site.iconUrl ?? undefined,
    };
  }
}
