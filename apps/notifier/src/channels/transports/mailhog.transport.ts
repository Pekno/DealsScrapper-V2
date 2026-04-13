import * as nodemailer from 'nodemailer';
import {
  EmailTransport,
  EmailTransportPayload,
  EmailSendResult,
  EmailProviderStatus,
} from './email-transport.interface.js';

/**
 * MailHog email transport for test environments.
 * Wraps a nodemailer transporter configured with MailHog SMTP settings.
 */
export class MailhogTransport implements EmailTransport {
  constructor(private readonly transporter: nodemailer.Transporter) {}

  /**
   * Sends an email through the MailHog SMTP server
   */
  async send(payload: EmailTransportPayload): Promise<EmailSendResult> {
    const result = await this.transporter.sendMail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      headers: payload.headers,
    });

    return { messageId: result.messageId };
  }

  getProviderName(): string {
    return 'MailHog Test';
  }

  isHealthy(): boolean {
    return !!this.transporter;
  }

  getProviderStatus(): EmailProviderStatus {
    return {
      provider: this.getProviderName(),
      configured: true,
      healthy: this.isHealthy(),
      lastCheck: new Date(),
    };
  }
}
