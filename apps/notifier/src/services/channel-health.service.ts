import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { EmailService } from '../channels/email.service.js';
import { NotificationGateway } from '../websocket/notification.gateway.js';
import { extractErrorMessage, withErrorHandling } from '../utils/error-handling.utils.js';
import { notifierLogConfig } from '../config/logging.config.js';

export interface ChannelHealthStatus {
  channel: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastChecked: Date;
  responseTime?: number;
  errorRate?: number;
  availability?: number;
  details?: {
    status?: string;
    error?: string;
    serverAvailable?: boolean;
    connectedUsers?: number;
  };
}

export interface ChannelHealthSummary {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  channels: ChannelHealthStatus[];
  recommendedChannels: string[];
  degradedChannels: string[];
  failedChannels: string[];
  lastUpdated: Date;
}

@Injectable()
export class ChannelHealthService implements OnModuleDestroy {
  private readonly logger = createServiceLogger(notifierLogConfig);
  private healthCache: Map<string, ChannelHealthStatus> = new Map();
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly HEALTH_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly emailService: EmailService,
    private readonly websocketGateway: NotificationGateway
  ) {
    // Start periodic health checks
    this.startPeriodicHealthChecks();
  }

  /**
   * Get current health status of all notification channels
   */
  async getChannelHealth(): Promise<ChannelHealthSummary> {
    const channels = await Promise.all([
      this.checkEmailHealth(),
      this.checkWebSocketHealth(),
    ]);

    const healthyChannels = channels.filter((c) => c.status === 'healthy');
    const degradedChannels = channels.filter((c) => c.status === 'degraded');
    const failedChannels = channels.filter((c) => c.status === 'unhealthy');

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChannels.length === channels.length) {
      overallStatus = 'unhealthy';
    } else if (degradedChannels.length > 0 || failedChannels.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    return {
      overall: overallStatus,
      channels,
      recommendedChannels: healthyChannels.map((c) => c.channel),
      degradedChannels: degradedChannels.map((c) => c.channel),
      failedChannels: failedChannels.map((c) => c.channel),
      lastUpdated: new Date(),
    };
  }

  /**
   * Get recommended channels based on health status and user context
   */
  async getRecommendedChannels(
    userId: string,
    priority: 'high' | 'normal' | 'low' = 'normal',
    userOnline: boolean = false
  ): Promise<string[]> {
    const healthSummary = await this.getChannelHealth();
    const recommendedChannels: string[] = [];

    // For high priority notifications, include degraded channels as fallbacks
    const availableChannels =
      priority === 'high'
        ? [
            ...healthSummary.recommendedChannels,
            ...healthSummary.degradedChannels,
          ]
        : healthSummary.recommendedChannels;

    // Priority logic based on user status
    if (userOnline && availableChannels.includes('websocket')) {
      recommendedChannels.push('websocket');
    }

    if (availableChannels.includes('email')) {
      recommendedChannels.push('email');
    }

    // Fallback: if no healthy channels, try degraded ones for high priority
    if (recommendedChannels.length === 0 && priority === 'high') {
      recommendedChannels.push(...healthSummary.degradedChannels);
    }

    this.logger.debug(
      `📋 Recommended channels for ${userId} (${priority}, online: ${userOnline}): ${recommendedChannels.join(', ')}`
    );

    return recommendedChannels;
  }

  /**
   * Check if a specific channel is available for delivery
   */
  async isChannelAvailable(channel: string): Promise<boolean> {
    const cached = this.healthCache.get(channel);

    if (cached && this.isCacheValid(cached.lastChecked)) {
      return cached.status === 'healthy' || cached.status === 'degraded';
    }

    // Force fresh health check for this channel
    let health: ChannelHealthStatus;
    switch (channel) {
      case 'email':
        health = await this.checkEmailHealth();
        break;
      case 'websocket':
        health = await this.checkWebSocketHealth();
        break;
      default:
        return false;
    }

    return health.status === 'healthy' || health.status === 'degraded';
  }

  /**
   * Record delivery success/failure for health metrics
   */
  async recordDeliveryAttempt(
    channel: string,
    success: boolean,
    responseTime: number
  ): Promise<void> {
    // This could update real-time health metrics
    // For now, just log for monitoring
    this.logger.debug(
      `📊 ${channel} delivery ${success ? 'success' : 'failure'} in ${responseTime}ms`
    );
  }

  private async checkEmailHealth(): Promise<ChannelHealthStatus> {
    const startTime = Date.now();

    return withErrorHandling(
      this.logger,
      'Email health check',
      async () => {
        // TODO: Verify actual SMTP connection via EmailService.getHealthStatus()
        // Currently assumes healthy status (email failures handled at send time)
        const health = { status: 'healthy' };
        const responseTime = Date.now() - startTime;

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (health.status === 'healthy') {
          status = 'healthy';
        } else if (health.status === 'degraded') {
          status = 'degraded';
        } else {
          status = 'unhealthy';
        }

        const channelHealth: ChannelHealthStatus = {
          channel: 'email',
          status,
          lastChecked: new Date(),
          responseTime,
          details: health,
        };

        this.healthCache.set('email', channelHealth);
        return channelHealth;
      },
      {
        throwOnError: false,
        fallbackValue: (() => {
          const channelHealth: ChannelHealthStatus = {
            channel: 'email',
            status: 'unhealthy',
            lastChecked: new Date(),
            responseTime: Date.now() - startTime,
            details: {
              error: 'Health check failed',
            },
          };
          this.healthCache.set('email', channelHealth);
          return channelHealth;
        })()
      }
    );
  }

  private async checkWebSocketHealth(): Promise<ChannelHealthStatus> {
    const startTime = Date.now();

    return withErrorHandling(
      this.logger,
      'WebSocket health check',
      async () => {
        // Check if WebSocket server is available and has connections
        const isServerAvailable = this.websocketGateway.server !== null;
        // TODO: Track active WebSocket connections via NotificationGateway.getConnectedUserCount()
        // Currently defaults to 0, health determined by server availability only
        const connectedUsers = 0;
        const responseTime = Date.now() - startTime;

        let status: 'healthy' | 'degraded' | 'unhealthy';
        if (isServerAvailable) {
          status = 'healthy';
        } else {
          status = 'unhealthy';
        }

        const channelHealth: ChannelHealthStatus = {
          channel: 'websocket',
          status,
          lastChecked: new Date(),
          responseTime,
          details: {
            serverAvailable: isServerAvailable,
            connectedUsers,
          },
        };

        this.healthCache.set('websocket', channelHealth);
        return channelHealth;
      },
      {
        throwOnError: false,
        fallbackValue: (() => {
          const channelHealth: ChannelHealthStatus = {
            channel: 'websocket',
            status: 'unhealthy',
            lastChecked: new Date(),
            responseTime: Date.now() - startTime,
            details: {
              error: 'Health check failed',
            },
          };
          this.healthCache.set('websocket', channelHealth);
          return channelHealth;
        })()
      }
    );
  }

  private startPeriodicHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.getChannelHealth();
        this.logger.debug('🔍 Periodic health check completed');
      } catch (error) {
        this.logger.error('❌ Periodic health check failed:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);

    this.logger.log('⏰ Started periodic health checks');
  }

  // Add cleanup method for tests
  onModuleDestroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.debug('🧹 Health check interval cleared');
    }
  }

  private isCacheValid(lastChecked: Date): boolean {
    return Date.now() - lastChecked.getTime() < this.HEALTH_CACHE_TTL;
  }

  /**
   * Get channel performance metrics
   */
  async getChannelMetrics(): Promise<{
    overall: string;
    channels: Record<string, {
      status: string;
      responseTime: number | undefined;
      availability: number;
      lastChecked: Date;
    }>;
    summary: {
      healthy: number;
      degraded: number;
      failed: number;
      total: number;
    };
  }> {
    const health = await this.getChannelHealth();

    return {
      overall: health.overall,
      channels: health.channels.reduce(
        (acc, channel) => {
          acc[channel.channel] = {
            status: channel.status,
            responseTime: channel.responseTime,
            availability: channel.availability || 100,
            lastChecked: channel.lastChecked,
          };
          return acc;
        },
        {} as Record<string, {
          status: string;
          responseTime: number | undefined;
          availability: number;
          lastChecked: Date;
        }>
      ),
      summary: {
        healthy: health.recommendedChannels.length,
        degraded: health.degradedChannels.length,
        failed: health.failedChannels.length,
        total: health.channels.length,
      },
    };
  }

  /**
   * Force health check refresh for all channels
   */
  async refreshHealthStatus(): Promise<ChannelHealthSummary> {
    this.healthCache.clear();
    return await this.getChannelHealth();
  }
}
