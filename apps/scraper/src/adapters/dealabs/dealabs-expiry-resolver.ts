import { Injectable } from '@nestjs/common';
import type { Article } from '@dealscrapper/database';
import type { IExpiryResolver } from '../base/expiry-resolver.interface.js';

@Injectable()
export class DealabsExpiryResolver implements IExpiryResolver {
  /**
   * Uses the site-provided expiry date if already stored on the Dealabs extension,
   * otherwise falls back to the current time.
   */
  resolveExpiredAt(article: Article & { dealabs?: { expiresAt: Date | null } | null }): Date {
    return article.dealabs?.expiresAt ?? new Date();
  }
}
