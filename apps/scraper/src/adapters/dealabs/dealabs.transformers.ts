import type { TransformFunction } from '../../field-extraction/field-mapping-config.interface.js';

// Simple date utility functions (replaces date-fns)
const subMinutes = (date: Date, minutes: number): Date =>
  new Date(date.getTime() - minutes * 60 * 1000);
const subHours = (date: Date, hours: number): Date =>
  new Date(date.getTime() - hours * 60 * 60 * 1000);
const subDays = (date: Date, days: number): Date =>
  new Date(date.getTime() - days * 24 * 60 * 60 * 1000);

/**
 * Dealabs-specific transform functions.
 * These handle Dealabs-specific patterns (thread IDs, relative dates, etc.)
 */
export class DealabsTransformers {
  /**
   * Extracts Dealabs thread ID from various formats.
   * Examples:
   * - "thread_2345678" → "2345678"
   * - "2345678" → "2345678"
   */
  static extractThreadId: TransformFunction = (value: unknown): string => {
    if (typeof value !== 'string') return '';

    // Remove "thread_" prefix if present
    const cleaned = value.replace(/^thread_/, '');

    // Extract numeric ID
    const match = cleaned.match(/\d+/);
    return match ? match[0] : cleaned;
  };

  /**
   * Normalizes Dealabs URLs (handles relative URLs).
   * Examples:
   * - "/bons-plans/deal-title-123" → "https://www.dealabs.com/bons-plans/deal-title-123"
   * - "https://www.dealabs.com/..." → "https://www.dealabs.com/..."
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

    // Invalid URL
    return url;
  };

  /**
   * Parses Dealabs relative dates.
   * Examples:
   * - "il y a 2 min" → Date (2 minutes ago)
   * - "il y a 3h" → Date (3 hours ago)
   * - "il y a 5 jours" → Date (5 days ago)
   * - "Aujourd'hui, 14:30" → Date (today at 14:30)
   */
  static parseRelativeDate: TransformFunction = (value: unknown): Date => {
    if (typeof value !== 'string') return new Date();

    const text = value.toLowerCase().trim();
    const now = new Date();

    // Match "il y a X min/minutes"
    const minutesMatch = text.match(/il y a (\d+)\s*min/);
    if (minutesMatch) {
      return subMinutes(now, parseInt(minutesMatch[1], 10));
    }

    // Match "il y a Xh" or "il y a X heures" or "il y a X h." (with trailing period)
    const hoursMatch = text.match(/il y a (\d+)\s*h(?:eures?)?\.?/);
    if (hoursMatch) {
      return subHours(now, parseInt(hoursMatch[1], 10));
    }

    // Match "il y a X jour(s)"
    const daysMatch = text.match(/il y a (\d+)\s*jours?/);
    if (daysMatch) {
      return subDays(now, parseInt(daysMatch[1], 10));
    }

    // Match "il y a X sem/semaine(s)" (weeks)
    const weeksMatch = text.match(/il y a (\d+)\s*sem(?:aines?)?\.?/);
    if (weeksMatch) {
      return subDays(now, parseInt(weeksMatch[1], 10) * 7);
    }

    // Match "Aujourd'hui" or "Hier"
    if (text.includes("aujourd'hui")) {
      return now;
    }
    if (text.includes('hier')) {
      return subDays(now, 1);
    }

    // Match absolute dates like "le 6 juin" or "Posté le 6 juin"
    const absoluteDateMatch = text.match(/(\d+)\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i);
    if (absoluteDateMatch) {
      const day = parseInt(absoluteDateMatch[1], 10);
      const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
      const month = monthNames.indexOf(absoluteDateMatch[2].toLowerCase());
      if (month !== -1) {
        const year = now.getFullYear();
        return new Date(year, month, day);
      }
    }

    // Fallback: return current date
    return now;
  };

  /**
   * Parses Dealabs expiration dates.
   * Examples:
   * - "Expire le 20/01/2025" → Date
   * - "Expire dans 3 jours" → Date (3 days from now)
   * - "Expiré" → null
   */
  static parseExpirationDate: TransformFunction = (
    value: unknown,
  ): Date | null => {
    if (typeof value !== 'string') return null;

    const text = value.toLowerCase().trim();

    // Already expired
    if (text.includes('expiré')) {
      return null;
    }

    // Match "Expire le DD/MM/YYYY"
    const dateMatch = text.match(/expire le (\d{2})\/(\d{2})(?:\/(\d{4}))?/);
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1; // JS months are 0-indexed
      const year = dateMatch[3]
        ? parseInt(dateMatch[3], 10)
        : new Date().getFullYear();

      return new Date(year, month, day);
    }

    // Match "Expire dans X jours"
    const daysMatch = text.match(/expire dans (\d+)\s*jours?/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    // No expiration info found
    return null;
  };

  /**
   * Extracts numeric merchant identifier from link or text.
   * Example: "amazon.fr" → "amazon"
   */
  static extractMerchantName: TransformFunction = (value: unknown): string => {
    if (typeof value !== 'string') return '';

    const text = value.toLowerCase().trim();

    // Extract domain name if URL
    if (text.includes('.')) {
      const parts = text.split('.');
      return parts[0].replace(/[^a-z0-9]/g, '');
    }

    // Clean merchant name
    return text.replace(/[^a-z0-9]/g, '');
  };
}
