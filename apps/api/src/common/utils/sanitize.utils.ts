const XSS_PATTERNS: RegExp[] = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
];

/**
 * Strips common XSS attack vectors from a string value.
 * Used as a Transform function in DTOs for user-supplied text fields.
 */
export function stripXss(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  let sanitized = value;
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  return sanitized;
}

/**
 * Transforms a query-string boolean value ("true"/"false" or actual boolean)
 * into a proper boolean. Returns undefined for unrecognised values.
 */
export function transformBooleanParam(value: unknown): boolean | undefined {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}
