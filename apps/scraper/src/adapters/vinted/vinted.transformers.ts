import type { TransformFunction } from '../../field-extraction/field-mapping-config.interface.js';

/**
 * Vinted-specific transform functions.
 * These handle Vinted-specific patterns (item IDs, prices, sizes, conditions, etc.)
 */
export class VintedTransformers {
  /**
   * Extracts Vinted item ID from data-testid or URL.
   * Examples:
   * - "item-7683082902" → "7683082902"
   * - "item-7683082902--overlay-link" → "7683082902"
   * - "/items/7683082902-cap" → "7683082902"
   * - "7683082902" → "7683082902"
   */
  static extractItemId: TransformFunction = (value: unknown): string => {
    if (typeof value !== 'string') return '';

    // From data-testid: "item-7683082902" or "item-7683082902--overlay-link"
    const testIdMatch = value.match(/^item-(\d+)/);
    if (testIdMatch) return testIdMatch[1];

    // From URL: "/items/7683082902-slug"
    const urlMatch = value.match(/\/items\/(\d+)/);
    if (urlMatch) return urlMatch[1];

    // Just the ID itself
    const numericMatch = value.match(/\d+/);
    return numericMatch ? numericMatch[0] : '';
  };

  /**
   * Extracts the listing title from the image alt text.
   * Alt format: "Title, marque: Brand, état: Condition, price, ..."
   * Examples:
   * - "Lanterna bianca con luce., marque: M-Made in Italy, état: ..." → "Lanterna bianca con luce."
   * - "Robe fleurie, marque: Zara, état: Bon état, 15,00 €, ..." → "Robe fleurie"
   */
  static extractTitleFromAlt: TransformFunction = (value: unknown): string => {
    if (typeof value !== 'string' || !value.trim()) return '';

    // Extract everything before ", marque:" or ", état:"
    const match = value.match(/^(.+?)(?:,\s*marque:|,\s*état:)/);
    if (match) return match[1].trim();

    // No alt-text pattern found — value is likely plain text from fallback selector
    return value.trim();
  };

  /**
   * Normalizes Vinted URLs (handles relative URLs).
   * Examples:
   * - "/items/123-title" → "https://www.vinted.fr/items/123-title"
   * - "https://www.vinted.fr/..." → "https://www.vinted.fr/..."
   */
  static normalizeUrl: TransformFunction = (
    value: unknown,
    context,
  ): string => {
    if (typeof value !== 'string') return '';

    const url = value.trim();

    // Already absolute URL
    if (url.startsWith('http')) {
      return url;
    }

    // Relative URL
    if (url.startsWith('/')) {
      return `${context.siteBaseUrl}${url}`;
    }

    return url;
  };

  /**
   * Parses Vinted price (handles comma separator).
   * Examples:
   * - "30,00 €" → 30.00
   * - "2,50 €" → 2.50
   * - "100 €" → 100.00
   */
  static parsePrice: TransformFunction = (value: unknown): number | null => {
    if (typeof value !== 'string') return null;

    // Remove non-numeric characters except comma and dot
    const cleaned = value.replace(/[^\d,.]/g, '');

    // Replace comma with dot (French format: "30,00" → "30.00")
    const normalized = cleaned.replace(',', '.');

    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  };

  /**
   * Extracts brand name from subtitle field.
   * Subtitle format: "{BRAND}{SIZE} · {CONDITION}"
   * Examples:
   * - "Wendy TrendyL / 40 / 12 · Très bon état" → "Wendy Trendy"
   * - "HalaraM / 38 / 10 · Neuf" → "Halara"
   */
  static extractBrand: TransformFunction = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;

    const text = value.trim();

    // Split by size pattern (letter followed by / or space/)
    // Brand is everything before the first size indicator
    const match = text.match(/^([A-Z][^·/]*?)(?:[A-Z]\s*\/|\s*\/)/);
    if (match) return match[1].trim();

    // Fallback: text before first slash
    const beforeSlash = text.split('/')[0].trim();
    if (beforeSlash && !beforeSlash.includes('·')) {
      return beforeSlash;
    }

    return null;
  };

  /**
   * Extracts size from subtitle field.
   * Examples:
   * - "Wendy TrendyL / 40 / 12 · Très bon état" → "L / 40 / 12"
   * - "HalaraM / 38 / 10 · Neuf" → "M / 38 / 10"
   * - "Shein36 · Satisfaisant" → "36"
   */
  static extractSize: TransformFunction = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;

    const text = value.trim();

    // Match multi-part size: "L / 40 / 12" (clothing / EU / US)
    const multiSizeMatch = text.match(/([A-Z]+(?:\+)?)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
    if (multiSizeMatch) {
      return `${multiSizeMatch[1]} / ${multiSizeMatch[2]} / ${multiSizeMatch[3]}`;
    }

    // Match single numeric size: "36", "42", etc.
    const singleSizeMatch = text.match(/(\d{2,3})(?:\s*·|$)/);
    if (singleSizeMatch) {
      return singleSizeMatch[1];
    }

    // Match single letter size: "M", "L", "XL"
    const letterSizeMatch = text.match(/\b([XSML]{1,3})\b/);
    if (letterSizeMatch) {
      return letterSizeMatch[1];
    }

    return null;
  };

  /**
   * Extracts condition from subtitle field (text after · separator).
   * Examples:
   * - "Brand / Size · Très bon état" → "Très bon état"
   * - "Brand / Size · Neuf avec étiquette" → "Neuf avec étiquette"
   */
  static extractCondition: TransformFunction = (value: unknown): string => {
    if (typeof value !== 'string') return 'unknown';

    const text = value.trim();

    // Split by · separator
    const parts = text.split('·');
    if (parts.length >= 2) {
      return parts[1].trim();
    }

    return 'unknown';
  };

  /**
   * Parses favorite count from Vinted format.
   * Examples:
   * - "4Enlevé !" → 4
   * - "13Enlevé !" → 13
   * - "Enlevé !" → 0
   */
  static parseFavoriteCount: TransformFunction = (value: unknown): number => {
    if (typeof value !== 'string') return 0;

    // Extract number before "Enlevé !"
    const match = value.match(/(\d+)\s*Enlevé\s*!/i);
    return match ? parseInt(match[1], 10) : 0;
  };

  /**
   * Normalizes Vinted condition values to standard format.
   * Examples:
   * - "Neuf avec étiquette" → "Neuf avec étiquette"
   * - "Très bon état" → "Très bon état"
   * - "Satisfaisant" → "Satisfaisant"
   * - "Comme neuf" → "Comme neuf"
   */
  static normalizeCondition: TransformFunction = (value: unknown): string => {
    if (typeof value !== 'string') return 'unknown';

    const text = value.toLowerCase().trim();

    // Handle empty string
    if (text === '') return 'unknown';

    // Map to standard conditions
    if (text.includes('neuf avec') || text.includes('étiquette')) {
      return 'Neuf avec étiquette';
    }
    if (text.includes('très bon') || text.includes('excellent')) {
      return 'Très bon état';
    }
    if (text.includes('bon état')) {
      return 'Bon état';
    }
    if (text.includes('satisfaisant')) {
      return 'Satisfaisant';
    }
    if (text.includes('comme neuf')) {
      return 'Comme neuf';
    }

    // Return original if no match
    return value.trim();
  };
}
