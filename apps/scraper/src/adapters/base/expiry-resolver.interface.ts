import type { Article } from '@dealscrapper/database';

export interface IExpiryResolver {
  /**
   * Returns the expiry date to record when an article is detected as missing
   * during presence comparison. Called once per missing article.
   */
  resolveExpiredAt(article: Article): Date;
}
