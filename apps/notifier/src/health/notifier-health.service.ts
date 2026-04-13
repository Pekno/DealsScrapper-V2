/**
 * @fileoverview Custom health service for notifier with WebSocket, delivery, and channel health checks
 * Extends the base health service with comprehensive notification system monitoring
 */

import { Injectable } from '@nestjs/common';
import { SharedConfigService } from '@dealscrapper/shared-config';
import {
  BaseHealthService,
  type DependencyStatus,
} from '@dealscrapper/shared-health';
import { NotificationGateway } from '../websocket/notification.gateway.js';
import { UserStatusService } from '../services/user-status.service.js';
import { DeliveryTrackingService } from '../services/delivery-tracking.service.js';
import { RateLimitingService } from '../services/rate-limiting.service.js';
import { EmailService } from '../channels/email.service.js';
import { TemplateService } from '../templates/template.service.js';
import { ChannelHealthService } from '../services/channel-health.service.js';

/**
 * Typed interface for notifier health data
 * Provides comprehensive monitoring data for the notification system
 */
export interface NotifierHealthData {
  websocket: {
    totalConnections: number;
    activeUsers: number;
  };
  userStatus: {
    totalOnline: number;
    totalActive: number;
    deviceBreakdown: Record<string, number>;
    connectionHealth: {
      staleConnections?: number;
      healthyConnections?: number;
    };
  };
  delivery: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    deliveryRate: number;
    typeBreakdown: Record<string, { total: number; successful: number }>;
    successRate: number;
  };
  security: {
    activeRateLimits: number;
    blacklistedUsers: number;
    suspiciousUsers: number;
  };
  channels: {
    email: {
      configured: boolean;
      healthy: boolean;
      provider?: string;
    };
    templates: {
      totalTemplates: number;
      registeredTemplates: string[];
    };
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    recommendedChannels: number;
    degradedChannels: number;
    failedChannels: number;
  };
}

/**
 * Custom health service for notifier with comprehensive notification system health checks
 * Provides monitoring for WebSocket connections, delivery tracking, channels, and security
 */
@Injectable()
export class NotifierHealthService extends BaseHealthService {
  constructor(
    private readonly websocketGateway: NotificationGateway,
    private readonly userStatusService: UserStatusService,
    private readonly deliveryTracking: DeliveryTrackingService,
    private readonly rateLimitingService: RateLimitingService,
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly channelHealthService: ChannelHealthService,
    private readonly sharedConfig: SharedConfigService
  ) {
    super({
      serviceName: 'notifier',
      version: sharedConfig.get<string>('APP_VERSION'),
      environment: sharedConfig.get<string>('NODE_ENV'),
    });

    // Register custom dependency health checkers
    this.registerHealthChecker('websocket', () => this.checkWebSocket());
    this.registerHealthChecker('email', () => this.checkEmailService());
    this.registerHealthChecker('templates', () => this.checkTemplates());
    this.registerHealthChecker('channels', () => this.checkChannels());
  }

  /**
   * Add notifier-specific data to the general /health endpoint
   * This includes all the rich monitoring data from the original health controller
   */
  protected async getCustomHealthData(): Promise<NotifierHealthData> {
    const connectionStats = this.websocketGateway.getConnectionStats();
    const statusStats = await this.userStatusService.getDetailedStats();
    const deliveryStats = await this.deliveryTracking.getOverallStats(24);
    const securityStats = await this.rateLimitingService.getGlobalStats();
    const channelHealth = await this.channelHealthService.getChannelHealth();

    return {
      websocket: {
        totalConnections: connectionStats.totalConnections,
        activeUsers: connectionStats.activeUsers,
      },
      userStatus: {
        totalOnline: statusStats.totalOnline,
        totalActive: statusStats.totalActive,
        deviceBreakdown: statusStats.deviceBreakdown,
        connectionHealth: statusStats.connectionHealth,
      },
      delivery: {
        totalDeliveries: deliveryStats.totalDeliveries,
        successfulDeliveries: deliveryStats.successfulDeliveries,
        failedDeliveries: deliveryStats.failedDeliveries,
        deliveryRate: deliveryStats.averageDeliveryRate,
        typeBreakdown: deliveryStats.typeBreakdown,
        successRate:
          deliveryStats.totalDeliveries > 0
            ? Math.round(
                (deliveryStats.successfulDeliveries /
                  deliveryStats.totalDeliveries) *
                  100
              )
            : 100,
      },
      security: {
        activeRateLimits: securityStats.activeRateLimits,
        blacklistedUsers: securityStats.blacklistedUsers,
        suspiciousUsers: securityStats.suspiciousUsers,
      },
      channels: {
        email: this.emailService.getProviderStatus(),
        templates: this.templateService.getTemplateStats(),
        overallHealth: channelHealth.overall,
        recommendedChannels: channelHealth.recommendedChannels?.length || 0,
        degradedChannels: channelHealth.degradedChannels?.length || 0,
        failedChannels: channelHealth.failedChannels?.length || 0,
      },
    };
  }

  /**
   * Check WebSocket gateway health
   */
  private async checkWebSocket(): Promise<DependencyStatus> {
    try {
      const connectionStats = this.websocketGateway.getConnectionStats();
      const statusStats = await this.userStatusService.getDetailedStats();

      // Check if WebSocket is functioning
      if (!connectionStats) {
        return 'unhealthy';
      }

      // Check for too many stale connections
      const staleConnections =
        statusStats.connectionHealth?.staleConnections || 0;
      const totalConnections = connectionStats.totalConnections || 0;

      if (totalConnections > 0 && staleConnections / totalConnections > 0.3) {
        return 'degraded';
      }

      return 'healthy';
    } catch (error) {
      this.logger.error('WebSocket health check failed:', error);
      return 'unhealthy';
    }
  }

  /**
   * Check email service health
   */
  private async checkEmailService(): Promise<DependencyStatus> {
    try {
      const providerStatus = this.emailService.getProviderStatus();

      if (!providerStatus || !providerStatus.healthy) {
        return 'unhealthy';
      }

      // If configured but not healthy, it's degraded
      if (providerStatus.configured && !providerStatus.healthy) {
        return 'degraded';
      }

      return 'healthy';
    } catch (error) {
      this.logger.error('Email service health check failed:', error);
      return 'unhealthy';
    }
  }

  /**
   * Check template system health
   */
  private async checkTemplates(): Promise<DependencyStatus> {
    try {
      const templateStats = this.templateService.getTemplateStats();

      if (!templateStats) {
        return 'unhealthy';
      }

      // Check if templates are compiling successfully
      const totalTemplates = templateStats.totalTemplates || 0;

      if (totalTemplates === 0) {
        return 'unhealthy';
      }

      // Check if we have registered templates
      if (templateStats.registeredTemplates.length === 0) {
        return 'degraded';
      }

      return 'healthy';
    } catch (error) {
      this.logger.error('Template system health check failed:', error);
      return 'unhealthy';
    }
  }

  /**
   * Check overall channel health
   */
  private async checkChannels(): Promise<DependencyStatus> {
    try {
      const channelHealth = await this.channelHealthService.getChannelHealth();

      if (!channelHealth) {
        return 'unhealthy';
      }

      // Use the channel health service's overall assessment
      switch (channelHealth.overall) {
        case 'healthy':
          return 'healthy';
        case 'degraded':
          return 'degraded';
        default:
          return 'unhealthy';
      }
    } catch (error) {
      this.logger.error('Channel health check failed:', error);
      return 'unhealthy';
    }
  }
}
