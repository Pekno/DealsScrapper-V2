# 🛠️ @dealscrapper/shared

![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-Zero-green)
![Pure Utilities](https://img.shields.io/badge/Pure-Utilities-purple)

> Common utility functions and configuration constants for all DealsScapper services

## 📋 Overview

This package provides pure utility functions and shared configuration constants used across all DealsScapper services. It contains zero-dependency, reusable helpers for error handling, async operations, and standardized configuration values.

**Key Benefits:**
- ✅ Zero external dependencies (pure TypeScript)
- ✅ Type-safe utility functions
- ✅ Consistent error handling across services
- ✅ Standardized configuration constants
- ✅ No runtime overhead (tree-shakeable)

## 🎯 Scope

**Included:**
- ✅ Error handling utilities (`extractErrorMessage`, `safeStringify`)
- ✅ Async operation helpers (`delay`, `retryWithBackoff`)
- ✅ Common configuration constants (timeouts, retries, batch sizes)
- ✅ Environment-based configuration helpers

**NOT Included:**
- ❌ Service-specific logic (belongs in services)
- ❌ Database operations (use `@dealscrapper/database`)
- ❌ Logging (use `@dealscrapper/shared-logging`)

## 📦 Installation

```json
{
  "dependencies": {
    "@dealscrapper/shared": "workspace:*"
  }
}
```

## 🚀 Quick Start

### Error Handling

```typescript
import { extractErrorMessage, safeStringify } from '@dealscrapper/shared';

try {
  await riskyOperation();
} catch (error) {
  // ✅ Safe error message extraction
  const message = extractErrorMessage(error);
  console.error('Operation failed:', message);

  // ✅ Safe object stringification
  const errorDetails = safeStringify(error);
  logger.error('Error details:', errorDetails);
}
```

### Async Operations

```typescript
import { delay, retryWithBackoff } from '@dealscrapper/shared';

// ✅ Simple delay
await delay(1000); // Wait 1 second

// ✅ Retry with exponential backoff
const result = await retryWithBackoff(
  async () => {
    return await fetchData();
  },
  3,    // max attempts
  1000  // base delay (1 second)
);
```

### Configuration Constants

```typescript
import { COMMON_CONFIG, getTimeout, getBatchSize } from '@dealscrapper/shared';

// ✅ Use predefined timeouts
const httpTimeout = COMMON_CONFIG.TIMEOUTS.HTTP;        // 30000ms
const dbTimeout = COMMON_CONFIG.TIMEOUTS.DATABASE;       // 60000ms

// ✅ Or use helper functions
const timeout = getTimeout('DEFAULT');                   // 30000ms
const batchSize = getBatchSize('DATABASE_BULK');         // 500
```

## 📖 API Reference

### Error Handling Utilities

#### `extractErrorMessage(error: unknown): string`

Safely extracts a human-readable error message from any error type.

**Parameters:**
- `error` - Any unknown error object

**Returns:** `string` - Human-readable error message

**Examples:**
```typescript
// Error instance
const msg1 = extractErrorMessage(new Error('Database connection failed'));
// Returns: "Database connection failed"

// String error
const msg2 = extractErrorMessage('Network timeout');
// Returns: "Network timeout"

// Object with message
const msg3 = extractErrorMessage({ message: 'Invalid input' });
// Returns: "Invalid input"

// Unknown type
const msg4 = extractErrorMessage(undefined);
// Returns: "Unknown error occurred"
```

---

#### `safeStringify(obj: unknown): string`

Safely stringifies any object, handling circular references and undefined values.

**Parameters:**
- `obj` - Any object to stringify

**Returns:** `string` - JSON string or fallback string representation

**Examples:**
```typescript
// Simple object
const str1 = safeStringify({ userId: '123', email: 'user@example.com' });
// Returns: formatted JSON string

// Circular reference (won't throw)
const circular: any = { name: 'test' };
circular.self = circular;
const str2 = safeStringify(circular);
// Returns: "[object Object]" (fallback)

// Undefined/null
const str3 = safeStringify(undefined);
// Returns: "undefined"
```

---

### Async Operation Utilities

#### `delay(ms: number): Promise<void>`

Creates a promise that resolves after the specified milliseconds.

**Parameters:**
- `ms` - Milliseconds to delay

**Returns:** `Promise<void>`

**Examples:**
```typescript
// Simple delay
await delay(1000);  // Wait 1 second

// Rate limiting
for (const item of items) {
  await processItem(item);
  await delay(100);  // 100ms between requests
}

// Retry with delay
try {
  await operation();
} catch {
  await delay(2000);  // Wait 2 seconds
  await operation();  // Retry
}
```

---

#### `retryWithBackoff<T>(fn: () => Promise<T>, maxAttempts?: number, baseDelay?: number): Promise<T>`

Retries an async operation with exponential backoff.

**Parameters:**
- `fn` - Async function to retry
- `maxAttempts` - Maximum retry attempts (default: 3)
- `baseDelay` - Base delay in milliseconds (default: 1000)

**Returns:** `Promise<T>` - Result of the function

**Throws:** The last error if all attempts fail

**Backoff Strategy:**
- Attempt 1: Immediate
- Attempt 2: baseDelay * 2^1 = 2 seconds (if baseDelay = 1000)
- Attempt 3: baseDelay * 2^2 = 4 seconds

**Examples:**
```typescript
// Basic retry
const data = await retryWithBackoff(async () => {
  return await fetch('https://api.example.com/data');
});

// Custom attempts and delay
const result = await retryWithBackoff(
  async () => {
    return await database.query('SELECT * FROM users');
  },
  5,     // Try up to 5 times
  2000   // Start with 2 second delay
);

// With error handling
try {
  const response = await retryWithBackoff(
    async () => {
      const res = await httpClient.get('/endpoint');
      if (!res.ok) throw new Error('HTTP error');
      return res.json();
    },
    3,
    1000
  );
} catch (error) {
  console.error('All retry attempts failed:', extractErrorMessage(error));
}
```

---

### Configuration Constants

#### `COMMON_CONFIG`

Centralized configuration constants used across all services.

##### Timeouts (milliseconds)

```typescript
COMMON_CONFIG.TIMEOUTS = {
  FAST: 2000,              // Fast operations (2s)
  QUICK: 3000,             // Quick operations (3s)
  SHORT: 5000,             // Short operations (5s)
  HEALTH_CHECK: 10000,     // Health checks (10s)
  WEBSOCKET: 15000,        // WebSocket connections (15s)
  DEFAULT: 30000,          // Default operations (30s)
  HTTP: 30000,             // HTTP requests (30s)
  FILE_IO: 30000,          // File operations (30s)
  DATABASE: 60000,         // Database operations (1m)
  ELASTICSEARCH: 60000,    // Elasticsearch operations (1m)
  LONG: 120000,            // Long operations (2m)
};
```

**Usage:**
```typescript
import { COMMON_CONFIG } from '@dealscrapper/shared';

const response = await axios.get(url, {
  timeout: COMMON_CONFIG.TIMEOUTS.HTTP
});
```

##### Retry Configuration

```typescript
COMMON_CONFIG.RETRIES = {
  MAX_ATTEMPTS: 3,                    // Default max attempts
  MAX_ATTEMPTS_CRITICAL: 5,           // Critical operations
  MAX_ATTEMPTS_DATABASE: 10,          // Database operations
  BACKOFF_TYPE: 'exponential',        // Backoff strategy
  BASE_DELAY: 1000,                   // Base delay (1s)
  MAX_DELAY: 30000,                   // Max delay (30s)
};
```

**Usage:**
```typescript
const { MAX_ATTEMPTS, BASE_DELAY } = COMMON_CONFIG.RETRIES;

await retryWithBackoff(operation, MAX_ATTEMPTS, BASE_DELAY);
```

##### Batch Sizes

```typescript
COMMON_CONFIG.BATCH_SIZES = {
  SMALL: 50,                   // Careful operations
  DEFAULT: 100,                // Default batch size
  MAX: 500,                    // Maximum batch size
  DATABASE_BULK: 500,          // Database bulk inserts
  LARGE: 1000,                 // Large batches
  ELASTICSEARCH_BULK: 1000,    // Elasticsearch bulk ops
  EMAIL_BATCH: 50,             // Email notifications
};
```

**Usage:**
```typescript
const batchSize = COMMON_CONFIG.BATCH_SIZES.DATABASE_BULK;

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  await processBatch(batch);
}
```

##### Rate Limits

```typescript
COMMON_CONFIG.RATE_LIMITS = {
  DEFAULT_RPM: 100,          // Default requests per minute
  STRICT_RPM: 20,            // Strict rate limit
  BURST_LIMIT: 50,           // Short-term burst limit
  WINDOW_MS: 900000,         // Rate limit window (15 minutes)
  EXTERNAL_API_RPM: 60,      // External API rate limit
};
```

##### Performance Thresholds

```typescript
COMMON_CONFIG.PERFORMANCE = {
  MAX_MEMORY_MB: 512,          // Max memory usage
  MEMORY_WARNING_MB: 256,      // Memory warning threshold
  CPU_WARNING_PERCENT: 80,     // CPU warning threshold
  MAX_CONCURRENT: 10,          // Max concurrent operations
};
```

##### Storage Configuration

```typescript
COMMON_CONFIG.STORAGE = {
  MAX_FILE_SIZE_MB: 10,         // Max upload size
  LOG_ROTATION_SIZE_MB: 20,     // Log rotation size
  LOG_RETENTION_DAYS: 14,       // Log retention period
  TEMP_CLEANUP_HOURS: 24,       // Temp file cleanup interval
};
```

---

### Configuration Helper Functions

#### `getTimeout(type: TimeoutType): number`

Type-safe accessor for timeout values.

```typescript
const httpTimeout = getTimeout('HTTP');        // 30000
const dbTimeout = getTimeout('DATABASE');      // 60000
const healthTimeout = getTimeout('HEALTH_CHECK'); // 10000
```

---

#### `getBatchSize(type: BatchSizeType): number`

Type-safe accessor for batch size values.

```typescript
const defaultBatch = getBatchSize('DEFAULT');        // 100
const dbBatch = getBatchSize('DATABASE_BULK');       // 500
const emailBatch = getBatchSize('EMAIL_BATCH');      // 50
```

---

#### `getRetryConfig(maxAttemptsType?: string): object`

Get retry configuration with all parameters.

```typescript
// Default retry config
const config = getRetryConfig();
// { maxAttempts: 3, backoffType: 'exponential', baseDelay: 1000, maxDelay: 30000 }

// Critical operations
const criticalConfig = getRetryConfig('MAX_ATTEMPTS_CRITICAL');
// { maxAttempts: 5, backoffType: 'exponential', baseDelay: 1000, maxDelay: 30000 }

// Database operations
const dbConfig = getRetryConfig('MAX_ATTEMPTS_DATABASE');
// { maxAttempts: 10, backoffType: 'exponential', baseDelay: 1000, maxDelay: 30000 }
```

---

#### `checkMemoryUsage(currentMemoryMB: number): object`

Check if memory usage is within acceptable limits.

```typescript
const memoryCheck = checkMemoryUsage(300);
// {
//   withinLimit: true,   // Under 512 MB
//   isWarning: true,     // Over 256 MB warning threshold
//   isCritical: false    // Under 512 MB critical threshold
// }
```

---

#### `getEnvConfig(env?: string): object`

Get environment-specific configuration.

```typescript
// Auto-detect from NODE_ENV
const config = getEnvConfig();

// Explicit environment
const devConfig = getEnvConfig('development');
// { logLevel: 'debug', enableMetrics: true, verboseErrors: true, corsEnabled: true }

const prodConfig = getEnvConfig('production');
// { logLevel: 'info', enableMetrics: true, verboseErrors: false, corsEnabled: false }
```

---

## 💡 Examples

### Example 1: Robust API Client with Retries

```typescript
// apps/api/src/clients/external-api.client.ts
import { retryWithBackoff, extractErrorMessage, getTimeout } from '@dealscrapper/shared';
import axios from 'axios';

export class ExternalApiClient {
  async fetchData(endpoint: string): Promise<any> {
    try {
      const result = await retryWithBackoff(
        async () => {
          const response = await axios.get(endpoint, {
            timeout: getTimeout('HTTP')
          });
          return response.data;
        },
        3,    // Max 3 attempts
        1000  // Start with 1 second delay
      );

      return result;
    } catch (error) {
      const message = extractErrorMessage(error);
      throw new Error(`External API failed after retries: ${message}`);
    }
  }
}
```

### Example 2: Batch Processing with Rate Limiting

```typescript
// apps/scraper/src/processing/batch-processor.ts
import { delay, getBatchSize, COMMON_CONFIG } from '@dealscrapper/shared';

export class BatchProcessor {
  async processItems(items: any[]): Promise<void> {
    const batchSize = getBatchSize('DATABASE_BULK');

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      // Process batch
      await this.processBatch(batch);

      // Rate limiting: respect database
      await delay(COMMON_CONFIG.TIMEOUTS.QUICK);
    }
  }

  private async processBatch(batch: any[]): Promise<void> {
    // Batch processing logic
  }
}
```

### Example 3: Error Handling in Service

```typescript
// apps/notifier/src/email/email.service.ts
import { extractErrorMessage, safeStringify, retryWithBackoff } from '@dealscrapper/shared';

export class EmailService {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    try {
      await retryWithBackoff(
        async () => {
          await this.mailTransport.sendMail({ to, subject, html: body });
        },
        3,
        2000
      );

      this.logger.info('Email sent successfully', { to, subject });
    } catch (error) {
      // Safe error message extraction
      const message = extractErrorMessage(error);

      // Safe object stringification for logging
      const errorDetails = safeStringify(error);

      this.logger.error('Failed to send email', {
        to,
        subject,
        error: message,
        details: errorDetails
      });

      throw new Error(`Email sending failed: ${message}`);
    }
  }
}
```

### Example 4: Health Check with Timeouts

```typescript
// apps/api/src/health/api-health.service.ts
import { getTimeout, COMMON_CONFIG } from '@dealscrapper/shared';

export class ApiHealthService {
  async checkDatabase(): Promise<boolean> {
    const timeout = getTimeout('DATABASE');

    try {
      const result = await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async checkMemory(): Promise<{ healthy: boolean; usage: number }> {
    const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
    const check = checkMemoryUsage(memoryMB);

    return {
      healthy: check.withinLimit,
      usage: Math.round(memoryMB)
    };
  }
}
```

### Example 5: Scraping with Rate Limits

```typescript
// apps/scraper/src/scraper/dealabs-scraper.ts
import { delay, retryWithBackoff, COMMON_CONFIG } from '@dealscrapper/shared';

export class DealabsScraper {
  async scrapePages(numPages: number): Promise<any[]> {
    const results: any[] = [];
    const delayBetweenPages = COMMON_CONFIG.TIMEOUTS.QUICK; // 3 seconds

    for (let page = 1; page <= numPages; page++) {
      // Retry page scraping if it fails
      const pageDeals = await retryWithBackoff(
        async () => {
          return await this.scrapePage(page);
        },
        COMMON_CONFIG.RETRIES.MAX_ATTEMPTS,
        COMMON_CONFIG.RETRIES.BASE_DELAY
      );

      results.push(...pageDeals);

      // Respectful scraping: wait between pages
      if (page < numPages) {
        await delay(delayBetweenPages);
      }
    }

    return results;
  }

  private async scrapePage(page: number): Promise<any[]> {
    // Page scraping logic
    return [];
  }
}
```

## ✅ Best Practices

### Do's ✅

1. **Use `extractErrorMessage` for all error logging**

   ```typescript
   // ✅ GOOD - Safe error message extraction
   try {
     await operation();
   } catch (error) {
     logger.error('Operation failed', extractErrorMessage(error));
   }

   // ❌ BAD - Unsafe error handling
   catch (error) {
     logger.error('Operation failed', error.message); // Crashes if not Error
   }
   ```

2. **Use configuration constants over magic numbers**

   ```typescript
   // ✅ GOOD - Use constants
   await axios.get(url, { timeout: COMMON_CONFIG.TIMEOUTS.HTTP });

   // ❌ BAD - Magic number
   await axios.get(url, { timeout: 30000 });
   ```

3. **Use `retryWithBackoff` for flaky operations**

   ```typescript
   // ✅ GOOD - Automatic retries
   const data = await retryWithBackoff(() => fetchExternalApi());

   // ❌ BAD - No retry logic
   const data = await fetchExternalApi(); // Fails on first error
   ```

4. **Use appropriate batch sizes**

   ```typescript
   // ✅ GOOD - Use predefined batch sizes
   const batchSize = getBatchSize('DATABASE_BULK');

   // ❌ BAD - Arbitrary batch size
   const batchSize = 73; // Why 73?
   ```

5. **Use `safeStringify` for debugging**

   ```typescript
   // ✅ GOOD - Won't crash on circular refs
   logger.debug('Object state', safeStringify(obj));

   // ❌ BAD - Can throw on circular references
   logger.debug('Object state', JSON.stringify(obj));
   ```

### Don'ts ❌

1. **Don't create new retry logic**

   ```typescript
   // ❌ BAD - Reinventing the wheel
   let attempts = 0;
   while (attempts < 3) {
     try {
       return await operation();
     } catch {
       attempts++;
       await new Promise(r => setTimeout(r, 1000 * attempts));
     }
   }

   // ✅ GOOD - Use shared utility
   return await retryWithBackoff(operation, 3, 1000);
   ```

2. **Don't use console.error directly**

   ```typescript
   // ❌ BAD - No error extraction
   console.error('Error:', error);

   // ✅ GOOD - Safe message extraction
   console.error('Error:', extractErrorMessage(error));
   ```

3. **Don't hardcode delays**

   ```typescript
   // ❌ BAD - Magic number
   await new Promise(r => setTimeout(r, 5000));

   // ✅ GOOD - Use shared constant
   await delay(COMMON_CONFIG.TIMEOUTS.SHORT);
   ```

4. **Don't ignore memory warnings**

   ```typescript
   // ✅ GOOD - Check memory usage
   const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
   const check = checkMemoryUsage(memoryMB);

   if (check.isWarning) {
     logger.warn('High memory usage', { memoryMB });
   }

   // ❌ BAD - No memory monitoring
   // Just keep processing without checks
   ```

5. **Don't create service-specific versions**

   ```typescript
   // ❌ BAD - Duplicate utility
   function myExtractError(err: any) {
     return err?.message || 'Unknown';
   }

   // ✅ GOOD - Use shared utility
   import { extractErrorMessage } from '@dealscrapper/shared';
   ```

## 🔍 TypeScript

### Full Type Safety

All functions are fully typed with no `any` types:

```typescript
import type {
  TimeoutType,
  BatchSizeType,
  RetryType,
  RateLimitType
} from '@dealscrapper/shared';

// Type-safe timeout access
const timeout: number = getTimeout('HTTP'); // ✅ Autocomplete works

// Invalid type caught at compile time
const invalid = getTimeout('INVALID'); // ❌ Compile error
```

### Utility Types

```typescript
// Extract return types
type RetryResult<T> = ReturnType<typeof retryWithBackoff<T>>;

// Configuration types
type TimeoutConfig = typeof COMMON_CONFIG.TIMEOUTS;
type RetryConfig = typeof COMMON_CONFIG.RETRIES;
```

## 🔗 Related Packages

- [@dealscrapper/shared-logging](../shared-logging/README.md) - Uses `extractErrorMessage` for error logging
- [@dealscrapper/shared-repository](../shared-repository/README.md) - Uses retry logic for database operations
- All services use these utilities for consistency

## 🐛 Troubleshooting

### Issue: "retryWithBackoff never returns"

**Cause**: Operation keeps failing, maxAttempts too high

**Solution**: Check operation logs, reduce maxAttempts:
```typescript
// Limit attempts for faster failure
await retryWithBackoff(operation, 2, 1000);
```

---

### Issue: Type errors with COMMON_CONFIG

**Cause**: Trying to modify const values

**Solution**: COMMON_CONFIG is readonly:
```typescript
// ❌ BAD - Cannot modify
COMMON_CONFIG.TIMEOUTS.HTTP = 5000;

// ✅ GOOD - Create custom config
const customTimeout = 5000;
```

---

### Issue: Delay not working in tests

**Cause**: Tests don't wait for async operations

**Solution**: Use async/await in tests:
```typescript
it('should delay', async () => {
  const start = Date.now();
  await delay(100);
  const elapsed = Date.now() - start;
  expect(elapsed).toBeGreaterThanOrEqual(100);
});
```

## 📊 Package Statistics

- **~240 lines** of pure TypeScript code
- **Zero dependencies** (no external packages)
- **Zero runtime overhead** (tree-shakeable)
- Used by **all 5 services**
- **100% type coverage** (no `any` types)

## 📚 Further Reading

- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
- [Exponential Backoff Algorithm](https://en.wikipedia.org/wiki/Exponential_backoff)
- [Error Handling Best Practices](https://nodejs.org/en/docs/guides/error-handling/)
- [Rate Limiting Strategies](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

---

**🚀 Pure utilities powering all DealsScapper services - zero dependencies, maximum value!**
