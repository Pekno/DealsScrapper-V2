/**
 * @fileoverview Custom health service for API with authentication and database health checks
 * Extends the base health service with database and authentication monitoring
 */

import { Injectable, Optional } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { JwtService } from '@nestjs/jwt';
import {
  BaseHealthService,
  type DependencyStatus,
} from '@dealscrapper/shared-health';
import { PrismaService } from '@dealscrapper/database';

// Type definitions for health check responses
interface JwtPayload {
  test: boolean;
  iat: number;
  [key: string]: unknown;
}

/**
 * Custom health service for API with authentication and database health checks
 * Provides comprehensive health monitoring for API operations and its direct dependencies
 */
@Injectable()
export class ApiHealthService extends BaseHealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly jwtService: JwtService | null,
    private readonly sharedConfig: SharedConfigService
  ) {
    super({
      serviceName: 'api',
      version: sharedConfig.get<string>('APP_VERSION'),
      environment: sharedConfig.get<string>('NODE_ENV'),
    });

    // Register custom dependency health checkers
    this.registerHealthChecker('database', () => this.checkDatabase());

    // Only register authentication health checker if JwtService is available
    // JwtService may be null when created via factory before AuthModule loads
    if (this.jwtService) {
      this.registerHealthChecker('authentication', () =>
        this.checkAuthentication()
      );
    } else {
      this.logger.debug(
        'JwtService not available - skipping authentication health checker registration'
      );
    }

    // Note: externalServices (scheduler/worker pool) check removed
    // The API doesn't directly depend on workers - it only needs database and auth
    // Worker pool health is the scheduler's responsibility to report
  }

  /**
   * Add API-specific data to the general /health endpoint
   */
  protected async getCustomHealthData(): Promise<Record<string, unknown>> {
    const dbStats = await this.getDatabaseStats();
    const authStats = await this.getAuthenticationStats();

    return {
      database: {
        ...dbStats,
        tablesHealthy: await this.checkRequiredTables(),
      },
      authentication: {
        ...authStats,
        jwtConfigured: this.isJwtConfigured(),
      },
      api: {
        endpoints: this.getEndpointStats(),
        rateLimiting: this.getRateLimitingStatus(),
        cors: this.getCorsStatus(),
      },
      performance: {
        responseTime: this.getAverageResponseTime(),
        throughput: this.getThroughputMetrics(),
        errorRate: this.getErrorRate(),
      },
    };
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;

      // Check if required tables exist
      const tablesHealthy = await this.checkRequiredTables();
      if (!tablesHealthy) {
        return 'unhealthy';
      }

      // Database is degraded if response time > 1 second
      if (responseTime > 1000) {
        return 'degraded';
      }

      return 'healthy';
    } catch (error) {
      const errorObj = error as Error & { code?: string };
      this.logger.error('Database health check failed:', {
        error: error instanceof Error ? error.message : String(error),
        code: errorObj.code,
        stack: errorObj.stack?.split('\n')?.[0], // First line for context
        timestamp: new Date().toISOString(),
      });
      return 'unhealthy';
    }
  }

  /**
   * Check authentication system health
   */
  private async checkAuthentication(): Promise<DependencyStatus> {
    try {
      // If JwtService is not available, report as degraded
      if (!this.jwtService) {
        this.logger.warn('JwtService not available for authentication health check');
        return 'degraded';
      }

      // Test JWT functionality
      const testPayload = { test: true, iat: Math.floor(Date.now() / 1000) };
      const token = this.jwtService.sign(testPayload);
      const decoded = this.jwtService.verify(token) as JwtPayload;

      if (!decoded || !decoded.test) {
        return 'unhealthy';
      }

      // Check recent failed login attempts
      const recentFailures = await this.getRecentFailedLogins();
      if (recentFailures > 100) {
        return 'degraded';
      }

      return 'healthy';
    } catch (error) {
      this.logger.error('Authentication health check failed:', {
        error: error instanceof Error ? error.message : String(error),
        jwtConfigured: this.isJwtConfigured(),
        timestamp: new Date().toISOString(),
        context: 'JWT token generation/verification test',
      });
      return 'unhealthy';
    }
  }

  /**
   * Get database statistics
   */
  private async getDatabaseStats(): Promise<Record<string, unknown>> {
    try {
      const userCount = await this.prisma.user.count();
      const filterCount = await this.prisma.filter.count();
      const sessionCount = await this.prisma.userSession.count();

      return {
        totalUsers: userCount,
        totalFilters: filterCount,
        activeSessions: sessionCount,
        connectionPool: {
          // This would come from your database connection pool
          active: 5,
          idle: 2,
          total: 10,
        },
      };
    } catch {
      return {};
    }
  }

  /**
   * Get authentication statistics
   */
  private async getAuthenticationStats(): Promise<Record<string, unknown>> {
    try {
      const activeSessionsCount = await this.prisma.userSession.count({
        where: {
          expiresAt: { gt: new Date() },
        },
      });

      return {
        activeSessions: activeSessionsCount,
        recentLogins: await this.getRecentLogins(),
        failedAttempts: await this.getRecentFailedLogins(),
      };
    } catch {
      return {};
    }
  }

  /**
   * Check if required database tables exist
   */
  private async checkRequiredTables(): Promise<boolean> {
    try {
      // Simple check - try to query each required table
      await this.prisma.user.findFirst();
      await this.prisma.filter.findFirst();
      await this.prisma.userSession.findFirst();
      await this.prisma.category.findFirst();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if JWT is properly configured
   */
  private isJwtConfigured(): boolean {
    try {
      if (!this.jwtService) {
        return false;
      }
      const testPayload = { test: true };
      const token = this.jwtService.sign(testPayload);
      return !!token;
    } catch {
      return false;
    }
  }

  /**
   * Get recent login count
   */
  private async getRecentLogins(): Promise<number> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return await this.prisma.user.count({
        where: {
          lastLoginAt: { gte: oneDayAgo },
        },
      });
    } catch {
      return 0;
    }
  }

  /**
   * Get recent failed login attempts
   */
  private async getRecentFailedLogins(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return await this.prisma.user.count({
        where: {
          loginAttempts: { gt: 0 },
          updatedAt: { gte: oneHourAgo },
        },
      });
    } catch {
      return 0;
    }
  }

  /**
   * Get endpoint statistics
   */
  private getEndpointStats(): Record<string, unknown> {
    // This would come from your API metrics/logging system
    return {
      totalEndpoints: 25,
      healthyEndpoints: 24,
      deprecatedEndpoints: 1,
    };
  }

  /**
   * Get rate limiting status
   */
  private getRateLimitingStatus(): Record<string, unknown> {
    return {
      enabled: true,
      globalLimit: '100 requests/minute',
      authLimit: '1000 requests/hour',
    };
  }

  /**
   * Get CORS configuration status
   */
  private getCorsStatus(): Record<string, unknown> {
    const corsOrigin = this.sharedConfig.get<string>('CORS_ORIGIN');
    return {
      enabled: true,
      origins: corsOrigin.split(',').map((origin) => origin.trim()),
    };
  }

  /**
   * Get average API response time
   */
  // TODO: Replace hardcoded placeholder metrics (getAverageResponseTime, getThroughputMetrics, getErrorRate) with real metrics collection
  private getAverageResponseTime(): number {
    // This would query your metrics/logging system
    return 150; // milliseconds
  }

  /**
   * Get API throughput metrics
   */
  private getThroughputMetrics(): Record<string, number> {
    // This would query your metrics/logging system
    return {
      requestsPerMinute: 100,
      requestsPerHour: 6000,
    };
  }

  /**
   * Get API error rate
   */
  private getErrorRate(): number {
    // This would query your metrics/logging system
    return 2.5; // percentage
  }
}
