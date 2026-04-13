import * as nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { notifierLogConfig } from '../../config/logging.config.js';
import { extractErrorMessage } from '../../utils/error-handling.utils.js';
import {
  EmailTransport,
  EmailTransportPayload,
  EmailSendResult,
  EmailProviderStatus,
} from './email-transport.interface.js';

/**
 * Gmail OAuth2 configuration interface
 */
export interface GmailOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly refreshToken: string;
  readonly userEmail: string;
}

/**
 * Gmail OAuth2 access token response
 */
export interface GmailAccessToken {
  readonly token: string | null | undefined;
}

/**
 * Gmail OAuth2 email transport.
 * Wraps a nodemailer transporter configured with Google OAuth2 credentials.
 */
export class GmailTransport implements EmailTransport {
  private readonly logger = createServiceLogger(notifierLogConfig);
  private readonly oAuth2Client: InstanceType<typeof google.auth.OAuth2>;
  private readonly gmailConfig: GmailOAuthConfig;

  constructor(
    private readonly transporter: nodemailer.Transporter,
    private readonly sharedConfig: SharedConfigService,
  ) {
    this.gmailConfig = this.loadGmailOAuthConfiguration();
    this.oAuth2Client = this.createOAuth2Client();
    this.validateConfiguration();
  }

  /**
   * Sends an email through the Gmail OAuth2 transporter
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
    return 'Gmail OAuth2';
  }

  isHealthy(): boolean {
    try {
      return !!(
        this.gmailConfig.clientId &&
        this.gmailConfig.clientSecret &&
        this.gmailConfig.refreshToken &&
        this.gmailConfig.userEmail &&
        this.oAuth2Client
      );
    } catch {
      return false;
    }
  }

  getProviderStatus(): EmailProviderStatus {
    return {
      provider: this.getProviderName(),
      configured: !!this.gmailConfig.clientId,
      healthy: this.isHealthy(),
      userEmail: this.gmailConfig.userEmail,
      lastCheck: new Date(),
    };
  }

  /**
   * Retrieves Gmail access token using OAuth2 refresh token
   */
  async getGmailAccessToken(): Promise<GmailAccessToken> {
    try {
      const accessTokenResponse = await this.oAuth2Client.getAccessToken();
      return { token: accessTokenResponse.token };
    } catch (error) {
      const errorMessage = extractErrorMessage(error);
      this.logger.error(
        `Failed to retrieve Gmail access token: ${errorMessage}`,
      );
      throw new Error(`Gmail OAuth2 authentication failed: ${errorMessage}`);
    }
  }

  /**
   * Creates a fresh nodemailer transporter with current OAuth2 credentials.
   * Useful when the access token has expired and a new transporter is needed.
   */
  async createGmailTransporter(
    accessToken: GmailAccessToken,
  ): Promise<nodemailer.Transporter> {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: this.gmailConfig.userEmail,
        clientId: this.gmailConfig.clientId,
        clientSecret: this.gmailConfig.clientSecret,
        refreshToken: this.gmailConfig.refreshToken,
        accessToken: accessToken.token ?? undefined,
      },
    });
  }

  /**
   * Loads Gmail OAuth2 configuration from SharedConfigService
   */
  private loadGmailOAuthConfiguration(): GmailOAuthConfig {
    const emailConfig = this.sharedConfig.getEmailConfig();

    if (emailConfig.service !== 'gmail' || !emailConfig.transport.auth) {
      throw new Error('Gmail OAuth2 configuration not available');
    }

    const auth = emailConfig.transport.auth as Record<string, unknown>;

    return {
      clientId: auth.clientId as string,
      clientSecret: auth.clientSecret as string,
      redirectUri: 'https://developers.google.com/oauthplayground',
      refreshToken: auth.refreshToken as string,
      userEmail: auth.user as string,
    };
  }

  /**
   * Creates and configures Google OAuth2 client
   */
  private createOAuth2Client(): InstanceType<typeof google.auth.OAuth2> {
    const oAuth2Client = new google.auth.OAuth2(
      this.gmailConfig.clientId,
      this.gmailConfig.clientSecret,
      this.gmailConfig.redirectUri,
    );

    oAuth2Client.setCredentials({
      refresh_token: this.gmailConfig.refreshToken,
    });

    return oAuth2Client;
  }

  /**
   * Validates Gmail OAuth2 configuration and logs initialization status
   */
  private validateConfiguration(): void {
    try {
      this.logger.log('Gmail OAuth2 transport initialized');
      this.logger.log(
        `Configured user: ${this.gmailConfig.userEmail}`,
      );
    } catch (error) {
      this.logger.error(
        'Gmail OAuth2 configuration validation failed',
        error,
      );
      throw new Error(
        'GmailTransport startup failed: Invalid Gmail OAuth2 configuration',
      );
    }
  }
}
