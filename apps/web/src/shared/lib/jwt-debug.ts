/**
 * JWT Debug Utilities
 * Comprehensive JWT token analysis and debugging functions
 */

export interface JWTHeader {
  typ?: string;
  alg?: string;
  kid?: string;
  [key: string]: unknown;
}

export interface JWTPayload {
  sub?: string; // Standard JWT subject (user ID)
  userId?: string; // Legacy user ID field
  email?: string;
  emailVerified?: boolean;
  iat?: number; // Issued at
  exp?: number; // Expires at
  aud?: string; // Audience
  iss?: string; // Issuer
  [key: string]: unknown;
}

export interface JWTAnalysis {
  valid: boolean;
  header: JWTHeader | null;
  payload: JWTPayload | null;
  signature: string | null;
  errors: string[];
  warnings: string[];
  info: {
    tokenLength: number;
    headerLength: number;
    payloadLength: number;
    signatureLength: number;
    issuedAt?: string;
    expiresAt?: string;
    timeUntilExpiry?: string;
    isExpired?: boolean;
    hasValidFormat: boolean;
    hasUserIdentifier: boolean;
    userIdSource?: 'sub' | 'userId' | 'none';
    userId?: string;
  };
}

/**
 * Decode JWT token without verification
 */
export function decodeJWT(token: string): JWTAnalysis {
  const analysis: JWTAnalysis = {
    valid: false,
    header: null,
    payload: null,
    signature: null,
    errors: [],
    warnings: [],
    info: {
      tokenLength: token.length,
      headerLength: 0,
      payloadLength: 0,
      signatureLength: 0,
      hasValidFormat: false,
      hasUserIdentifier: false,
    },
  };

  try {
    // Basic format validation
    if (!token || typeof token !== 'string') {
      analysis.errors.push('Token is not a valid string');
      return analysis;
    }

    if (token.trim() !== token) {
      analysis.warnings.push('Token has leading/trailing whitespace');
      token = token.trim();
    }

    // Split token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      analysis.errors.push(
        `Invalid JWT format: expected 3 parts, got ${parts.length}`
      );
      return analysis;
    }

    analysis.info.hasValidFormat = true;
    analysis.info.headerLength = parts[0].length;
    analysis.info.payloadLength = parts[1].length;
    analysis.info.signatureLength = parts[2].length;

    // Decode header
    try {
      const headerDecoded = atob(parts[0]);
      analysis.header = JSON.parse(headerDecoded);

      if (!analysis.header?.alg) {
        analysis.warnings.push('JWT header missing algorithm (alg) field');
      }
      if (!analysis.header?.typ || analysis.header.typ !== 'JWT') {
        analysis.warnings.push(
          'JWT header missing or invalid type (typ) field'
        );
      }
    } catch (error) {
      analysis.errors.push(
        `Failed to decode JWT header: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Decode payload
    try {
      const payloadDecoded = atob(parts[1]);
      analysis.payload = JSON.parse(payloadDecoded);

      if (analysis.payload) {
        // Check for user identifier
        if (analysis.payload.sub) {
          analysis.info.hasUserIdentifier = true;
          analysis.info.userIdSource = 'sub';
          analysis.info.userId = analysis.payload.sub;
        } else if (analysis.payload.userId) {
          analysis.info.hasUserIdentifier = true;
          analysis.info.userIdSource = 'userId';
          analysis.info.userId = analysis.payload.userId;
        } else {
          analysis.warnings.push(
            'JWT payload missing user identifier (sub or userId)'
          );
          analysis.info.userIdSource = 'none';
        }

        // Check timestamps
        if (analysis.payload.iat) {
          const issuedAt = new Date(analysis.payload.iat * 1000);
          analysis.info.issuedAt = issuedAt.toISOString();
        }

        if (analysis.payload.exp) {
          const expiresAt = new Date(analysis.payload.exp * 1000);
          analysis.info.expiresAt = expiresAt.toISOString();

          const now = Date.now();
          const expiryTime = analysis.payload.exp * 1000;
          analysis.info.isExpired = now > expiryTime;

          if (analysis.info.isExpired) {
            analysis.errors.push('JWT token is expired');
          } else {
            const timeLeft = expiryTime - now;
            analysis.info.timeUntilExpiry = formatDuration(timeLeft);
          }
        } else {
          analysis.warnings.push('JWT payload missing expiration time (exp)');
        }

        // Email validation
        if (!analysis.payload.email) {
          analysis.warnings.push('JWT payload missing email field');
        } else if (
          typeof analysis.payload.email !== 'string' ||
          !analysis.payload.email.includes('@')
        ) {
          analysis.warnings.push('JWT payload has invalid email format');
        }
      }
    } catch (error) {
      analysis.errors.push(
        `Failed to decode JWT payload: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Store signature
    analysis.signature = parts[2];

    // Overall validation
    analysis.valid =
      analysis.errors.length === 0 && analysis.info.hasUserIdentifier;
  } catch (error) {
    analysis.errors.push(
      `JWT analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  return analysis;
}

/**
 * Validate JWT format and structure
 */
export function validateJWTFormat(token: string): {
  valid: boolean;
  errors: string[];
} {
  const analysis = decodeJWT(token);
  return {
    valid: analysis.valid,
    errors: analysis.errors,
  };
}

/**
 * Check if JWT token is expired
 */
export function isJWTExpired(token: string): {
  expired: boolean;
  expiresAt?: Date;
  timeLeft?: number;
} {
  const analysis = decodeJWT(token);

  if (!analysis.payload?.exp) {
    return { expired: false }; // No expiration, consider valid
  }

  const expiresAt = new Date(analysis.payload.exp * 1000);
  const now = Date.now();
  const expired = now > analysis.payload.exp * 1000;
  const timeLeft = expired ? 0 : analysis.payload.exp * 1000 - now;

  return {
    expired,
    expiresAt,
    timeLeft,
  };
}

/**
 * Extract user ID from JWT token
 */
export function extractUserIdFromJWT(token: string): {
  userId: string | null;
  source: 'sub' | 'userId' | 'none';
} {
  const analysis = decodeJWT(token);

  if (!analysis.payload) {
    return { userId: null, source: 'none' };
  }

  if (analysis.payload.sub) {
    return { userId: analysis.payload.sub, source: 'sub' };
  }

  if (analysis.payload.userId) {
    return { userId: analysis.payload.userId, source: 'userId' };
  }

  return { userId: null, source: 'none' };
}

/**
 * Generate a comprehensive JWT debug report
 */
export function generateJWTReport(token: string): string {
  const analysis = decodeJWT(token);

  const lines: string[] = [
    '=== JWT TOKEN ANALYSIS REPORT ===',
    `Timestamp: ${new Date().toISOString()}`,
    '',
    '--- BASIC INFO ---',
    `Token Length: ${analysis.info.tokenLength}`,
    `Valid Format: ${analysis.info.hasValidFormat}`,
    `Valid Token: ${analysis.valid}`,
    `Has User ID: ${analysis.info.hasUserIdentifier}`,
    `User ID Source: ${analysis.info.userIdSource}`,
    analysis.info.userId ? `User ID: ${analysis.info.userId}` : 'User ID: None',
    '',
    '--- TOKEN STRUCTURE ---',
    `Header Length: ${analysis.info.headerLength}`,
    `Payload Length: ${analysis.info.payloadLength}`,
    `Signature Length: ${analysis.info.signatureLength}`,
  ];

  if (analysis.header) {
    lines.push('', '--- JWT HEADER ---');
    Object.entries(analysis.header).forEach(([key, value]) => {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    });
  }

  if (analysis.payload) {
    lines.push('', '--- JWT PAYLOAD ---');
    Object.entries(analysis.payload).forEach(([key, value]) => {
      if (key === 'iat' || key === 'exp') {
        const date = new Date((value as number) * 1000).toISOString();
        lines.push(`${key}: ${value} (${date})`);
      } else {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      }
    });
  }

  if (analysis.info.issuedAt) {
    lines.push('', '--- TIMING INFO ---');
    lines.push(`Issued At: ${analysis.info.issuedAt}`);
    if (analysis.info.expiresAt) {
      lines.push(`Expires At: ${analysis.info.expiresAt}`);
      lines.push(`Is Expired: ${analysis.info.isExpired}`);
      if (analysis.info.timeUntilExpiry && !analysis.info.isExpired) {
        lines.push(`Time Until Expiry: ${analysis.info.timeUntilExpiry}`);
      }
    }
  }

  if (analysis.errors.length > 0) {
    lines.push('', '--- ERRORS ---');
    analysis.errors.forEach((error) => lines.push(`❌ ${error}`));
  }

  if (analysis.warnings.length > 0) {
    lines.push('', '--- WARNINGS ---');
    analysis.warnings.forEach((warning) => lines.push(`⚠️ ${warning}`));
  }

  return lines.join('\n');
}

/**
 * Create a mock JWT token for testing purposes
 */
export function createMockJWT(payload: Partial<JWTPayload>): string {
  const header = {
    typ: 'JWT',
    alg: 'HS256',
  };

  const defaultPayload: JWTPayload = {
    sub: 'mock-user-id',
    email: 'test@example.com',
    emailVerified: true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    ...payload,
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(defaultPayload));
  const signature = 'mock-signature-for-testing';

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Helper function to format duration in milliseconds
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  if (ms < 60000) {
    return `${Math.round(ms / 1000)}s`;
  }

  if (ms < 3600000) {
    return `${Math.round(ms / 60000)}m`;
  }

  return `${Math.round(ms / 3600000)}h`;
}

/**
 * Debug function to log JWT analysis to console
 */
export function debugJWT(token: string, label: string = 'JWT Token'): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  const analysis = decodeJWT(token);

  console.group(`🔍 ${label} Analysis`);

  if (analysis.errors.length > 0) {
    console.error('❌ Errors:', analysis.errors);
  }

  if (analysis.warnings.length > 0) {
    console.warn('⚠️ Warnings:', analysis.warnings);
  }

  console.groupEnd();
}
