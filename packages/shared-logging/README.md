# 📝 @dealscrapper/shared-logging

![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![Winston](https://img.shields.io/badge/Winston-Logger-green)
![Production Ready](https://img.shields.io/badge/Production-Ready-brightgreen)

> Winston-based logging service with file rotation and service-specific loggers

## 📋 Overview

This package provides a centralized, production-ready logging solution for all DealsScapper services. Built on Winston, it offers structured logging with automatic file rotation, log levels, and service-specific configurations.

**Key Benefits:**
- ✅ Centralized logging configuration
- ✅ Automatic log file rotation (daily, size-based)
- ✅ Service-specific log files
- ✅ Multiple transports (console, file, error file)
- ✅ Structured JSON logging
- ✅ NestJS integration

## 🎯 Scope

**Included:**
- ✅ `EnhancedLoggerService` - NestJS-compatible logger
- ✅ `createServiceLogger()` - Factory for service-specific loggers
- ✅ File rotation with `winston-daily-rotate-file`
- ✅ Configurable log levels per environment
- ✅ Error-specific logging (separate error files)

**NOT Included:**
- ❌ Log aggregation (use external tools like ELK, Datadog)
- ❌ Remote logging endpoints (configure transports separately)
- ❌ Log analytics (use external tools)

## 📦 Installation

```json
{
  "dependencies": {
    "@dealscrapper/shared-logging": "workspace:*"
  }
}
```

## 🚀 Quick Start

### Creating a Service Logger

```typescript
import { createServiceLogger } from '@dealscrapper/shared-logging';

// Create logger for your service
const logger = createServiceLogger('api');

// Use it
logger.info('Server starting...', { port: 3001 });
logger.error('Database connection failed', { error: err.message });
logger.warn('High memory usage detected', { usage: '85%' });
logger.debug('Processing request', { userId, requestId });
```

### Using in NestJS Service

```typescript
import { Injectable } from '@nestjs/common';
import { EnhancedLoggerService } from '@dealscrapper/shared-logging';

@Injectable()
export class MyService {
  private readonly logger = new EnhancedLoggerService('MyService');

  async doSomething() {
    this.logger.log('Doing something...');

    try {
      // ... operation
      this.logger.log('Operation completed successfully');
    } catch (error) {
      this.logger.error('Operation failed', error.stack);
      throw error;
    }
  }
}
```

### Using as NestJS Logger

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { EnhancedLoggerService } from '@dealscrapper/shared-logging';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new EnhancedLoggerService('API'),  // ✅ Use as app logger
  });

  await app.listen(3001);
}

bootstrap();
```

## 📖 API Reference

### createServiceLogger(serviceName: string)

Factory function to create a Winston logger instance for a specific service.

**Parameters:**
- `serviceName` - Name of the service (e.g., 'api', 'scraper', 'notifier')

**Returns:** Winston `Logger` instance

**Example:**
```typescript
const logger = createServiceLogger('scraper');

logger.info('Starting scrape job', { jobId: '12345' });
logger.error('Scraping failed', { url, error: err.message });
```

**Log Files Created:**
- `apps/{serviceName}/logs/{serviceName}_combined.log` - All logs
- `apps/{serviceName}/logs/{serviceName}_error.log` - Error logs only
- Files rotate daily and when exceeding 20MB

---

### EnhancedLoggerService

NestJS-compatible logger service implementing `LoggerService` interface.

#### Constructor

```typescript
constructor(context?: string)
```

**Parameters:**
- `context` - Optional context name (e.g., service or class name)

#### Methods

##### `log(message: string, context?: string): void`

Log informational messages.

```typescript
logger.log('User created successfully', 'UserService');
```

##### `error(message: string, trace?: string, context?: string): void`

Log error messages with optional stack trace.

```typescript
logger.error('Database connection failed', error.stack, 'DatabaseService');
```

##### `warn(message: string, context?: string): void`

Log warning messages.

```typescript
logger.warn('Rate limit approaching', 'ApiService');
```

##### `debug(message: string, context?: string): void`

Log debug messages (only in development).

```typescript
logger.debug('Processing batch', 'BatchProcessor');
```

##### `verbose(message: string, context?: string): void`

Log verbose messages (very detailed logging).

```typescript
logger.verbose('Cache hit', 'CacheService');
```

---

### Log Levels

Default log levels by environment:

```typescript
// Production
level: process.env.LOG_LEVEL || 'info'
// Logs: error, warn, info

// Development (set LOG_LEVEL=debug)
level: 'debug'
// Logs: error, warn, info, debug

// Debugging (set LOG_LEVEL=verbose)
level: 'verbose'
// Logs: error, warn, info, debug, verbose
```

**Priority:** `error` > `warn` > `info` > `debug` > `verbose`

---

## 💡 Examples

### Example 1: API Service Logging

```typescript
// apps/api/src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { EnhancedLoggerService } from '@dealscrapper/shared-logging';

@Injectable()
export class UsersService {
  private readonly logger = new EnhancedLoggerService('UsersService');

  async createUser(email: string, password: string) {
    this.logger.log(`Creating user: ${email}`);

    try {
      const user = await this.userRepository.create({ email, password });

      this.logger.log(`User created successfully: ${user.id}`, {
        userId: user.id,
        email: user.email
      });

      return user;
    } catch (error) {
      this.logger.error(
        `Failed to create user: ${email}`,
        error.stack,
        'UsersService'
      );
      throw error;
    }
  }

  async deleteUser(userId: string) {
    this.logger.warn(`User deletion requested: ${userId}`, {
      userId,
      timestamp: new Date()
    });

    // ... deletion logic
  }
}
```

### Example 2: Scraper Service with Structured Logging

```typescript
// apps/scraper/src/scraper/scraper.service.ts
import { createServiceLogger } from '@dealscrapper/shared-logging';

export class ScraperService {
  private readonly logger = createServiceLogger('scraper');

  async scrapeDealabs() {
    const startTime = Date.now();

    this.logger.info('Starting Dealabs scrape', {
      source: 'dealabs',
      timestamp: new Date()
    });

    try {
      const deals = await this.extractDeals();

      this.logger.info('Scrape completed successfully', {
        dealsFound: deals.length,
        duration: Date.now() - startTime,
        source: 'dealabs'
      });

      return deals;
    } catch (error) {
      this.logger.error('Scrape failed', {
        error: error.message,
        stack: error.stack,
        source: 'dealabs',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  private extractDeals() {
    this.logger.debug('Extracting deals from HTML', {
      step: 'parsing'
    });

    // ... extraction logic
  }
}
```

### Example 3: Performance Monitoring

```typescript
// apps/api/src/common/interceptors/logging.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { EnhancedLoggerService } from '@dealscrapper/shared-logging';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new EnhancedLoggerService('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, ip } = request;
    const startTime = Date.now();

    this.logger.log(`Incoming request: ${method} ${url}`, {
      method,
      url,
      ip,
      userAgent: request.headers['user-agent']
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;

        this.logger.log(`Request completed: ${method} ${url}`, {
          method,
          url,
          duration,
          status: context.switchToHttp().getResponse().statusCode
        });

        // Warn on slow requests
        if (duration > 1000) {
          this.logger.warn(`Slow request detected: ${method} ${url}`, {
            duration,
            threshold: 1000
          });
        }
      })
    );
  }
}
```

### Example 4: Error Tracking with Context

```typescript
// apps/notifier/src/email/email.service.ts
import { Injectable } from '@nestjs/common';
import { EnhancedLoggerService } from '@dealscrapper/shared-logging';

@Injectable()
export class EmailService {
  private readonly logger = new EnhancedLoggerService('EmailService');

  async sendNotification(userId: string, dealId: string) {
    const context = { userId, dealId, timestamp: new Date() };

    this.logger.log('Sending email notification', context);

    try {
      await this.mailTransport.send({
        to: user.email,
        subject: 'New deal matched your filter!',
        // ... email content
      });

      this.logger.log('Email sent successfully', {
        ...context,
        recipient: user.email
      });
    } catch (error) {
      this.logger.error(
        'Email sending failed',
        error.stack,
        JSON.stringify({
          ...context,
          error: error.message,
          code: error.code
        })
      );

      // Re-throw for retry logic
      throw error;
    }
  }
}
```

### Example 5: Conditional Debug Logging

```typescript
// Only logs when LOG_LEVEL=debug
export class BatchProcessor {
  private readonly logger = new EnhancedLoggerService('BatchProcessor');

  async processBatch(items: any[]) {
    this.logger.debug(`Starting batch processing`, {
      batchSize: items.length,
      timestamp: new Date()
    });

    for (let i = 0; i < items.length; i++) {
      this.logger.debug(`Processing item ${i + 1}/${items.length}`, {
        item: items[i],
        progress: `${((i + 1) / items.length * 100).toFixed(1)}%`
      });

      await this.processItem(items[i]);
    }

    this.logger.debug('Batch processing complete');
  }
}
```

## ✅ Best Practices

### Do's ✅

1. **Use structured logging with context**

   ```typescript
   // ✅ GOOD - Structured with context
   logger.info('User login successful', {
     userId: user.id,
     email: user.email,
     ip: request.ip,
     timestamp: new Date()
   });

   // ❌ BAD - Unstructured string concatenation
   logger.info(`User ${user.email} logged in from ${request.ip}`);
   ```

2. **Use appropriate log levels**

   ```typescript
   // ✅ GOOD
   logger.error('Database connection failed', error.stack);  // Errors
   logger.warn('Cache miss, fetching from database');        // Warnings
   logger.info('Server started on port 3001');               // Info
   logger.debug('Processing user request', { userId });      // Debug

   // ❌ BAD - Everything as info
   logger.info('ERROR: Database failed');
   logger.info('WARNING: Cache miss');
   ```

3. **Include error stacks for errors**

   ```typescript
   // ✅ GOOD
   try {
     await operation();
   } catch (error) {
     logger.error('Operation failed', error.stack);
   }

   // ❌ BAD - No stack trace
   logger.error('Operation failed', error.message);
   ```

4. **Create service-specific loggers**

   ```typescript
   // ✅ GOOD - Each service has its own logger
   const apiLogger = createServiceLogger('api');
   const scraperLogger = createServiceLogger('scraper');

   // ❌ BAD - Shared logger loses context
   const logger = createServiceLogger('app');
   ```

5. **Use logger in main.ts**

   ```typescript
   // ✅ GOOD - NestJS uses your logger
   const app = await NestFactory.create(AppModule, {
     logger: new EnhancedLoggerService('API')
   });

   // ❌ BAD - Uses default NestJS logger
   const app = await NestFactory.create(AppModule);
   ```

### Don'ts ❌

1. **Don't use console.log in production**

   ```typescript
   // ❌ BAD - No file logging, no structure
   console.log('User created:', user);

   // ✅ GOOD - Structured logging with file rotation
   logger.info('User created', { userId: user.id });
   ```

2. **Don't log sensitive data**

   ```typescript
   // ❌ BAD - Logs password!
   logger.info('User login', { email, password });

   // ✅ GOOD - No sensitive data
   logger.info('User login', { email });
   ```

3. **Don't log too verbosely in production**

   ```typescript
   // ❌ BAD - Spam in production
   items.forEach(item => {
     logger.info('Processing item', item);  // 1000s of logs
   });

   // ✅ GOOD - Debug level or batch logging
   logger.debug('Processing batch', { count: items.length });
   // ... process items ...
   logger.info('Batch processed', { processed: items.length });
   ```

4. **Don't create new logger instances unnecessarily**

   ```typescript
   // ❌ BAD - New logger per method call
   async createUser() {
     const logger = new EnhancedLoggerService('UsersService');
     logger.log('Creating user');
   }

   // ✅ GOOD - Reuse class-level logger
   export class UsersService {
     private readonly logger = new EnhancedLoggerService('UsersService');

     async createUser() {
       this.logger.log('Creating user');
     }
   }
   ```

5. **Don't ignore log rotation limits**

   ```typescript
   // ✅ GOOD - Files rotate automatically
   // Default: 20MB max file size, 14 days retention

   // ⚠️ If you need custom rotation, configure it properly
   ```

## 🔧 Configuration

### Environment Variables

```bash
# Set log level (error | warn | info | debug | verbose)
LOG_LEVEL=info         # Production default
LOG_LEVEL=debug        # Development
LOG_LEVEL=verbose      # Detailed debugging
```

### Log File Locations

Logs are automatically created in:

```
apps/{serviceName}/logs/
  ├── {serviceName}_combined.log      # All logs (info, warn, error, debug)
  ├── {serviceName}_error.log         # Error logs only
  ├── {serviceName}_combined-YYYY-MM-DD.log  # Rotated files
  └── {serviceName}_error-YYYY-MM-DD.log     # Rotated error files
```

**Examples:**
```
apps/api/logs/
  ├── api_combined.log
  ├── api_error.log
  └── api_combined-2025-01-15.log

apps/scraper/logs/
  ├── scraper_combined.log
  ├── scraper_error.log
  └── scraper_error-2025-01-15.log
```

### Rotation Settings

Default configuration:
- **Max file size:** 20MB
- **Max files:** 14 (days)
- **Rotation:** Daily at midnight
- **Compression:** Gzip for old files

## 🔍 TypeScript

### Logger Types

```typescript
import { Logger } from 'winston';
import type { IEnhancedLogger, LoggerOptions } from '@dealscrapper/shared-logging';

// Winston logger type
const logger: Logger = createServiceLogger('api');

// NestJS logger service
const nestLogger: IEnhancedLogger = new EnhancedLoggerService('API');
```

### Type-Safe Log Metadata

```typescript
interface LogContext {
  userId?: string;
  requestId?: string;
  timestamp: Date;
  [key: string]: unknown;
}

function logWithContext(message: string, context: LogContext) {
  logger.info(message, context);
}
```

## 🔗 Related Packages

- [@dealscrapper/shared-config](../shared-config/README.md) - Configuration for log levels
- [@dealscrapper/shared](../shared/README.md) - Error extraction utilities

## 🐛 Troubleshooting

### Issue: Logs not appearing

**Cause**: Log level too high

**Solution**:
```bash
# Lower log level to see more logs
LOG_LEVEL=debug pnpm dev:api
```

---

### Issue: Log files growing too large

**Cause**: Rotation not working or too verbose logging

**Solution**:
1. Check rotation configuration
2. Reduce logging verbosity in production
3. Use debug level only in development

---

### Issue: "Cannot find module 'winston'"

**Cause**: Dependencies not installed

**Solution**:
```bash
pnpm install
```

---

### Issue: Logs appearing twice (console + file)

**Cause**: This is intentional - logs go to both transports

**To disable console in production:**
```typescript
// Configure in logger.service.ts
const transports = [
  new winston.transports.DailyRotateFile({ ... }),
  // Remove or conditionally add console transport
];
```

## 📊 Log Statistics

Production log volume (example):
- **API service:** ~500 MB/day (info level)
- **Scraper service:** ~1 GB/day (includes debug for scraping)
- **Notifier service:** ~200 MB/day

Retention: 14 days (configurable)

## 📚 Further Reading

- [Winston Documentation](https://github.com/winstonjs/winston)
- [NestJS Logging](https://docs.nestjs.com/techniques/logger)
- [Winston Daily Rotate File](https://github.com/winstonjs/winston-daily-rotate-file)
- [12 Factor App - Logs](https://12factor.net/logs)

---

**🚀 Production-ready logging for all DealsScapper services!**
