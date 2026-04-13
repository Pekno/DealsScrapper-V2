# ❤️ @dealscrapper/shared-health

![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![Kubernetes Ready](https://img.shields.io/badge/Kubernetes-Ready-326CE5)
![Health Checks](https://img.shields.io/badge/Health-Checks-brightgreen)

> Standardized health check endpoints for Kubernetes readiness and liveness probes

## 📋 Overview

This package provides a standardized health check system for all DealsScapper services. It implements `/health`, `/ready`, and `/live` endpoints compatible with Kubernetes health probes, along with dependency monitoring for databases, Redis, and other external services.

**Key Benefits:**
- ✅ Kubernetes-compatible health endpoints
- ✅ Dependency status monitoring (database, Redis, etc.)
- ✅ Standardized health response format
- ✅ Easy service-specific customization
- ✅ Production-ready reliability checks

## 🎯 Scope

**Included:**
- ✅ `SharedHealthModule` - NestJS module with health endpoints
- ✅ `BaseHealthService` - Abstract service for health checks
- ✅ `BaseHealthController` - REST controller with `/health`, `/ready`, `/live`
- ✅ Standard health check interfaces
- ✅ Dependency status tracking

**NOT Included:**
- ❌ Service-specific business logic health (implement in services)
- ❌ Alerting/monitoring (use external tools like Prometheus)
- ❌ Metrics collection (use separate metrics package)

## 📦 Installation

```json
{
  "dependencies": {
    "@dealscrapper/shared-health": "workspace:*",
    "@dealscrapper/database": "workspace:*"
  }
}
```

## 🚀 Quick Start

### Setting Up Health Module

```typescript
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { SharedHealthModule } from '@dealscrapper/shared-health';
import { ApiHealthService } from './health/api-health.service';

@Module({
  imports: [
    SharedHealthModule.forRoot({
      serviceName: 'api',
      version: '1.0.0',
      healthService: ApiHealthService  // Your custom health service
    })
  ],
})
export class AppModule {}
```

### Creating Service-Specific Health Service

```typescript
// apps/api/src/health/api-health.service.ts
import { Injectable } from '@nestjs/common';
import { BaseHealthService, HealthData } from '@dealscrapper/shared-health';
import { PrismaService } from '@dealscrapper/database';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ApiHealthService extends BaseHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {
    super();
  }

  async getServiceHealth(): Promise<HealthData> {
    // Check all dependencies
    const dbHealthy = await this.checkDatabase();
    const redisHealthy = await this.checkRedis();

    // Determine overall status
    const allHealthy = dbHealthy && redisHealthy;

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      dependencies: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          responseTime: await this.getDatabaseResponseTime()
        },
        redis: {
          status: redisHealthy ? 'healthy' : 'unhealthy'
        }
      },
      custom: {
        activeConnections: await this.getActiveConnections(),
        memoryUsage: process.memoryUsage()
      }
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async getDatabaseResponseTime(): Promise<number> {
    const start = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    return Date.now() - start;
  }

  private async getActiveConnections(): Promise<number> {
    // Implementation specific to your service
    return 42;
  }
}
```

## 📖 API Reference

### Health Endpoints

Once configured, your service automatically exposes these endpoints:

#### GET /health

General health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "api",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "dependencies": {
    "database": {
      "status": "healthy",
      "responseTime": 12
    },
    "redis": {
      "status": "healthy"
    }
  }
}
```

#### GET /ready

Readiness probe - checks if service is ready to accept traffic.

**Kubernetes Usage:**
```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3001
  initialDelaySeconds: 10
  periodSeconds: 5
```

**Response:**
```json
{
  "ready": true,
  "checks": {
    "database": true,
    "redis": true
  }
}
```

#### GET /live

Liveness probe - checks if service is running (not deadlocked).

**Kubernetes Usage:**
```yaml
livenessProbe:
  httpGet:
    path: /live
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
```

**Response:**
```json
{
  "live": true,
  "uptime": 3600.5
}
```

---

### BaseHealthService

Abstract base class for implementing service-specific health checks.

#### Abstract Methods

##### `getServiceHealth(): Promise<HealthData>`

Implement this method to define your service's health check logic.

```typescript
async getServiceHealth(): Promise<HealthData> {
  return {
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    dependencies: { /* ... */ }
  };
}
```

---

### Types

#### HealthData

```typescript
interface HealthData {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  uptime: number;           // Process uptime in seconds
  dependencies?: {
    [key: string]: DependencyStatus;
  };
  custom?: {               // Service-specific data
    [key: string]: unknown;
  };
}
```

#### DependencyStatus

```typescript
interface DependencyStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;   // milliseconds
  message?: string;
  lastCheck?: Date;
}
```

#### StandardDependencies

Common dependency types:

```typescript
interface StandardDependencies {
  database?: DependencyStatus;
  redis?: DependencyStatus;
  elasticsearch?: DependencyStatus;
  queue?: DependencyStatus;
  external_api?: DependencyStatus;
}
```

---

## 💡 Examples

### Example 1: Scraper Service Health

```typescript
// apps/scraper/src/health/scraper-health.service.ts
import { Injectable } from '@nestjs/common';
import { BaseHealthService, HealthData } from '@dealscrapper/shared-health';
import { PrismaService } from '@dealscrapper/database';
import { PuppeteerPoolService } from '../puppeteer/puppeteer-pool.service';

@Injectable()
export class ScraperHealthService extends BaseHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService
  ) {
    super();
  }

  async getServiceHealth(): Promise<HealthData> {
    const dbHealthy = await this.checkDatabase();
    const poolHealthy = await this.checkPuppeteerPool();

    return {
      status: dbHealthy && poolHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      dependencies: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy'
        },
        puppeteer_pool: {
          status: poolHealthy ? 'healthy' : 'degraded',
          message: `${await this.puppeteerPool.getActiveCount()} active browsers`
        }
      },
      custom: {
        poolStats: await this.puppeteerPool.getStats(),
        lastScrapeAt: await this.getLastScrapeTime()
      }
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.scrapingJob.count();
      return true;
    } catch {
      return false;
    }
  }

  private async checkPuppeteerPool(): Promise<boolean> {
    return this.puppeteerPool.isHealthy();
  }

  private async getLastScrapeTime(): Promise<Date | null> {
    const lastJob = await this.prisma.scrapingJob.findFirst({
      orderBy: { startedAt: 'desc' }
    });
    return lastJob?.startedAt || null;
  }
}
```

### Example 2: Notifier Service with Email Health

```typescript
// apps/notifier/src/health/notifier-health.service.ts
import { Injectable } from '@nestjs/common';
import { BaseHealthService, HealthData } from '@dealscrapper/shared-health';
import { EmailService } from '../email/email.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class NotifierHealthService extends BaseHealthService {
  constructor(
    private readonly emailService: EmailService,
    private readonly wsGateway: WebSocketGateway
  ) {
    super();
  }

  async getServiceHealth(): Promise<HealthData> {
    const emailHealthy = await this.checkEmail();
    const wsHealthy = this.checkWebSocket();

    return {
      status: emailHealthy && wsHealthy ? 'healthy' : 'degraded',
      timestamp: new Date(),
      uptime: process.uptime(),
      dependencies: {
        email: {
          status: emailHealthy ? 'healthy' : 'unhealthy',
          message: emailHealthy ? 'SMTP connected' : 'SMTP unavailable'
        },
        websocket: {
          status: wsHealthy ? 'healthy' : 'degraded',
          message: `${this.wsGateway.getConnectedClients()} clients connected`
        }
      },
      custom: {
        pendingNotifications: await this.getPendingCount(),
        sentLast24h: await this.getSentCount()
      }
    };
  }

  private async checkEmail(): Promise<boolean> {
    return this.emailService.verifyConnection();
  }

  private checkWebSocket(): boolean {
    return this.wsGateway.isRunning();
  }

  private async getPendingCount(): Promise<number> {
    // Implementation
    return 0;
  }

  private async getSentCount(): Promise<number> {
    // Implementation
    return 0;
  }
}
```

### Example 3: Kubernetes Deployment with Health Checks

```yaml
# apps/api/k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dealscrapper-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: dealscrapper/api:latest
        ports:
        - containerPort: 3001

        # Readiness probe - when to start receiving traffic
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 10   # Wait 10s after start
          periodSeconds: 5          # Check every 5s
          timeoutSeconds: 3         # Fail if no response in 3s
          failureThreshold: 3       # Mark unready after 3 failures

        # Liveness probe - when to restart pod
        livenessProbe:
          httpGet:
            path: /live
            port: 3001
          initialDelaySeconds: 30   # Give service time to start
          periodSeconds: 10         # Check every 10s
          timeoutSeconds: 5         # Fail if no response in 5s
          failureThreshold: 3       # Restart after 3 failures

        # Startup probe - for slow-starting services
        startupProbe:
          httpGet:
            path: /health
            port: 3001
          failureThreshold: 30      # 30 * 10s = 5 minutes to start
          periodSeconds: 10
```

## ✅ Best Practices

### Do's ✅

1. **Check critical dependencies**
2. **Use degraded status for non-critical failures**
3. **Include response times for dependencies**
4. **Set appropriate probe intervals**
5. **Add service-specific metrics**

### Don'ts ❌

1. **Don't make health checks slow**
2. **Don't ignore health check failures**
3. **Don't set timeouts too low**
4. **Don't return sensitive information**
5. **Don't skip readiness checks**

## 🔗 Related Packages

- [@dealscrapper/database](../database/README.md) - Used for database health checks
- [@dealscrapper/shared-config](../shared-config/README.md) - Configuration for health module
- [@dealscrapper/shared-logging](../shared-logging/README.md) - Logging health check results

## 📚 Further Reading

- [Kubernetes Liveness and Readiness Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Health Checks Best Practices](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)
- [NestJS Terminus](https://docs.nestjs.com/recipes/terminus)

---

**🚀 Production-ready health checks for Kubernetes deployments!**
