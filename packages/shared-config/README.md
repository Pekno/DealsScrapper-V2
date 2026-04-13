# ⚙️ @dealscrapper/shared-config

![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![Type Safety](https://img.shields.io/badge/Type%20Safety-Strict-green)
![Validation](https://img.shields.io/badge/Validation-Required-brightgreen)

> Type-safe configuration management with strict environment variable validation

## 📋 Overview

This package provides centralized, type-safe configuration management for all DealsScapper services. It enforces strict validation of **REQUIRED** environment variables at startup, ensuring services cannot start with missing or invalid configuration.

**Key Benefits:**
- ✅ Services fail fast with missing environment variables
- ✅ Clear error messages show exactly what's missing
- ✅ Type-safe configuration access
- ✅ Computed configuration helpers (Database, Redis, JWT, Email)
- ✅ Consistent validation pattern across all services

## 🎯 Scope

**Included:**
- ✅ `SharedConfigModule` - NestJS global module for configuration
- ✅ `SharedConfigService` - Type-safe configuration service
- ✅ Startup environment variable validation
- ✅ Computed configuration getters (Database, Redis, JWT, Email)
- ✅ Environment detection utilities

**NOT Included:**
- ❌ Complex format validation (use Joi/Zod in services if needed)
- ❌ Dynamic configuration updates (config is immutable after startup)
- ❌ Secrets management (use external vault solutions)

## 📦 Installation

```json
{
  "dependencies": {
    "@dealscrapper/shared-config": "workspace:*"
  }
}
```

## 🚀 Quick Start

### Setting Up Configuration Module

```typescript
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { SharedConfigModule } from '@dealscrapper/shared-config';

@Module({
  imports: [
    SharedConfigModule.forRoot({
      serviceName: 'API',
      envConfig: {
        // Infrastructure
        NODE_ENV: 'REQUIRED',
        DATABASE_URL: 'REQUIRED',
        PORT: 'REQUIRED',
        LOG_LEVEL: 'REQUIRED',

        // Redis
        REDIS_HOST: 'REQUIRED',
        REDIS_PORT: 'REQUIRED',
        REDIS_DB: 'REQUIRED',
        REDIS_PASSWORD: 'OPTIONAL',  // Won't cause startup failure

        // Authentication
        JWT_SECRET: 'REQUIRED',
        JWT_EXPIRES_IN: 'REQUIRED',

        // External Services
        WEB_APP_URL: 'REQUIRED',
        SCHEDULER_URL: 'REQUIRED',
      },
    }),
    // ... other modules
  ],
})
export class AppModule {}
```

### Using SharedConfigService

```typescript
// apps/api/src/some.service.ts
import { Injectable } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';

@Injectable()
export class SomeService {
  constructor(private readonly config: SharedConfigService) {}

  async setupDatabase() {
    // Get single value
    const dbUrl = this.config.get('DATABASE_URL');

    // Or use computed configuration
    const dbConfig = this.config.getDatabaseConfig();
    // { url: '...', host: 'localhost', port: 5432, ... }
  }

  async setupRedis() {
    // Get Redis configuration object
    const redisConfig = this.config.getRedisConfig();
    // { host: 'localhost', port: 6379, db: 1, password?: '...' }

    // Or get Redis URL
    const redisUrl = this.config.getRedisUrl();
    // redis://localhost:6379/1
  }

  async checkEnvironment() {
    if (this.config.isProductionMode()) {
      // Production-specific logic
    }

    if (this.config.isDevelopmentMode()) {
      // Development-specific logic
    }
  }
}
```

## 📖 API Reference

### SharedConfigModule

NestJS module providing global configuration access.

#### `forRoot(options: ConfigModuleOptions): DynamicModule`

Register configuration module with environment variable validation.

**Options:**
```typescript
interface ConfigModuleOptions {
  serviceName: string;  // Service name for error messages
  envConfig: {
    [key: string]: 'REQUIRED' | 'OPTIONAL';
  };
}
```

**Example:**
```typescript
SharedConfigModule.forRoot({
  serviceName: 'API',
  envConfig: {
    DATABASE_URL: 'REQUIRED',
    REDIS_PASSWORD: 'OPTIONAL',
  },
});
```

---

### SharedConfigService

Injectable service for type-safe configuration access.

#### Core Methods

##### `get(key: string): string`

Get environment variable value. Throws if missing and was marked REQUIRED.

```typescript
const dbUrl = config.get('DATABASE_URL');
const jwtSecret = config.get('JWT_SECRET');
```

##### `getOrDefault(key: string, defaultValue: string): string`

Get environment variable with fallback (use sparingly, prefer REQUIRED).

```typescript
const logLevel = config.getOrDefault('LOG_LEVEL', 'info');
```

---

### Computed Configuration Methods

#### Database Configuration

##### `getDatabaseConfig(): DatabaseConfig`

Get complete database configuration parsed from DATABASE_URL.

```typescript
interface DatabaseConfig {
  url: string;       // Full connection URL
  host: string;      // Database host
  port: number;      // Database port
  database: string;  // Database name
  user: string;      // Username
}

const dbConfig = config.getDatabaseConfig();
// {
//   url: 'postgresql://user:pass@localhost:5432/dealscrapper',
//   host: 'localhost',
//   port: 5432,
//   database: 'dealscrapper',
//   user: 'user'
// }
```

##### `getDatabaseUrl(): string`

Get DATABASE_URL (alias for Prisma compatibility).

```typescript
const dbUrl = config.getDatabaseUrl();
// 'postgresql://user:pass@localhost:5432/dealscrapper'
```

---

#### Redis Configuration

##### `getRedisConfig(): RedisConfig`

Get Redis configuration from individual environment variables.

```typescript
interface RedisConfig {
  host: string;
  port: number;
  db: number;
  password?: string;  // Optional
}

const redisConfig = config.getRedisConfig();
// {
//   host: 'localhost',
//   port: 6379,
//   db: 1,
//   password: 'secret'  // if set
// }
```

##### `getRedisUrl(): string`

Build Redis connection URL.

```typescript
const redisUrl = config.getRedisUrl();
// Without password: 'redis://localhost:6379/1'
// With password: 'redis://secret@localhost:6379/1'
```

---

#### Redis Configuration with Connection Pool

The `RedisConfig` interface now supports advanced connection pool settings for production use.

##### Basic Configuration (Required)

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1
REDIS_PASSWORD=optional_password
```

##### Advanced Pool Configuration (Optional)

All connection pool settings have sensible defaults optimized for production. Override only when needed:

```bash
# Connection pool settings
REDIS_MAX_RETRIES_PER_REQUEST=3          # Max retries per command (default: 3)
REDIS_ENABLE_READY_CHECK=true            # Check connection before use (default: true)
REDIS_ENABLE_OFFLINE_QUEUE=true          # Queue commands when disconnected (default: true)

# Timeouts
REDIS_CONNECT_TIMEOUT=10000              # Connection timeout in ms (default: 10000)
REDIS_COMMAND_TIMEOUT=5000               # Command timeout in ms (default: 5000)

# Reconnection
REDIS_MAX_RECONNECT_ATTEMPTS=20          # Max reconnection attempts (default: 20)
REDIS_KEEP_ALIVE=30000                   # Keep-alive interval in ms (default: 30000)

# TLS/SSL (for production)
REDIS_TLS_ENABLED=false                  # Enable TLS (default: false)
REDIS_TLS_REJECT_UNAUTHORIZED=true       # Reject unauthorized certs (default: true)
```

##### Usage with ioredis

All pool settings are automatically applied when you pass the config to ioredis:

```typescript
import Redis from 'ioredis';
import { SharedConfigService } from '@dealscrapper/shared-config';

const config = sharedConfig.getRedisConfig();
const redis = new Redis(config);  // All pool settings automatically applied

// Connection pool with retry strategy is now active
redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('reconnecting', (time) => {
  console.log(`Reconnecting in ${time}ms...`);
});
```

##### Usage with BullMQ

BullMQ automatically benefits from the connection pool configuration:

```typescript
import { BullModule } from '@nestjs/bull';
import { SharedConfigService } from '@dealscrapper/shared-config';

BullModule.forRootAsync({
  useFactory: (sharedConfig: SharedConfigService) => ({
    redis: sharedConfig.getRedisConfig(),  // Includes pool config
  }),
  inject: [SharedConfigService],
})
```

##### Default Retry Strategy

The default retry strategy uses exponential backoff:
- First retry: 50ms
- Second retry: 100ms
- Third retry: 150ms
- ...
- Caps at: 3000ms (3 seconds)
- Gives up after: 20 attempts

You can customize the retry strategy by providing your own function:

```typescript
import {
  SharedConfigService,
  DEFAULT_REDIS_CONFIG,
  type RedisConfig
} from '@dealscrapper/shared-config';

// Custom retry strategy
const customRetryStrategy = (times: number): number | null => {
  if (times > 10) return null;  // Give up after 10 attempts
  return times * 100;  // 100ms, 200ms, 300ms...
};

const baseConfig = sharedConfig.getRedisConfig();
const customConfig: RedisConfig = {
  ...baseConfig,
  retryStrategy: customRetryStrategy,
  maxReconnectAttempts: 10,
};

const redis = new Redis(customConfig);
```

##### Production Best Practices

1. **Enable TLS in production:**
   ```bash
   REDIS_TLS_ENABLED=true
   REDIS_TLS_REJECT_UNAUTHORIZED=true
   ```

2. **Monitor reconnection attempts:**
   ```typescript
   redis.on('reconnecting', (time) => {
     logger.warn(`Redis reconnecting in ${time}ms`);
   });

   redis.on('error', (err) => {
     logger.error('Redis connection error', err);
   });
   ```

3. **Adjust timeouts for your use case:**
   - High-latency network: Increase `REDIS_CONNECT_TIMEOUT` and `REDIS_COMMAND_TIMEOUT`
   - Mission-critical operations: Increase `REDIS_MAX_RECONNECT_ATTEMPTS`
   - Fast-fail requirements: Decrease timeouts and max attempts

4. **Use connection pooling for multiple clients:**
   ```typescript
   // Each service instance can safely reuse the same Redis client
   // ioredis handles connection pooling internally
   @Injectable()
   export class RedisService {
     private readonly redis: Redis;

     constructor(private readonly config: SharedConfigService) {
       this.redis = new Redis(config.getRedisConfig());
     }

     async get(key: string): Promise<string | null> {
       return this.redis.get(key);
     }
   }
   ```

---

#### JWT Configuration

##### `getJwtConfig(): JwtConfig`

Get JWT configuration for authentication.

```typescript
interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshSecret?: string;
  refreshExpiresIn?: string;
}

const jwtConfig = config.getJwtConfig();
// {
//   secret: 'your-jwt-secret',
//   expiresIn: '15m',
//   refreshSecret: 'refresh-secret',  // if set
//   refreshExpiresIn: '7d'             // if set
// }
```

---

#### Email Configuration

##### `getEmailConfig(): EmailConfig`

Get email configuration (auto-detects Gmail OAuth2 vs MailHog).

```typescript
interface EmailConfig {
  service: 'gmail' | 'mailhog';
  transport: any;  // Nodemailer transport config
  from: {
    email: string;
    name: string;
  };
}

// Gmail OAuth2
const gmailConfig = config.getEmailConfig();
// {
//   service: 'gmail',
//   transport: {
//     service: 'gmail',
//     auth: {
//       type: 'OAuth2',
//       user: 'user@gmail.com',
//       clientId: '...',
//       clientSecret: '...',
//       refreshToken: '...'
//     }
//   },
//   from: { email: 'user@gmail.com', name: 'DealsScapper' }
// }

// MailHog (development)
const mailhogConfig = config.getEmailConfig();
// {
//   service: 'mailhog',
//   transport: {
//     host: 'localhost',
//     port: 1025,
//     ignoreTLS: true
//   },
//   from: { email: 'no-reply@dealscrapper.local', name: 'DealsScapper Dev' }
// }
```

---

### Service Utilities

##### `getServicePort(): number`

Get service-specific port (auto-detects from PORT, API_PORT, SCRAPER_PORT, etc.).

```typescript
const port = config.getServicePort();
// API service: 3001
// Scraper service: 3002
// Notifier service: 3003
```

##### `isTestMode(): boolean`

Check if running in test environment.

```typescript
if (config.isTestMode()) {
  // Use test database, mock external APIs
}
```

##### `isDevelopmentMode(): boolean`

Check if running in development environment.

```typescript
if (config.isDevelopmentMode()) {
  // Enable verbose logging, debug tools
}
```

##### `isProductionMode(): boolean`

Check if running in production environment.

```typescript
if (config.isProductionMode()) {
  // Enable strict security, disable debug features
}
```

---

## 💡 Examples

### Example 1: API Service Configuration

```typescript
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { SharedConfigModule } from '@dealscrapper/shared-config';

@Module({
  imports: [
    SharedConfigModule.forRoot({
      serviceName: 'API',
      envConfig: {
        // Infrastructure
        NODE_ENV: 'REQUIRED',
        DATABASE_URL: 'REQUIRED',
        PORT: 'REQUIRED',
        LOG_LEVEL: 'REQUIRED',
        APP_VERSION: 'REQUIRED',

        // Redis
        REDIS_HOST: 'REQUIRED',
        REDIS_PORT: 'REQUIRED',
        REDIS_DB: 'REQUIRED',
        REDIS_PASSWORD: 'OPTIONAL',

        // Authentication
        JWT_SECRET: 'REQUIRED',
        JWT_EXPIRES_IN: 'REQUIRED',
        EMAIL_VERIFICATION_SECRET: 'REQUIRED',
        EMAIL_VERIFICATION_EXPIRES_IN: 'REQUIRED',
        BCRYPT_ROUNDS: 'REQUIRED',

        // External Services
        WEB_APP_URL: 'REQUIRED',
        CORS_ORIGIN: 'REQUIRED',
        SCHEDULER_URL: 'REQUIRED',

        // Rate Limiting
        RATE_LIMIT_WINDOW_MS: 'REQUIRED',
        RATE_LIMIT_MAX_REQUESTS: 'REQUIRED',
      },
    }),
  ],
})
export class AppModule {}
```

### Example 2: BullMQ with Redis Configuration

```typescript
// apps/api/src/queue/queue.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SharedConfigService } from '@dealscrapper/shared-config';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: SharedConfigService) => ({
        redis: config.getRedisConfig(),  // ✅ Type-safe, validated
      }),
      inject: [SharedConfigService],
    }),
  ],
})
export class QueueModule {}
```

### Example 3: Prisma with Database Configuration

```typescript
// apps/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SharedConfigService } from '@dealscrapper/shared-config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly config: SharedConfigService) {
    super({
      datasources: {
        db: {
          url: config.getDatabaseUrl(),  // ✅ Validated at startup
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
```

### Example 4: JWT Authentication Setup

```typescript
// apps/api/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SharedConfigService } from '@dealscrapper/shared-config';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: SharedConfigService) => {
        const jwtConfig = config.getJwtConfig();

        return {
          secret: jwtConfig.secret,
          signOptions: {
            expiresIn: jwtConfig.expiresIn,
          },
        };
      },
      inject: [SharedConfigService],
    }),
  ],
})
export class AuthModule {}
```

### Example 5: Email Service Configuration

```typescript
// apps/notifier/src/email/email.service.ts
import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { SharedConfigService } from '@dealscrapper/shared-config';

@Injectable()
export class EmailService {
  private transporter;

  constructor(private readonly config: SharedConfigService) {
    const emailConfig = this.config.getEmailConfig();

    this.transporter = createTransport(emailConfig.transport);

    this.logger.log(
      `Email service initialized (${emailConfig.service})`,
      { from: emailConfig.from }
    );
  }

  async sendEmail(to: string, subject: string, html: string) {
    const emailConfig = this.config.getEmailConfig();

    await this.transporter.sendMail({
      from: `${emailConfig.from.name} <${emailConfig.from.email}>`,
      to,
      subject,
      html,
    });
  }
}
```

## ✅ Best Practices

### Do's ✅

1. **Mark critical variables as REQUIRED**

   ```typescript
   // ✅ GOOD - Critical variables are REQUIRED
   SharedConfigModule.forRoot({
     serviceName: 'API',
     envConfig: {
       DATABASE_URL: 'REQUIRED',  // Can't run without database
       JWT_SECRET: 'REQUIRED',    // Security critical
       REDIS_PASSWORD: 'OPTIONAL', // Development can run without it
     },
   });
   ```

2. **Use computed configuration helpers**

   ```typescript
   // ✅ GOOD - Use helpers
   const redisConfig = config.getRedisConfig();

   // ❌ BAD - Manual parsing
   const redisHost = config.get('REDIS_HOST');
   const redisPort = parseInt(config.get('REDIS_PORT'));
   const redisDb = parseInt(config.get('REDIS_DB'));
   ```

3. **Check environment in logic**

   ```typescript
   // ✅ GOOD - Environment-specific logic
   if (config.isProductionMode()) {
     // Strict CORS, rate limiting
   } else if (config.isDevelopmentMode()) {
     // Permissive CORS, verbose logging
   }
   ```

4. **Use SharedConfigService globally**

   ```typescript
   // ✅ GOOD - SharedConfigModule.forRoot makes it global
   @Module({
     imports: [SharedConfigModule.forRoot({ ... })],
   })
   export class AppModule {}

   // ✅ Can inject in any service
   @Injectable()
   export class AnyService {
     constructor(private config: SharedConfigService) {}
   }
   ```

5. **Document required environment variables**

   ```bash
   # ✅ GOOD - .env.example file
   # Database
   DATABASE_URL=postgresql://user:pass@localhost:5432/dealscrapper

   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_DB=1
   REDIS_PASSWORD=  # Optional

   # JWT
   JWT_SECRET=your-secret-here
   JWT_EXPIRES_IN=15m
   ```

### Don'ts ❌

1. **Don't use ConfigService directly**

   ```typescript
   // ❌ BAD - Using NestJS ConfigService directly
   import { ConfigService } from '@nestjs/config';

   constructor(private config: ConfigService) {
     const dbUrl = config.get('DATABASE_URL', 'fallback'); // Silent failures
   }

   // ✅ GOOD - Use SharedConfigService
   import { SharedConfigService } from '@dealscrapper/shared-config';

   constructor(private config: SharedConfigService) {
     const dbUrl = config.getDatabaseUrl(); // Validated at startup
   }
   ```

2. **Don't mark everything as OPTIONAL**

   ```typescript
   // ❌ BAD - Everything optional
   envConfig: {
     DATABASE_URL: 'OPTIONAL',  // Service needs database!
     JWT_SECRET: 'OPTIONAL',    // Security risk!
   }

   // ✅ GOOD - Mark critical as REQUIRED
   envConfig: {
     DATABASE_URL: 'REQUIRED',
     JWT_SECRET: 'REQUIRED',
     DEBUG_MODE: 'OPTIONAL',
   }
   ```

3. **Don't use fallback values for critical config**

   ```typescript
   // ❌ BAD - Silent failure if JWT_SECRET missing
   const jwtSecret = config.getOrDefault('JWT_SECRET', 'default-secret');

   // ✅ GOOD - Fails at startup if missing
   const jwtSecret = config.get('JWT_SECRET');
   ```

4. **Don't bypass validation**

   ```typescript
   // ❌ BAD - Direct process.env access bypasses validation
   const dbUrl = process.env.DATABASE_URL;

   // ✅ GOOD - Validated access
   const dbUrl = config.getDatabaseUrl();
   ```

5. **Don't modify configuration at runtime**

   ```typescript
   // ❌ BAD - Configuration should be immutable
   process.env.DATABASE_URL = 'new-value';

   // ✅ GOOD - Configuration is set once at startup
   // Use environment files for different environments
   ```

## 🔧 Configuration

### Environment File Strategy

Automatically selects environment files based on NODE_ENV:

```bash
.env                # Default (development)
.env.prod     # When NODE_ENV=production
.env.test           # When NODE_ENV=test
```

### Error Messages

Clear, actionable startup errors:

```bash
🔍 Validating API service configuration...
  ✔ NODE_ENV is PRESENT
  ✔ DATABASE_URL is PRESENT
  ❌ JWT_SECRET is REQUIRED but MISSING
  ✔ REDIS_HOST is PRESENT

❌ API service: Missing REQUIRED environment variables: JWT_SECRET
🚨 Service startup halted. Please check your environment variables.
```

### Service-Specific Ports

Auto-detects service port from environment:

```typescript
// API service looks for: PORT, API_PORT
// Scraper service looks for: SCRAPER_PORT, PORT
// Notifier service looks for: NOTIFIER_PORT, PORT
// Scheduler service looks for: SCHEDULER_PORT, PORT
```

## 🔍 TypeScript

### Full Type Safety

All configuration methods are fully typed:

```typescript
// ✅ Correct types enforced
const dbConfig: DatabaseConfig = config.getDatabaseConfig();
const redisConfig: RedisConfig = config.getRedisConfig();
const jwtConfig: JwtConfig = config.getJwtConfig();

// ✅ Boolean return types
const isProd: boolean = config.isProductionMode();
```

### Interface Definitions

```typescript
interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  database: string;
  user: string;
}

interface RedisConfig {
  // Basic connection
  host: string;
  port: number;
  db: number;
  password?: string;

  // Connection pool & performance (all optional with defaults)
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  enableOfflineQueue?: boolean;

  // Timeouts
  connectTimeout?: number;
  commandTimeout?: number;

  // Reconnection strategy
  retryStrategy?: (times: number) => number | null;
  maxReconnectAttempts?: number;
  reconnectOnError?: (err: Error) => boolean;

  // Keep-alive
  keepAlive?: number;

  // TLS/SSL
  tls?: {
    rejectUnauthorized?: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
}

interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshSecret?: string;
  refreshExpiresIn?: string;
}

interface EmailConfig {
  service: 'gmail' | 'mailhog';
  transport: any;
  from: {
    email: string;
    name: string;
  };
}
```

## 🔗 Related Packages

- [@dealscrapper/database](../database/README.md) - Uses getDatabaseUrl() for Prisma
- [@dealscrapper/shared-health](../shared-health/README.md) - Uses config for health endpoints
- [@dealscrapper/shared-logging](../shared-logging/README.md) - Uses config for log levels

## 🐛 Troubleshooting

### Issue: Service fails to start with "Missing REQUIRED environment variables"

**Cause**: Required environment variables not set

**Solution**:
1. Check error message for missing variables
2. Copy `.env.example` to `.env`
3. Fill in missing values
4. Restart service

```bash
# Check what's missing
pnpm dev:api

# Fix .env file
cp .env.example .env
# Edit .env with correct values

# Try again
pnpm dev:api
```

---

### Issue: "Cannot find module '@dealscrapper/shared-config'"

**Cause**: Package not built

**Solution**:
```bash
pnpm build
```

---

### Issue: Wrong database in test environment

**Cause**: NODE_ENV not set to 'test'

**Solution**:
```bash
# Set NODE_ENV in test scripts
NODE_ENV=test pnpm test
```

Or update `.env.test`:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/dealscrapper_test
```

## 📊 Benefits

### Before Migration (NestJS ConfigService)

```typescript
// ❌ Silent failures with fallbacks
const dbUrl = configService.get('DATABASE_URL', 'fallback');

// ❌ Manual parsing everywhere
const redisPort = parseInt(configService.get('REDIS_PORT', '6379'));

// ❌ No startup validation
// Service starts even with missing config
```

### After Migration (SharedConfigService)

```typescript
// ✅ Fails fast at startup
const dbUrl = config.getDatabaseUrl(); // Validated

// ✅ Type-safe computed config
const redisConfig = config.getRedisConfig(); // Parsed, validated

// ✅ Clear startup errors
// Service cannot start with missing REQUIRED variables
```

**Migration Benefits:**
- 🚫 No silent fallbacks
- 🎯 Full type safety
- 🔧 Simpler code
- 📝 Consistency across services
- 🐛 Better error messages
- 🧪 Easier testing

## 📚 Further Reading

- [12 Factor App - Config](https://12factor.net/config)
- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [Environment Variables Best Practices](https://www.ibm.com/cloud/blog/environment-variables)

---

**🚀 Type-safe, validated configuration for rock-solid DealsScapper services!**
