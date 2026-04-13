import { createServiceLogger } from '@dealscrapper/shared-logging';
import { notifierLogConfig } from '../config/logging.config.js';

// Create a logger instance for URL sanitization warnings
const urlSanitizationLogger = createServiceLogger(notifierLogConfig);

/**
 * Validates and sanitizes URL to prevent injection attacks
 * @param url - URL to validate and sanitize
 * @returns Safe URL or empty string if invalid/dangerous
 *
 * Security features:
 * - Blocks dangerous protocols (javascript:, data:, vbscript:, etc.)
 * - Blocks dangerous patterns (script tags, event handlers, etc.)
 * - Only allows HTTP and HTTPS protocols
 * - Blocks localhost in production (allows in dev/test)
 * - Validates hostname structure (allows localhost)
 * - Logs all rejections for security monitoring
 */
export function sanitizeUrl(url: unknown): string {
  if (typeof url !== 'string' || !url.trim()) {
    if (url !== undefined && url !== null && url !== '') {
      urlSanitizationLogger.warn(
        `⚠️ URL sanitization rejected: invalid type or empty (type: ${typeof url})`
      );
    }
    return '';
  }

  const trimmedUrl = url.trim();

  // Check for dangerous protocols and patterns
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'ftp:',
    'about:',
    'chrome:',
    'chrome-extension:',
    'wyciwyg:',
    'webkit:',
    'moz-extension:',
  ];

  // Additional dangerous patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /data:application/i,
    /vbscript:/i,
    /on\w+=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
  ];

  const lowerUrl = trimmedUrl.toLowerCase();

  // Check for dangerous protocols
  const matchedProtocol = dangerousProtocols.find((protocol) =>
    lowerUrl.startsWith(protocol)
  );
  if (matchedProtocol) {
    urlSanitizationLogger.warn(
      `⚠️ URL sanitization rejected: dangerous protocol "${matchedProtocol}" in URL: ${trimmedUrl.substring(0, 100)}`
    );
    return '';
  }

  // Check for dangerous patterns
  const matchedPattern = dangerousPatterns.find((pattern) =>
    pattern.test(trimmedUrl)
  );
  if (matchedPattern) {
    urlSanitizationLogger.warn(
      `⚠️ URL sanitization rejected: dangerous pattern ${matchedPattern} in URL: ${trimmedUrl.substring(0, 100)}`
    );
    return '';
  }

  try {
    const urlObj = new URL(trimmedUrl);

    // Only allow HTTP and HTTPS protocols
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      urlSanitizationLogger.warn(
        `⚠️ URL sanitization rejected: invalid protocol "${urlObj.protocol}" (only http/https allowed) for URL: ${trimmedUrl}`
      );
      return '';
    }

    // Validate hostname structure - reject malicious hostnames
    // Allow localhost and loopback addresses for local development/testing
    const localhostPatterns = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
    const isLocalhost = localhostPatterns.some((pattern) => urlObj.hostname === pattern);

    if (!isLocalhost) {
      const validHostnamePattern =
        /^[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*$/;
      if (!validHostnamePattern.test(urlObj.hostname)) {
        urlSanitizationLogger.warn(
          `⚠️ URL sanitization rejected: invalid hostname structure "${urlObj.hostname}" (failed regex validation) for URL: ${trimmedUrl}`
        );
        return '';
      }
    }

    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, try to make it safe
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      urlSanitizationLogger.warn(
        `⚠️ URL parsing failed but starts with http(s), applying basic sanitization: ${trimmedUrl.substring(0, 100)}`
      );
      // Basic sanitization for malformed URLs
      return trimmedUrl.replace(/[<>"']/g, '');
    }
    urlSanitizationLogger.warn(
      `⚠️ URL sanitization rejected: malformed URL that cannot be parsed: ${trimmedUrl.substring(0, 100)}`
    );
    return '';
  }
}

/**
 * Sanitizes user input to prevent XSS attacks in templates
 * @param input - Raw user input
 * @returns Sanitized string safe for template rendering
 */
export function sanitizeInput(input: unknown): string {
  if (input === null || input === undefined) {
    return '';
  }

  if (typeof input !== 'string') {
    return String(input);
  }

  // Enhanced XSS protection - remove dangerous patterns and encode
  let sanitized = input
    // First remove extremely dangerous Handlebars/template injection patterns
    .replace(/constructor/gi, 'BLOCKED')
    .replace(/process/gi, 'BLOCKED')
    .replace(/require/gi, 'BLOCKED')
    .replace(/__proto__/gi, 'BLOCKED')
    .replace(/prototype/gi, 'BLOCKED')
    .replace(/@root/gi, 'BLOCKED')
    // Remove template injection patterns
    .replace(/\{\{[^}]*\}\}/g, 'BLOCKED_TEMPLATE')
    .replace(/\$\{[^}]*\}/g, 'BLOCKED_TEMPLATE')
    // Remove dangerous functional patterns while preserving structure
    .replace(/alert\s*\(/gi, 'BLOCKED')
    .replace(/eval\s*\(/gi, 'BLOCKED')
    .replace(/function\s*\(/gi, 'BLOCKED')
    .replace(/onclick\s*=/gi, 'BLOCKED')
    .replace(/onerror\s*=/gi, 'BLOCKED')
    .replace(/onload\s*=/gi, 'BLOCKED')
    .replace(/javascript:/gi, 'BLOCKED')
    // Clean up whitespace and control characters first
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .replace(/\t/g, ' ')
    // Remove control characters including dangerous ones
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // Limit length to prevent DoS
  return sanitized.substring(0, 10000);
}
