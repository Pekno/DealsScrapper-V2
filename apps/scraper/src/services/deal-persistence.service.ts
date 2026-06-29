import { Injectable } from '@nestjs/common';
import type { ISiteAdapter } from '../adapters/base/site-adapter.interface.js';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { ArticleRepository } from '../repositories/article.repository.js';
import { CategoryRepository } from '../repositories/category.repository.js';
import { scraperLogConfig } from '../config/logging.config.js';

/**
 * Service responsible for presence-based deal expiry detection.
 *
 * Marks articles as expired when they stop appearing on the scraped page
 * via markHiddenExpiredDeals().
 */
@Injectable()
export class DealPersistenceService {
  private readonly logger = createServiceLogger(scraperLogConfig);

  constructor(
    private readonly articleRepository: ArticleRepository,
    private readonly categoryRepository: CategoryRepository,
  ) {}

  /**
   * Mark articles as expired when they're no longer appearing on the scraped page
   * This handles the case where Dealabs hides expired listings instead of marking them
   *
   * @param categorySlug - Category slug being scraped
   * @param extractedExternalIds - External IDs found on the current page
   * @returns Number of articles marked as expired
   */
  async markHiddenExpiredDeals(
    categorySlug: string,
    extractedExternalIds: Set<string>,
    adapter: ISiteAdapter,
  ): Promise<number> {
    try {
      this.logger.log(
        `🔍 Checking for hidden expired deals in category: ${categorySlug}`
      );

      // Get category ID from slug for database lookup
      const categoryId =
        await this.categoryRepository.findCategoryIdBySlug(categorySlug);

      if (!categoryId) {
        this.logger.warn(
          `📂 Category slug "${categorySlug}" not found in database - no articles to check`
        );
        return 0;
      }

      this.logger.log(
        `📂 Category slug "${categorySlug}" resolved to categoryId: ${categoryId}`
      );

      // Find ALL active articles in this category (no age filter)
      const activeArticles = await this.articleRepository.findMany({
        categoryId: categoryId,
        isActive: true,
      });

      this.logger.log(
        `📋 Found ${activeArticles.length} active articles in categoryId: ${categoryId}`
      );

      if (activeArticles.length === 0) {
        this.logger.log(
          `📭 No active articles found for categoryId: ${categoryId}`
        );
        return 0;
      }

      // Log all extracted external IDs for debugging
      const extractedIds = Array.from(extractedExternalIds);
      this.logger.log(
        `🌐 External IDs found on current page (${extractedIds.length}): ${extractedIds.join(', ')}`
      );

      // Log all existing article external IDs for comparison
      const existingIds = activeArticles.map((article) => article.externalId);
      this.logger.log(
        `💾 External IDs in database (${existingIds.length}): ${existingIds.join(', ')}`
      );

      // Find articles that are no longer on the page (hidden by Dealabs)
      const hiddenArticles = activeArticles.filter(
        (article) => !extractedExternalIds.has(article.externalId)
      );

      // Log detailed comparison
      if (hiddenArticles.length > 0) {
        const hiddenIds = hiddenArticles.map((article) => article.externalId);
        this.logger.log(
          `🕰️ MISSING from page (potential expired): ${hiddenIds.join(', ')}`
        );

        // Log individual article details for debugging
        hiddenArticles.forEach((article) => {
          const titlePreview = article.title
            ? article.title.substring(0, 50)
            : 'No title';
          this.logger.log(
            `   📄 Missing Article: ID=${article.externalId}, title="${titlePreview}...", scraped=${article.scrapedAt?.toISOString()}`
          );
        });
      } else {
        this.logger.log(
          `✅ All ${activeArticles.length} active articles still visible on page for categoryId: ${categoryId}`
        );

        // Log which articles are still visible for confirmation
        const visibleIds = activeArticles
          .filter((article) => extractedExternalIds.has(article.externalId))
          .map((article) => article.externalId);
        if (visibleIds.length > 0) {
          this.logger.log(`👀 Still visible: ${visibleIds.join(', ')}`);
        }

        return 0;
      }

      // Mark hidden articles as expired
      const hiddenExternalIds = hiddenArticles.map(
        (article) => article.externalId
      );
      this.logger.log(
        `🔄 Marking ${hiddenExternalIds.length} articles as expired: ${hiddenExternalIds.join(', ')}`
      );

      let updateCount: number;

      if (adapter.expiryResolver) {
        // Resolve per-article expiry dates and update individually
        const updates = hiddenArticles.map((article) => {
          const expiresAt = adapter.expiryResolver!.resolveExpiredAt(article);
          return this.articleRepository.updateMany(
            { externalId: article.externalId },
            { isActive: false, isExpired: true, expiresAt },
          );
        });
        const counts = await Promise.all(updates);
        updateCount = counts.reduce((sum, n) => sum + n, 0);
      } else {
        updateCount = await this.articleRepository.updateMany(
          { externalId: { in: hiddenExternalIds } },
          { isActive: false, isExpired: true, expiresAt: new Date() },
        );
      }

      this.logger.log(
        `🕰️ Successfully marked ${updateCount} hidden deals as expired in categoryId ${categoryId} ` +
          `(${extractedExternalIds.size} visible on page, ${activeArticles.length} active total)`
      );

      // Log summary for easy tracking
      this.logger.log(
        `📊 SUMMARY - Category: ${categorySlug} | Found on page: ${extractedIds.length} | In DB: ${existingIds.length} | Expired: ${updateCount}`
      );

      return updateCount;
    } catch (error) {
      this.logger.error(
        `❌ Failed to mark hidden expired deals for category ${categorySlug}:`,
        error
      );
      return 0;
    }
  }
}
