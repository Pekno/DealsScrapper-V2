/**
 * Security utilities for safe data extraction and validation
 */

/**
 * Sanitizes user input to prevent XSS attacks
 * @param input - Raw user input
 * @returns Sanitized string safe for processing
 */
export function sanitizeText(input: unknown): string {
  if (input == null) {
    return '';
  }

  const sanitized = String(input);

  // Remove dangerous script-like patterns
  return sanitized
    .replace(/alert\s*\(/gi, 'BLOCKED')
    .replace(/eval\s*\(/gi, 'BLOCKED')
    .replace(/function\s*\(/gi, 'BLOCKED')
    .replace(/onclick\s*=/gi, 'BLOCKED')
    .replace(/onerror\s*=/gi, 'BLOCKED')
    .replace(/onload\s*=/gi, 'BLOCKED')
    .replace(/javascript:/gi, 'BLOCKED')
    // Remove template injection patterns
    .replace(/\{\{[^}]*\}\}/g, 'BLOCKED_TEMPLATE')
    .replace(/\$\{[^}]*\}/g, 'BLOCKED_TEMPLATE')
    // Clean up whitespace and control characters
    .replace(/\s+/g, ' ')
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .trim()
    // Limit length to prevent DoS
    .substring(0, 1000);
}

/**
 * Validates and sanitizes URLs to prevent injection
 * @param url - URL to validate
 * @returns Safe URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Remove dangerous protocols
  if (
    url.toLowerCase().startsWith('javascript:') ||
    url.toLowerCase().startsWith('data:') ||
    url.toLowerCase().startsWith('vbscript:') ||
    url.toLowerCase().startsWith('file:') ||
    url.toLowerCase().startsWith('ftp:')
  ) {
    return '';
  }

  // Prevent path traversal
  if (url.includes('../')) {
    return '';
  }

  // Block localhost/internal network access
  if (
    url.includes('localhost') ||
    url.includes('127.0.0.1') ||
    url.includes('10.') ||
    url.includes('192.168.')
  ) {
    return '';
  }

  return url.trim();
}

/**
 * Validates numeric input with safe bounds
 * @param value - Value to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Safe numeric value or undefined if invalid
 */
export function validateNumber(
  value: unknown,
  min: number = Number.MIN_SAFE_INTEGER,
  max: number = Number.MAX_SAFE_INTEGER
): number | undefined {
  if (value == null) {
    return undefined;
  }

  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(num) || !isFinite(num)) {
    return undefined;
  }

  // Apply bounds - CLAMP for general security (backwards compatible)
  const boundedNum = Math.max(min, Math.min(max, num));

  return boundedNum;
}

/**
 * Validates temperature values with realistic bounds
 * @param tempText - Temperature text to parse
 * @returns Safe temperature value or 0 if invalid
 */
export function validateTemperature(tempText: string): number {
  if (!tempText || typeof tempText !== 'string') {
    return 0;
  }

  // Sanitize the input first
  const sanitized = sanitizeText(tempText);

  const match = sanitized.match(/(-?\d+)°/);
  if (!match) {
    return 0;
  }

  const temp = parseInt(match[1]);

  // Apply realistic temperature bounds for Dealabs scoring system (-100 to 10000)
  // Note: Dealabs temperature represents community interest, not actual temperature
  return validateNumber(temp, -100, 10000) || 0;
}

/**
 * Validates and bounds price values
 * @param priceText - Price text to parse
 * @returns Safe price value or undefined if invalid
 */
export function validatePrice(priceText: string): number | undefined {
  if (!priceText || typeof priceText !== 'string') {
    return undefined;
  }

  const sanitized = sanitizeText(priceText);

  // Enhanced regex to handle French thousand separators and decimal places
  // Matches patterns like: 1, 1.50, 1,50, 1 000, 1 000.50, 1 000,50, 10 000, etc.
  // This captures digits followed by optional space-separated groups of 3 digits (French thousands)
  // followed by optional decimal part with either comma or dot
  const match = sanitized.match(/(\d+(?:\s\d{3})*(?:[.,]\d+)?)/);

  if (!match) {
    return undefined;
  }

  // Clean up the price string
  let priceStr = match[1];

  // Remove spaces (French thousand separators: "1 000" → "1000")
  priceStr = priceStr.replace(/\s/g, '');

  // Convert comma decimal separator to dot (French: "1000,50" → "1000.50")
  priceStr = priceStr.replace(',', '.');

  const price = parseFloat(priceStr);

  if (isNaN(price) || !isFinite(price)) {
    return undefined;
  }

  // For prices, REJECT values outside the valid range (0 to 1M euros)
  if (price < 0 || price > 1000000) {
    return undefined;
  }

  return price;
}

/**
 * Safely handles HTML parsing input
 * @param html - HTML content to validate
 * @returns Safe HTML string or empty string if invalid
 */
export function validateHtmlInput(html: unknown): string {
  const minimalHtml = '<html><body></body></html>';

  if (html == null || typeof html !== 'string' || html.trim() === '') {
    return minimalHtml;
  }

  // Limit HTML size to prevent DoS (max 10MB)
  if (html.length > 10 * 1024 * 1024) {
    return minimalHtml;
  }

  return html;
}

/**
 * Validates URL parameters to prevent injection
 * @param params - URL parameters object
 * @returns Sanitized parameters object
 */
export function sanitizeUrlParams(
  params: Record<string, any>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    // Sanitize key
    const safeKey = sanitizeText(key);
    if (
      safeKey === '' ||
      safeKey === 'BLOCKED' ||
      safeKey.includes('BLOCKED')
    ) {
      continue; // Skip dangerous keys
    }

    // Sanitize value based on expected type
    let safeValue: string;

    if (typeof value === 'number') {
      // For numeric values, apply reasonable bounds
      const bounded = validateNumber(value, -999999, 999999);
      safeValue = bounded !== undefined ? bounded.toString() : '';
    } else {
      // For string values, sanitize text
      safeValue = sanitizeText(value);
      if (safeValue === 'BLOCKED' || safeValue.includes('BLOCKED')) {
        continue; // Skip dangerous values
      }
    }

    if (safeValue !== '') {
      sanitized[safeKey] = safeValue;
    }
  }

  return sanitized;
}
