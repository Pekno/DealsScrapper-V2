import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { UseGuards, Inject } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { UnifiedNotificationPayload } from '@dealscrapper/shared-types';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UserStatusService } from '../services/user-status.service.js';
import { ActivityTrackingService } from '../services/activity-tracking.service.js';
import { RateLimitingService } from '../services/rate-limiting.service.js';
import { DeliveryTrackingService } from '../services/delivery-tracking.service.js';
import { EmailService } from '../channels/email.service.js';
import { notifierLogConfig } from '../config/logging.config.js';

import { withErrorHandling } from '../utils/error-handling.utils.js';

export interface ActivityMetadata {
  readonly page?: string;
  readonly elementId?: string;
  readonly elementType?: string;
  readonly coordinates?: { readonly x: number; readonly y: number };
  readonly scrollPosition?: { readonly x: number; readonly y: number };
  readonly keyPressed?: string;
  readonly clickType?: 'left' | 'right' | 'middle';
  readonly focusTarget?: string;
  readonly visibilityState?: 'visible' | 'hidden';
  readonly sessionId?: string;
  readonly deviceType?: 'web' | 'mobile';
  readonly browserInfo?: string;
  // Restrict additional activity data for security
  readonly [key: string]:
    | string
    | number
    | boolean
    | { readonly [key: string]: unknown }
    | undefined;
}
import { NotificationPreferencesService } from '../services/notification-preferences.service.js';
import { PrismaService } from '@dealscrapper/database';
import { SharedConfigService } from '@dealscrapper/shared-config';

interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  frequency: 'immediate' | 'digest' | 'weekly';
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  categories: {
    dealMatch: boolean;
    digest: boolean;
    system: boolean;
  };
}

interface UserConnection {
  userId: string;
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
  deviceInfo: {
    type: 'web' | 'mobile';
    userAgent: string;
    ip: string;
  };
  isActive: boolean;
  reconnectAttempts: number;
  heartbeatInterval?: NodeJS.Timeout;
}

interface ConnectionRateLimit {
  attempts: number;
  lastAttempt: Date;
  isBlocked: boolean;
  blockUntil?: Date;
}

interface WebSocketNotification {
  readonly type: 'deal-match' | 'system' | 'digest';
  readonly data: Record<string, unknown>;
  readonly priority: 'high' | 'normal' | 'low';
  readonly timestamp: Date;
}

// Note: Decorator configuration is evaluated at class definition time,
// before DI container initialization. Therefore, direct process.env access
// is required here (SharedConfigService not yet available).
// CORS origins are environment-based: WEB_APP_URL for production, localhost for development
const webSocketCorsOrigins = process.env.WEB_APP_URL
  ? [process.env.WEB_APP_URL, 'http://localhost:3000']
  : ['http://localhost:3000', 'http://localhost:3001'];

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: webSocketCorsOrigins,
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = createServiceLogger(notifierLogConfig);
  private activeConnections = new Map<string, UserConnection>();
  private readonly MAX_CONNECTIONS_PER_USER = 3;

  constructor(
    private readonly jwtService: JwtService,
    private readonly userStatusService: UserStatusService,
    private readonly activityTrackingService: ActivityTrackingService,
    private readonly rateLimitingService: RateLimitingService,
    private readonly notificationPreferencesService: NotificationPreferencesService,
    private readonly prisma: PrismaService,
    private readonly deliveryTrackingService: DeliveryTrackingService,
    private readonly emailService: EmailService,
    @Inject(SharedConfigService) private readonly sharedConfig: SharedConfigService
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    this.logger.log(`New WebSocket connection: ${client.id}`);

    try {
      // Extract token from handshake
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.warn(`No token provided for connection ${client.id}`);
        client.disconnect();
        return;
      }

      // Check connection rate limiting
      const rateLimitResult =
        await this.rateLimitingService.checkConnectionRateLimit(
          client.handshake.address
        );
      if (!rateLimitResult.allowed) {
        this.logger.warn(
          `Rate limited connection from ${client.handshake.address}`
        );
        client.emit('error', {
          code: 'RATE_LIMITED',
          message: 'Too many connection attempts',
          retryAfter: rateLimitResult.retryAfter,
        });
        client.disconnect();
        return;
      }

      // Check if IP is blacklisted
      if (
        await this.rateLimitingService.isBlacklisted(client.handshake.address)
      ) {
        const blacklistInfo = await this.rateLimitingService.getBlacklistInfo(
          client.handshake.address
        );
        this.logger.warn(
          `Blacklisted connection attempt from ${client.handshake.address}: ${blacklistInfo.reason}`
        );
        client.emit('error', {
          code: 'BLACKLISTED',
          message: 'Access denied',
          expiresAt: blacklistInfo.expiresAt,
        });
        client.disconnect();
        return;
      }

      // Validate JWT token
      const payload = await this.validateToken(token);

      if (!payload || !payload.userId) {
        this.logger.warn(`Invalid token for connection ${client.id}`);
        client.emit('auth_error', {
          code: 'INVALID_TOKEN',
          message: 'Authentication failed',
        });
        await this.rateLimitingService.recordSuspiciousActivity(
          client.handshake.address,
          'invalid_auth',
          { userAgent: client.handshake.headers['user-agent'] }
        );
        client.disconnect();
        return;
      }

      // Verify user exists in database
      const user = await this.verifyUserExists(payload.userId);
      if (!user) {
        this.logger.warn(`User ${payload.userId} not found in database`);
        client.emit('error', {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
        client.disconnect();
        return;
      }

      // Check if user has too many connections
      if (await this.hasExceededConnectionLimit(payload.userId)) {
        this.logger.warn(`User ${payload.userId} exceeded connection limit`);
        await this.rateLimitingService.recordSuspiciousActivity(
          payload.userId,
          'rapid_connections',
          { ip: client.handshake.address }
        );
        client.emit('error', {
          code: 'CONNECTION_LIMIT',
          message: 'Maximum connections exceeded',
        });
        client.disconnect();
        return;
      }

      // Store connection info
      const connection: UserConnection = {
        userId: payload.userId,
        socketId: client.id,
        connectedAt: new Date(),
        lastActivity: new Date(),
        deviceInfo: {
          type: this.detectDeviceType(client.handshake.headers['user-agent']),
          userAgent: client.handshake.headers['user-agent'] || 'unknown',
          ip: client.handshake.address || 'unknown',
        },
        isActive: true,
        reconnectAttempts: 0,
      };

      // Start heartbeat for connection persistence
      connection.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat(client, payload.userId);
      }, 30000); // 30 seconds

      // Store connection with user ID as key for single connection per user
      // If user already has a connection, disconnect the old one
      const existingConnection = this.activeConnections.get(payload.userId);
      if (existingConnection && existingConnection.heartbeatInterval) {
        clearInterval(existingConnection.heartbeatInterval);
        // Notify and disconnect existing connection
        this.server.to(existingConnection.socketId).emit('replaced', {
          message: 'Connection replaced by new session',
        });

        // Use safer approach to disconnect
        try {
          const existingSocket = this.server.sockets.sockets.get(
            existingConnection.socketId
          );
          if (existingSocket) {
            existingSocket.disconnect();
          }
        } catch (disconnectError: unknown) {
          const errorMessage = disconnectError instanceof Error ? disconnectError.message : String(disconnectError);
          this.logger.warn(
            `Could not disconnect existing socket: ${errorMessage}`
          );
        }
      }

      this.activeConnections.set(payload.userId, connection);

      // Store user metadata for connection tracking
      client.data = {
        userId: payload.userId,
        authenticatedAt: new Date(),
        userEmail: user.email,
      };

      // Join user-specific room
      client.join(`user-${payload.userId}`);

      // Update status in Redis
      await this.userStatusService.updateUserStatus(payload.userId, {
        isOnline: true,
        isActive: true,
        lastActivity: new Date(),
        deviceType: connection.deviceInfo.type,
        socketId: client.id,
      });

      this.logger.log(`User ${payload.userId} authenticated and connected`);

      // Send connection confirmation with user preferences
      client.emit('connected', {
        status: 'connected',
        userId: payload.userId,
        timestamp: new Date(),
        connectionId: client.id,
        serverTime: new Date(),
        features: {
          heartbeat: true,
          reconnection: true,
          preferences: true,
        },
      });

      // Send user preferences for notification filtering
      const preferences = await this.getUserNotificationPreferences(
        payload.userId
      );
      client.emit('preferences', preferences);
    } catch (error) {
      this.logger.error(
        `Error handling connection ${client.id}: ${error.message}`
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Find and remove user connection
    const userId = client.data?.userId;
    if (userId) {
      const connection = this.activeConnections.get(userId);
      if (connection && connection.socketId === client.id) {
        // Clear heartbeat interval
        if (connection.heartbeatInterval) {
          clearInterval(connection.heartbeatInterval);
        }

        this.activeConnections.delete(userId);

        // Update status in Redis
        await this.userStatusService.updateUserStatus(userId, {
          isOnline: false,
          isActive: false,
          lastActivity: new Date(),
          deviceType: connection.deviceInfo.type,
          socketId: null,
        });

        this.logger.log(`User ${userId} disconnected`);
      }
    } else {
      // Fallback: search by socket ID
      for (const [uid, connection] of this.activeConnections.entries()) {
        if (connection.socketId === client.id) {
          if (connection.heartbeatInterval) {
            clearInterval(connection.heartbeatInterval);
          }
          this.activeConnections.delete(uid);

          await this.userStatusService.updateUserStatus(uid, {
            isOnline: false,
            isActive: false,
            lastActivity: new Date(),
            deviceType: connection.deviceInfo.type,
            socketId: null,
          });

          this.logger.log(`User ${uid} disconnected`);
          break;
        }
      }
    }
  }

  @SubscribeMessage('authenticate')
  async handleAuthentication(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { token: string }
  ) {
    try {
      const payload = await this.validateToken(data.token);

      if (payload && payload.userId) {
        client.emit('auth_success', { userId: payload.userId });
        this.logger.log(`User ${payload.userId} authenticated via message`);
      } else {
        client.emit('auth_error', { message: 'Invalid token' });
        client.disconnect();
      }
    } catch (error) {
      this.logger.error('Authentication error:', error);
      client.emit('auth_error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  @SubscribeMessage('activity')
  async handleActivity(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      type:
        | 'mouse'
        | 'keyboard'
        | 'scroll'
        | 'click'
        | 'focus'
        | 'blur'
        | 'visibility_change';
      metadata?: ActivityMetadata;
    }
  ) {
    const userId = client.data?.userId;
    if (userId) {
      // Check message rate limiting
      const rateLimitResult =
        await this.rateLimitingService.checkMessageRateLimit(userId);
      if (!rateLimitResult.allowed) {
        client.emit('error', {
          code: 'MESSAGE_RATE_LIMITED',
          message: 'Too many messages',
          retryAfter: rateLimitResult.retryAfter,
        });

        await this.rateLimitingService.recordSuspiciousActivity(
          userId,
          'excessive_messages',
          { messageType: 'activity' }
        );
        return;
      }

      this.updateUserActivity(client.id);

      // Record detailed activity
      this.activityTrackingService
        .recordActivity({
          userId,
          activityType: data.type || 'mouse',
          timestamp: new Date(),
          metadata: {
            ...data.metadata,
            sessionId: client.id,
            deviceType: this.detectDeviceType(
              client.handshake.headers['user-agent']
            ),
            page:
              typeof data.metadata?.page === 'string'
                ? data.metadata.page
                : undefined,
          },
        })
        .catch((error) => {
          this.logger.error('Error recording activity:', error);
        });
    }
  }

  @SubscribeMessage('inactive')
  handleInactive(@ConnectedSocket() client: Socket) {
    this.setUserInactive(client.id);
  }

  @SubscribeMessage('page_hidden')
  handlePageHidden(@ConnectedSocket() client: Socket) {
    this.setUserInactive(client.id);
  }

  @SubscribeMessage('page_visible')
  handlePageVisible(@ConnectedSocket() client: Socket) {
    this.updateUserActivity(client.id);
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      const connection = this.activeConnections.get(userId);
      if (connection) {
        connection.lastActivity = new Date();
        client.emit('heartbeat_ack', { timestamp: new Date() });
      }
    }
  }

  @SubscribeMessage('update_preferences')
  async handleUpdatePreferences(
    @ConnectedSocket() client: Socket,
    @MessageBody() preferences: Partial<NotificationPreferences>
  ) {
    const userId = client.data?.userId;
    if (userId) {
      await this.updateUserNotificationPreferences(userId, preferences);
      client.emit('preferences_updated', { success: true });
      this.logger.log(`Updated preferences for user ${userId}`);
    }
  }

  @SubscribeMessage('get_preferences')
  async handleGetPreferences(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      const preferences = await this.getUserNotificationPreferences(userId);
      client.emit('preferences', preferences);
    }
  }

  @SubscribeMessage('get_activity_stats')
  async handleGetActivityStats(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    if (userId) {
      try {
        const timeRange = {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          end: new Date(),
        };

        const [pattern, engagementScore, heatmap] = await Promise.all([
          this.activityTrackingService.analyzeActivityPattern(
            userId,
            timeRange
          ),
          this.activityTrackingService.getUserEngagementScore(
            userId,
            timeRange
          ),
          this.activityTrackingService.getActivityHeatmap(userId, 7),
        ]);

        client.emit('activity_stats', {
          pattern,
          engagementScore,
          heatmap,
          timestamp: new Date(),
        });
      } catch (error) {
        this.logger.error(
          `Error getting activity stats for user ${userId}:`,
          error
        );
        client.emit('error', { message: 'Failed to get activity stats' });
      }
    }
  }

  // Public methods for sending notifications
  /**
   * Send a notification to a specific user via WebSocket
   * Accepts the unified notification payload and sends it directly without transformation
   * @param userId - User ID to send notification to
   * @param unifiedPayload - The unified notification payload (same format as DB and API)
   * @returns True if notification was sent successfully, false otherwise
   */
  async sendToUser(
    userId: string,
    unifiedPayload: UnifiedNotificationPayload
  ): Promise<boolean> {
    try {
      // Check if user is connected
      const isUserConnected = this.activeConnections.has(userId);
      
      if (!isUserConnected) {
        this.logger.debug(`🔌 User ${userId} not connected via WebSocket`);
        return false;
      }

      // Send the unified payload directly - no transformation needed
      // The payload already has the correct format: { id, type, title, message, filterId, data, timestamp, read }
      this.server
        .to(`user-${userId}`)
        .emit('notification', unifiedPayload);

      this.logger.log(
        `📱 Sent ${unifiedPayload.type} notification via WebSocket to user ${userId}`
      );

      return true;
    } catch (error) {
      this.logger.error(`Error sending WebSocket notification to user ${userId}:`, error);
      return false;
    }
  }


  private shouldSendNotification(
    notification: WebSocketNotification,
    preferences: NotificationPreferences | null
  ): boolean {
    if (!preferences) return true;

    // Check if notification type is enabled
    const typeMapping = {
      'deal-match': 'dealMatch',
      digest: 'digest',
      system: 'system',
    };

    const prefKey = typeMapping[notification.type] as
      | 'dealMatch'
      | 'digest'
      | 'system'
      | undefined;
    if (prefKey && preferences.categories && !preferences.categories[prefKey]) {
      return false;
    }

    // Check quiet hours
    if (preferences.quietHours?.enabled) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const [startHour, startMin] = preferences.quietHours.start
        .split(':')
        .map(Number);
      const [endHour, endMin] = preferences.quietHours.end
        .split(':')
        .map(Number);

      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      if (startTime <= endTime) {
        if (currentTime >= startTime && currentTime <= endTime) {
          return false; // In quiet hours
        }
      } else {
        if (currentTime >= startTime || currentTime <= endTime) {
          return false; // Overnight quiet hours
        }
      }
    }

    return true;
  }

  async sendToRoom(
    room: string,
    notification: WebSocketNotification
  ): Promise<void> {
    this.server.to(room).emit('notification', {
      ...notification,
      id: this.generateNotificationId(),
      timestamp: new Date(),
    });
  }

  async isUserOnline(userId: string): Promise<boolean> {
    return this.activeConnections.has(userId);
  }

  async isUserActive(userId: string): Promise<boolean> {
    const connection = this.activeConnections.get(userId);
    if (!connection) return false;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return connection.isActive && connection.lastActivity > fiveMinutesAgo;
  }

  getConnectionStats() {
    return {
      totalConnections: this.activeConnections.size,
      activeUsers: Array.from(this.activeConnections.values()).filter(
        (c) => c.isActive
      ).length,
      connections: Array.from(this.activeConnections.entries()).map(
        ([userId, conn]) => ({
          userId,
          connectedAt: conn.connectedAt,
          lastActivity: conn.lastActivity,
          isActive: conn.isActive,
          deviceType: conn.deviceInfo.type,
        })
      ),
    };
  }

  // Private helper methods
  private extractTokenFromHandshake(client: Socket): string | null {
    // Try different token sources
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try query parameter
    const tokenQuery = client.handshake.query.token;
    if (typeof tokenQuery === 'string') {
      return tokenQuery;
    }

    // Try auth object
    const tokenAuth = client.handshake.auth?.token;
    if (typeof tokenAuth === 'string') {
      return tokenAuth;
    }

    return null;
  }

  private async validateToken(
    token: string
  ): Promise<{ userId: string } | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.sharedConfig.get<string>('JWT_SECRET'),
      });

      if (payload && typeof payload === 'object') {
        let userId: string | null = null;

        // Try legacy userId field first
        if ('userId' in payload && typeof payload.userId === 'string') {
          userId = payload.userId;
        }
        // Try standard JWT 'sub' claim
        else if ('sub' in payload && typeof payload.sub === 'string') {
          userId = payload.sub;
        }

        if (userId) {
          return { userId };
        } else {
          this.logger.warn('JWT payload missing user identifier');
        }
      }

      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`JWT validation error: ${errorMessage}`);
      return null;
    }
  }

  private detectDeviceType(userAgent?: string): 'web' | 'mobile' {
    if (!userAgent) return 'web';

    const mobileRegex =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return mobileRegex.test(userAgent) ? 'mobile' : 'web';
  }

  private updateUserActivity(socketId: string) {
    for (const [userId, connection] of this.activeConnections.entries()) {
      if (connection.socketId === socketId) {
        connection.lastActivity = new Date();
        connection.isActive = true;

        // Update in Redis (debounced to avoid too many calls)
        this.userStatusService.updateUserActivity(userId);
        break;
      }
    }
  }

  private setUserInactive(socketId: string) {
    for (const [userId, connection] of this.activeConnections.entries()) {
      if (connection.socketId === socketId) {
        connection.isActive = false;

        this.userStatusService.setUserInactive(userId);
        break;
      }
    }
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Enhanced authentication and security methods
  private async verifyUserExists(
    userId: string
  ): Promise<{ id: string; email: string } | null> {
    try {
      return await this.prisma.user.findUnique({
        where: { id: userId },
        // Use include instead of select for proper typing
        include: {
          // Only include what we need without breaking type safety
        },
      });
    } catch (error) {
      this.logger.error('Error verifying user:', error);
      return null;
    }
  }

  private async hasExceededConnectionLimit(userId: string): Promise<boolean> {
    let userConnections = 0;
    for (const connection of this.activeConnections.values()) {
      if (connection.userId === userId) {
        userConnections++;
      }
    }
    return userConnections >= this.MAX_CONNECTIONS_PER_USER;
  }

  private sendHeartbeat(client: Socket, userId: string): void {
    try {
      client.emit('heartbeat', {
        timestamp: new Date(),
        userId,
        serverTime: Date.now(),
      });
    } catch (error) {
      this.logger.error(`Error sending heartbeat to user ${userId}:`, error);
      // Connection might be dead, will be cleaned up on next disconnect
    }
  }

  private async getUserNotificationPreferences(
    userId: string
  ): Promise<NotificationPreferences | null> {
    try {
      // Get user's notification preferences from database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {},
      });

      // TODO: Read preferences from User.notificationPreferences field when added to schema
      // Currently returns default preferences for all users
      return {
        email: true,
        inApp: true,
        frequency: 'immediate',
        quietHours: {
          enabled: false,
          start: '22:00',
          end: '08:00',
        },
        categories: {
          dealMatch: true,
          digest: true,
          system: true,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error fetching preferences for user ${userId}:`,
        error
      );
      return null;
    }
  }

  private async updateUserNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Error updating preferences for user ${userId}:`,
        error
      );
    }
  }

  // Connection persistence methods
  async handleReconnection(client: Socket, userId: string): Promise<void> {
    const connection = this.activeConnections.get(userId);
    if (connection) {
      connection.reconnectAttempts++;
      connection.lastActivity = new Date();

      this.logger.log(
        `🔄 User ${userId} reconnected (attempt ${connection.reconnectAttempts})`
      );

      // Send missed notifications if any
      await this.sendMissedNotifications(userId);
    }
  }

  private async sendMissedNotifications(userId: string): Promise<void> {
    try {
      // Get recent notifications that weren't delivered via WebSocket
      const since = new Date(Date.now() - 10 * 60 * 1000); // Last 10 minutes

      // This would query recent notifications for the user
      // Implementation depends on your notification storage strategy
      this.logger.debug(
        `Checking for missed notifications for user ${userId} since ${since}`
      );
    } catch (error) {
      this.logger.error(
        `Error sending missed notifications to user ${userId}:`,
        error
      );
    }
  }

  /**
   * Sends email notification based on type with proper UTM tracking
   * Following REFINED_NOTIFICATION_PERSISTENCE_TDD.md specification
   * @param userEmail - User's email address
   * @param notification - Notification data
   * @param notificationId - Database notification ID for tracking
   * @param userId - User ID for unsubscribe links
   * @returns Promise resolving to email delivery success
   */
  private async sendEmailNotification(
    userEmail: string,
    notification: WebSocketNotification,
    notificationId: string,
    userId: string
  ): Promise<boolean> {
    try {
      switch (notification.type) {
        case 'deal-match':
          return await this.emailService.sendEmail({
            to: userEmail,
            subject: `🎯 New Deal Alert: ${notification.data.dealTitle || 'Great Deal'} - €${notification.data.dealPrice || 0}`,
            template: 'deal-match',
            data: {
              dealTitle:
                (notification.data.dealTitle as string) || 'Deal Alert',
              dealPrice: (notification.data.dealPrice as number) || 0,
              dealUrl: (notification.data.dealUrl as string) || '',
              dealImageUrl:
                (notification.data.dealImageUrl as string) || undefined,
              merchant:
                (notification.data.merchant as string) || 'Unknown Store',
              score: (notification.data.score as number) || 0,
              originalPrice:
                (notification.data.originalPrice as number) || undefined,
              discountPercentage:
                (notification.data.discountPercentage as number) || undefined,
              filterName:
                (notification.data.filterName as string) || 'Deal Alert',
              savings:
                notification.data.originalPrice && notification.data.dealPrice
                  ? (notification.data.originalPrice as number) -
                    (notification.data.dealPrice as number)
                  : null,
            },
            priority: this.getEmailPriority(notification.priority),
            userId,
            notificationId, // This enables UTM tracking and tracking pixel
          });

        case 'system':
          return await this.emailService.sendEmail({
            to: userEmail,
            subject: `📢 DealScrapper: ${notification.data.title || 'System Notification'}`,
            template: 'system',
            data: {
              message:
                (notification.data.message as string) ||
                'You have a new system notification.',
            },
            priority: this.getEmailPriority(notification.priority),
            userId,
            notificationId, // This enables UTM tracking and tracking pixel
          });

        case 'digest':
          return await this.emailService.sendEmail({
            to: userEmail,
            subject: `📊 Your deal digest - ${notification.data.totalMatches || 0} new deals found`,
            template: 'digest',
            data: {
              period: (notification.data.period as string) || 'daily',
              totalMatches: (notification.data.totalMatches as number) || 0,
              groupedMatches: (notification.data.groupedMatches as Record<string, Array<{ title: string; price: number; url: string; score: number; merchant: string; filterName: string }>>) || {},
              totalSavings: (notification.data.totalSavings as number) || 0,
              topDeal: (notification.data.topDeal as { title: string; price: number; url: string; score: number; merchant: string } | undefined) || undefined,
            },
            priority: this.getEmailPriority(notification.priority),
            userId,
            notificationId, // This enables UTM tracking and tracking pixel
          });

        default:
          this.logger.warn(
            `Unknown notification type for email: ${notification.type}`
          );
          return false;
      }
    } catch (error) {
      this.logger.error(`Failed to send email notification: ${error.message}`);
      return false;
    }
  }

  /**
   * Maps WebSocket notification priority to email priority
   * @param priority - WebSocket notification priority
   * @returns Email service priority
   */
  private getEmailPriority(
    priority: 'high' | 'normal' | 'low'
  ): 'high' | 'normal' | 'low' {
    return priority; // Direct mapping for now
  }
}
