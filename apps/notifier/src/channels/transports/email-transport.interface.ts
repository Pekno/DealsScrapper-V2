/**
 * Payload for sending an email through any transport
 */
export interface EmailTransportPayload {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

/**
 * Result of an email send operation
 */
export interface EmailSendResult {
  messageId: string;
}

/**
 * Provider status information for health checks
 */
export interface EmailProviderStatus {
  provider: string;
  configured: boolean;
  healthy: boolean;
  userEmail?: string;
  lastCheck: Date;
}

/**
 * Abstract interface for email transport implementations.
 * Each email provider (Gmail, Resend, MailHog) implements this interface.
 */
export interface EmailTransport {
  send(payload: EmailTransportPayload): Promise<EmailSendResult>;
  getProviderName(): string;
  isHealthy(): boolean;
  getProviderStatus(): EmailProviderStatus;
}
