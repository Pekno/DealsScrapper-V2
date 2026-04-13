import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@dealscrapper/database';
import type { Match, Filter, Article } from '@dealscrapper/database';
import { AbstractBaseRepository } from '@dealscrapper/shared-repository';
import type {
  PaginationOptions,
  PaginatedResult,
} from '@dealscrapper/shared-repository';

/**
 * Data structure for creating new matches with deal external ID
 */
export interface MatchCreateData {
  readonly filterId: string;
  readonly articleId: string;
  readonly score: number;
  readonly notified: boolean;
}

/**
 * Enhanced data structure for creating matches by external ID (for new architecture)
 */
export interface MatchCreateByExternalIdData {
  readonly filterId: string;
  readonly dealExternalId: string;
  readonly score: number;
  readonly notified: boolean;
}

/**
 * Enhanced Match type with relations for notifications
 */
export type MatchWithRelations = Match & {
  readonly filter: Filter;
  readonly article: Article;
};

/**
 * Repository interface for Match entity operations
 * Defines all match-related database operations used across the application
 */
export interface IMatchRepository {
  /**
   * Create a single match
   * @param data - Match creation data
   * @returns Created match
   */
  createMatch(data: MatchCreateData): Promise<Match>;

  /**
   * Create multiple matches efficiently with duplicate handling
   * @param matchesData - Array of match creation data
   * @returns Array of successfully created matches
   */
  createManyMatches(matchesData: MatchCreateData[]): Promise<Match[]>;

  /**
   * Find match with related filter and article data
   * @param matchId - Match ID
   * @returns Match with relations or null if not found
   */
  findWithRelations(matchId: string): Promise<MatchWithRelations | null>;

  /**
   * Find all matches for a specific filter
   * @param filterId - Filter ID
   * @returns Array of matches for the filter
   */
  findByFilterId(filterId: string): Promise<Match[]>;

  /**
   * Find all matches for a specific article
   * @param articleId - Article ID
   * @returns Array of matches for the article
   */
  findByArticleId(articleId: string): Promise<Match[]>;

  /**
   * Check if a match already exists for filter and article combination
   * @param filterId - Filter ID
   * @param articleId - Article ID
   * @returns True if match exists, false otherwise
   */
  existsForFilterAndArticle(
    filterId: string,
    articleId: string
  ): Promise<boolean>;

  /**
   * Find unnotified matches ready for notification processing
   * @param limit - Maximum number of matches to return
   * @returns Array of unnotified matches with relations
   */
  findUnnotified(limit?: number): Promise<MatchWithRelations[]>;

  /**
   * Find existing matches for specific deal external IDs and filter IDs combination
   * Used for efficient deduplication in new architecture
   * @param dealExternalId - External ID of the deal
   * @param filterIds - Array of filter IDs to check
   * @returns Array of existing matches
   */
  findExistingMatchesByExternalId(
    dealExternalId: string,
    filterIds: string[]
  ): Promise<Match[]>;

  /**
   * Create matches for a deal using external ID with automatic article linking
   * Handles the case where article may or may not exist in PostgreSQL
   * @param matchesData - Array of match creation data with external IDs
   * @returns Array of successfully created matches
   */
  createMatchesByExternalId(
    matchesData: MatchCreateByExternalIdData[]
  ): Promise<Match[]>;

  /**
   * Mark matches as notified
   * @param matchIds - Array of match IDs to mark as notified
   * @returns Number of matches updated
   */
  markAsNotified(matchIds: string[]): Promise<number>;

  /**
   * Get match statistics for monitoring
   * @returns Match statistics summary
   */
  getStatistics(): Promise<{
    total: number;
    notified: number;
    pending: number;
    avgScore: number;
  }>;

  /**
   * Delete old matches to prevent database growth
   * @param days - Number of days to keep
   * @returns Number of deleted matches
   */
  deleteOlderThan(days: number): Promise<number>;

  /**
   * Find recent matches for a specific time period
   * @param hours - Number of hours to look back
   * @returns Array of recent matches
   */
  findRecent(hours: number): Promise<MatchWithRelations[]>;
}

/**
 * Repository implementation for Match entity operations
 * Centralizes all match-related database access patterns used across services
 */
@Injectable()
export class MatchRepository
  extends AbstractBaseRepository<
    Match,
    Prisma.MatchCreateInput,
    Prisma.MatchUpdateInput,
    Prisma.MatchWhereInput
  >
  implements IMatchRepository
{
  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Implementation of abstract method - returns the Prisma model delegate
   */
  protected getModel() {
    return this.prisma.match;
  }

  /**
   * Required fields for match creation
   */
  protected getRequiredCreateFields(): string[] {
    return ['score'];
  }

  /**
   * Create a single match
   * Used by: FilterMatchingService
   */
  async createMatch(data: MatchCreateData): Promise<Match> {
    try {
      return await this.prisma.match.create({
        data: {
          filter: { connect: { id: data.filterId } },
          article: { connect: { id: data.articleId } },
          score: data.score,
          notified: data.notified,
        },
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Create match for filter ${data.filterId} and article ${data.articleId}`
      );
    }
  }

  /**
   * Create multiple matches efficiently with duplicate handling
   * Used by: FilterMatchingService for batch match creation
   */
  async createManyMatches(matchesData: MatchCreateData[]): Promise<Match[]> {
    const createdMatches: Match[] = [];

    // Process matches individually using Promise.allSettled to handle
    // unique constraint violations gracefully without aborting the batch
    const results = await Promise.allSettled(
      matchesData.map(async (matchData) => {
        return this.prisma.match.create({
          data: {
            filter: { connect: { id: matchData.filterId } },
            article: { connect: { id: matchData.articleId } },
            score: matchData.score,
            notified: matchData.notified,
          },
        });
      })
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        createdMatches.push(result.value);
      } else {
        const error = result.reason;
        // Check if it's a unique constraint violation (duplicate match) - skip silently
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          this.logger.debug(
            `Duplicate match for filter ${matchesData[i].filterId} and article ${matchesData[i].articleId}, skipping`
          );
          continue;
        }
        // Non-duplicate errors are real failures
        this.handleDatabaseError(
          error,
          `Create many matches (${matchesData.length} items)`
        );
      }
    }

    return createdMatches;
  }

  /**
   * Find match with related filter and article data
   * Used by: FilterMatchingService for notification processing
   */
  async findWithRelations(matchId: string): Promise<MatchWithRelations | null> {
    try {
      return await this.prisma.match.findUnique({
        where: { id: matchId },
        include: {
          filter: true,
          article: true,
        },
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Find match with relations for ID ${matchId}`
      );
    }
  }

  /**
   * Find all matches for a specific filter
   */
  async findByFilterId(filterId: string): Promise<Match[]> {
    try {
      return await this.prisma.match.findMany({
        where: { filterId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.handleDatabaseError(error, `Find matches for filter ${filterId}`);
    }
  }

  /**
   * Find all matches for a specific article
   */
  async findByArticleId(articleId: string): Promise<Match[]> {
    try {
      return await this.prisma.match.findMany({
        where: { articleId },
        orderBy: { score: 'desc' },
      });
    } catch (error) {
      this.handleDatabaseError(error, `Find matches for article ${articleId}`);
    }
  }

  /**
   * Check if a match already exists for filter and article combination
   * Used by: FilterMatchingService for duplicate prevention
   */
  async existsForFilterAndArticle(
    filterId: string,
    articleId: string
  ): Promise<boolean> {
    try {
      const count = await this.prisma.match.count({
        where: {
          filterId,
          articleId,
        },
      });
      return count > 0;
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Check match existence for filter ${filterId} and article ${articleId}`
      );
    }
  }

  /**
   * Find unnotified matches ready for notification processing
   * Used by: NotificationService
   */
  async findUnnotified(limit = 100): Promise<MatchWithRelations[]> {
    try {
      return await this.prisma.match.findMany({
        where: { notified: false },
        include: {
          filter: true,
          article: true,
        },
        orderBy: { createdAt: 'asc' }, // Process oldest first
        take: limit,
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Find unnotified matches (limit: ${limit})`
      );
    }
  }

  /**
   * Mark matches as notified
   * Used by: NotificationService after successful notification
   */
  async markAsNotified(matchIds: string[]): Promise<number> {
    try {
      const result = await this.prisma.match.updateMany({
        where: {
          id: { in: matchIds },
        },
        data: {
          notified: true,
          notifiedAt: new Date(),
        },
      });

      return result.count;
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Mark ${matchIds.length} matches as notified`
      );
    }
  }

  /**
   * Get match statistics for monitoring
   */
  async getStatistics(): Promise<{
    total: number;
    notified: number;
    pending: number;
    avgScore: number;
  }> {
    try {
      const [total, notified, aggregate] = await Promise.all([
        this.prisma.match.count(),
        this.prisma.match.count({ where: { notified: true } }),
        this.prisma.match.aggregate({
          _avg: { score: true },
        }),
      ]);

      return {
        total,
        notified,
        pending: total - notified,
        avgScore: aggregate._avg.score || 0,
      };
    } catch (error) {
      this.handleDatabaseError(error, 'Get match statistics');
    }
  }

  /**
   * Delete old matches to prevent database growth
   */
  async deleteOlderThan(days: number): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await this.prisma.match.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      return result.count;
    } catch (error) {
      this.handleDatabaseError(error, `Delete matches older than ${days} days`);
    }
  }

  /**
   * Find recent matches for a specific time period
   */
  async findRecent(hours: number): Promise<MatchWithRelations[]> {
    try {
      const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      return await this.prisma.match.findMany({
        where: {
          createdAt: {
            gte: cutoffDate,
          },
        },
        include: {
          filter: true,
          article: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Find recent matches within ${hours} hours`
      );
    }
  }

  /**
   * Find existing matches for specific deal external IDs and filter IDs combination
   * Used for efficient deduplication in new architecture
   * @param dealExternalId - External ID of the deal
   * @param filterIds - Array of filter IDs to check
   * @returns Array of existing matches
   */
  async findExistingMatchesByExternalId(
    dealExternalId: string,
    filterIds: string[]
  ): Promise<Match[]> {
    try {
      if (filterIds.length === 0) {
        return [];
      }

      return await this.prisma.match.findMany({
        where: {
          filterId: { in: filterIds },
          article: {
            externalId: dealExternalId,
          },
        },
        include: {
          article: true,
        },
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Find existing matches for deal ${dealExternalId} with ${filterIds.length} filters`
      );
    }
  }

  /**
   * Create matches for a deal using external ID with automatic article linking
   * Handles the case where article may or may not exist in PostgreSQL
   * @param matchesData - Array of match creation data with external IDs
   * @returns Array of successfully created matches
   */
  async createMatchesByExternalId(
    matchesData: MatchCreateByExternalIdData[]
  ): Promise<Match[]> {
    if (matchesData.length === 0) {
      return [];
    }

    const createdMatches: Match[] = [];

    try {
      // Group matches by external ID for efficient processing
      const matchesByExternalId = this.groupMatchesByExternalId(matchesData);

      // Process each external ID group
      for (const [externalId, matches] of Object.entries(matchesByExternalId)) {
        const articleMatches = await this.createMatchesForExternalId(
          externalId,
          matches
        );
        createdMatches.push(...articleMatches);
      }

      return createdMatches;
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Create matches by external ID (${matchesData.length} items)`
      );
    }
  }

  // =====================================
  // Private Helper Methods for Enhanced Architecture
  // =====================================

  /**
   * Group match creation data by external ID for efficient processing
   * @param matchesData - Array of match creation data
   * @returns Object mapping external IDs to their match data arrays
   */
  private groupMatchesByExternalId(
    matchesData: MatchCreateByExternalIdData[]
  ): Record<string, MatchCreateByExternalIdData[]> {
    return matchesData.reduce(
      (groups, match) => {
        const { dealExternalId } = match;
        if (!groups[dealExternalId]) {
          groups[dealExternalId] = [];
        }
        groups[dealExternalId].push(match);
        return groups;
      },
      {} as Record<string, MatchCreateByExternalIdData[]>
    );
  }

  /**
   * Create matches for a specific external ID with automatic article lookup/creation
   * @param externalId - Deal external ID
   * @param matches - Match data for this external ID
   * @returns Array of created matches
   */
  private async createMatchesForExternalId(
    externalId: string,
    matches: MatchCreateByExternalIdData[]
  ): Promise<Match[]> {
    try {
      // Find existing article by external ID (using findFirst since we don't have source)
      // Note: Article has compound unique [source, externalId]
      const existingArticle = await this.prisma.article.findFirst({
        where: { externalId },
      });

      if (!existingArticle) {
        // Article doesn't exist in PostgreSQL yet - skip match creation
        // This is expected in the new architecture where deals might not be persisted to PostgreSQL
        return [];
      }

      // Create matches using existing article ID
      const matchCreateData: MatchCreateData[] = matches.map((match) => ({
        filterId: match.filterId,
        articleId: existingArticle.id,
        score: match.score,
        notified: match.notified,
      }));

      return await this.createManyMatches(matchCreateData);
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Create matches for external ID ${externalId}`
      );
    }
  }
}
