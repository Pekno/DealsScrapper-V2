import { Resend } from 'resend';
import { SharedConfigService } from '@dealscrapper/shared-config';
import {
  EmailTransport,
  EmailTransportPayload,
  EmailSendResult,
  EmailProviderStatus,
} from './email-transport.interface.js';

/**
 * Resend email transport.
 * Uses the Resend API for transactional email delivery.
 */
export class ResendTransport implements EmailTransport {
  private readonly resend: Resend;
  private readonly apiKey: string;

  constructor(private readonly sharedConfig: SharedConfigService) {
    const emailConfig = this.sharedConfig.getEmailConfig();
    this.apiKey = emailConfig.transport.apiKey as string;

    if (!this.apiKey) {
      throw new Error(
        'Resend API key is required. Set RESEND_API_KEY environment variable.',
      );
    }

    this.resend = new Resend(this.apiKey);
  }

  /**
   * Sends an email through the Resend API
   */
  async send(payload: EmailTransportPayload): Promise<EmailSendResult> {
    const result = await this.resend.emails.send({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: payload.headers,
    });

    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message}`);
    }

    return { messageId: result.data?.id ?? 'unknown' };
  }

  getProviderName(): string {
    return 'Resend';
  }

  isHealthy(): boolean {
    return !!this.apiKey && !!this.resend;
  }

  getProviderStatus(): EmailProviderStatus {
    return {
      provider: this.getProviderName(),
      configured: !!this.apiKey,
      healthy: this.isHealthy(),
      lastCheck: new Date(),
    };
  }
}
