/**
 * WebSocket service for real-time notifications
 * Connects to the notifier service at ws://localhost:3003/notifications
 */

import { io, Socket } from 'socket.io-client';
import { decodeJWT, debugJWT } from './jwt-debug';
import { apiClient } from './api';
import { getRuntimeConfig } from './runtime-config';

export interface WebSocketNotification {
  id: string;
  type: 'DEAL_MATCH' | 'SYSTEM' | 'ALERT';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  read?: boolean;
}

/**
 * Enhanced notification interface with additional filter and deal information
 * for improved UX and navigation capabilities
 */
export interface EnhancedWebSocketNotification extends WebSocketNotification {
  /** ID of the filter that triggered this notification */
  filterId?: string;
  /** Name of the filter for display purposes */
  filterName?: string;
  /** Name of the deal/item that triggered the notification */
  itemName?: string;
  /** Alternative timestamp fields for compatibility */
  createdAt?: string;
  updatedAt?: string;
  date?: string;
  /** Content structure for legacy notifications */
  content?: {
    title?: string;
    description?: string;
    url?: string;
    imageUrl?: string;
    price?: number;
    temperature?: number;
    merchant?: string;
    discountPercentage?: number;
    score?: number;
    [key: string]: unknown;
  };
  /** Enhanced data structure with deal information */
  data?: {
    dealData?: {
      title: string;
      price?: number;
      originalPrice?: number;
      discountPercentage?: number;
      merchant?: string;
      imageUrl?: string;
      url?: string;
      temperature?: number;
      score?: number;
    };
    [key: string]: unknown;
  };
}

export interface NotificationEventHandlers {
  onNotification?: (notification: EnhancedWebSocketNotification) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private handlers: NotificationEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  /**
   * Initialize WebSocket connection with authentication
   */
  connect(token?: string): void {
    if (this.socket?.connected) {
      return;
    }

    const socketUrl = getRuntimeConfig().NOTIFIER_URL;
    const authToken = token || apiClient.getToken();

    if (!authToken) {
      this.handlers.onError?.(new Error('No authentication token'));
      return;
    }

    const jwtAnalysis = decodeJWT(authToken);

    if (!jwtAnalysis.info.hasValidFormat) {
      this.handlers.onError?.(new Error('Invalid JWT format'));
      return;
    }

    if (!jwtAnalysis.info.hasUserIdentifier) {
      this.handlers.onError?.(new Error('JWT missing user identifier'));
      return;
    }

    if (jwtAnalysis.info.isExpired) {
      this.handlers.onError?.(new Error('JWT token is expired'));
      return;
    }

    if (!jwtAnalysis.valid) {
      this.handlers.onError?.(
        new Error(`JWT validation failed: ${jwtAnalysis.errors.join(', ')}`)
      );
      return;
    }

    this.socket = io(`${socketUrl}/notifications`, {
      auth: {
        token: authToken,
      },
      extraHeaders: {
        Authorization: `Bearer ${authToken}`,
      },
      transports: ['websocket'],
      forceNew: true,
      timeout: 10000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    this.setupEventListeners();
  }

  /**
   * Set up Socket.IO event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.handlers.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      this.handlers.onDisconnect?.();

      // Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        this.handlers.onError?.(
          new Error('Server disconnected - authentication may have failed')
        );
        return;
      }

      if (reason === 'transport close' || reason === 'transport error') {
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.handlers.onError?.(new Error(error.message));
      this.attemptReconnect();
    });

    // Listen for notifications (handles all types including deal-match)
    this.socket.on(
      'notification',
      (notification: WebSocketNotification | EnhancedWebSocketNotification) => {
        // Cast to enhanced notification for compatibility
        const enhancedNotification =
          notification as EnhancedWebSocketNotification;
        this.handlers.onNotification?.(enhancedNotification);
      }
    );

    // Note: Removed duplicate 'deal-match' listener as it was causing duplicates
    // The backend should send deal-match notifications via the 'notification' event

    // Authentication events from the backend
    this.socket.on('connected', (data) => {
      // Connection confirmed
    });

    this.socket.on('authenticated', () => {
      // Authentication successful
    });

    this.socket.on('auth_success', (data) => {
      // Authentication successful
    });

    this.socket.on('auth_error', (error) => {
      const errorMessage = this.getErrorMessage(error);
      this.handlers.onError?.(
        new Error(`Authentication failed: ${errorMessage}`)
      );
    });

    this.socket.on('unauthorized', (error) => {
      this.handlers.onError?.(new Error('Authentication failed'));
    });

    // Backend error events
    this.socket.on('error', (error) => {
      const errorMessage = this.getErrorMessage(error);
      this.handlers.onError?.(new Error(`Server error: ${errorMessage}`));
    });

    // Backend sends preferences when connected
    this.socket.on('preferences', (preferences) => {
      // Preferences received
    });

    // Heartbeat handling
    this.socket.on('heartbeat', (data) => {
      // Send heartbeat acknowledgment
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');
      }
    });

    this.socket.on('heartbeat_ack', (data) => {
      // Heartbeat acknowledged
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.handlers.onError?.(new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      if (!this.isConnected && this.socket) {
        this.socket.connect();
      }
    }, delay);
  }

  /**
   * Set event handlers for WebSocket events
   */
  setHandlers(handlers: NotificationEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Manually authenticate after connection (fallback method)
   */
  authenticate(token?: string): void {
    if (!this.socket?.connected) {
      return;
    }

    const authToken = token || apiClient.getToken();
    if (!authToken) {
      this.handlers.onError?.(new Error('No authentication token'));
      return;
    }

    const jwtAnalysis = decodeJWT(authToken);

    if (!jwtAnalysis.info.hasValidFormat) {
      this.handlers.onError?.(
        new Error('Invalid JWT format for authentication')
      );
      return;
    }

    if (!jwtAnalysis.info.hasUserIdentifier) {
      this.handlers.onError?.(new Error('Token missing user identifier'));
      return;
    }

    if (jwtAnalysis.info.isExpired) {
      this.handlers.onError?.(
        new Error('Cannot authenticate with expired token')
      );
      return;
    }

    this.socket.emit('authenticate', { token: authToken });
  }

  /**
   * Send a test notification request (for development/testing)
   */
  requestTestNotification(): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('test-notification', {
      message: 'Test notification from frontend',
    });
  }

  /**
   * Mark a notification as read
   */
  markNotificationRead(notificationId: string): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('mark-read', { notificationId });
  }

  /**
   * Subscribe to specific notification types
   */
  subscribe(types: string[]): void {
    if (!this.socket?.connected) {
      return;
    }

    this.socket.emit('subscribe', { types });
  }

  /**
   * Get connection status
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Disconnect the WebSocket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Get current socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Extract error message from unknown error object
   * @param error - Unknown error object from WebSocket
   * @returns Safe error message string
   */
  private getErrorMessage(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      // Try to extract message from error object
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }

      // Try to extract code from error object
      if ('code' in error && typeof error.code === 'string') {
        return error.code;
      }

      // Try to extract code as number and convert to string
      if ('code' in error && typeof error.code === 'number') {
        return error.code.toString();
      }
    }

    return 'Unknown error';
  }
}

// Create and export a singleton instance
export const websocketService = new WebSocketService();

export default websocketService;
