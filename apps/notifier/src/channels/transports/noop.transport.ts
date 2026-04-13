import type { EmailTransport, EmailTransportPayload, EmailSendResult, EmailProviderStatus } from './email-transport.interface.js';

/**
 * No-op email transport used when EMAIL_PROVIDER is not configured.
 * All send calls are silently discarded.
 */
export class NoopTransport implements EmailTransport {
  async send(_payload: EmailTransportPayload): Promise<EmailSendResult> {
    return { messageId: 'noop' };
  }

  getProviderName(): string {
    return 'none';
  }

  isHealthy(): boolean {
    return true;
  }

  getProviderStatus(): EmailProviderStatus {
    return {
      provider: 'none',
      configured: false,
      healthy: true,
      lastCheck: new Date(),
    };
  }
}
