import { SiteSource } from './site-source.js';

/** A cross-site article suggested as the SAME product as a matched deal. */
export interface ProductSuggestion {
  articleId: string; // ES _id = Article CUID; lets the UI hydrate if needed
  source: SiteSource; // ES `source` keyword field
  title: string;
  currentPrice: number | null;
  url: string;
  scrapedAt: Date;
  score: number; // ES _score
}
