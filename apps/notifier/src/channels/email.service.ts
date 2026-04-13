import { Inject } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { EMAIL_TRANSPORT } from './tokens.js';
import type { EmailTransport, EmailTransportPayload } from './transports/index.js';
import Handlebars from 'handlebars';
import mjml from 'mjml';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { notifierLogConfig } from '../config/logging.config.js';
import { sanitizeUrl } from '../utils/sanitization.utils.js';

// Initialize JSDOM window for DOMPurify server-side usage
const window = new JSDOM('').window;
const purify = DOMPurify(window);

import { withErrorHandling } from '../utils/error-handling.utils.js';

interface EmailTemplateData {
  dealTitle?: string;
  dealPrice?: number;
  dealUrl?: string;
  dealImageUrl?: string;
  merchant?: string;
  score?: number;
  originalPrice?: number;
  discountPercentage?: number;
  filterName?: string;
  unsubscribeUrl?: string;
  savings?: number | null;
  message?: string;
  verificationUrl?: string;
  supportUrl?: string;
  recipientEmail?: string;
  resetUrl?: string;
  expiresIn?: string;
  loginUrl?: string;
  preferencesUrl?: string;
  period?: string;
  totalMatches?: number;
  groupedMatches?: Record<
    string,
    Array<{
      title: string;
      price: number;
      url: string;
      score: number;
      merchant: string;
      filterName: string;
    }>
  >;
  totalSavings?: number;
  topDeal?: {
    title: string;
    price: number;
    url: string;
    score: number;
    merchant: string;
  };
  trackingPixel?: string; // For email open tracking
}

export interface EmailOptions {
  to: string;
  subject: string;
  template: string;
  data: EmailTemplateData;
  priority?: 'high' | 'normal' | 'low';
  userId?: string;
  notificationId?: string; // For tracking pixel and UTM parameters
}

/**
 * Multi-provider email service supporting Gmail OAuth2, Resend, and MailHog.
 * Uses an EmailTransport abstraction to decouple sending logic from provider details.
 */
export class EmailService {
  private readonly logger = createServiceLogger(notifierLogConfig);
  private readonly senderInfo: { email: string; name: string };

  private readonly emailEnabled: boolean;

  constructor(
    @Inject(EMAIL_TRANSPORT)
    private readonly transport: EmailTransport,
    private readonly sharedConfig: SharedConfigService
  ) {
    const emailConfig = this.sharedConfig.getEmailConfig();
    this.emailEnabled = emailConfig.service !== 'none';
    this.senderInfo = emailConfig.from;

    if (this.emailEnabled) {
      this.logger.log(`Email service initialized with ${this.transport.getProviderName()} provider`);
    } else {
      this.logger.log('Email service initialized — email sending is disabled (EMAIL_PROVIDER not set)');
    }
  }

  /**
   * Sends email via the configured transport provider
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.emailEnabled) {
      return false;
    }

    return withErrorHandling(
      this.logger,
      `sending email to ${options.to}`,
      async () => {
        if (!this.isValidEmailOptions(options)) {
          this.logger.error(
            `❌ Invalid email options provided for ${options.to}`
          );
          return false;
        }

        this.logger.log(
          `📧 Sending email to ${options.to} via ${this.transport.getProviderName()}`
        );

        // Sanitize template data first
        const sanitizedData = this.sanitizeTemplateData(options.data);

        // Enhanced template data with UTM parameters and tracking pixel
        const enhancedData = await this.enhanceTemplateData({
          ...options,
          data: sanitizedData,
        });

        const { htmlContent, textContent } = await this.renderTemplate(
          options.template,
          enhancedData
        );

        const payload = this.buildTransportPayload(
          options,
          htmlContent,
          textContent
        );

        const result = await this.transport.send(payload);

        this.logger.log(
          `✅ Email sent successfully to ${options.to} (MessageId: ${result.messageId})`
        );
        return true;
      },
      {
        throwOnError: false,
        fallbackValue: false,
        context: { recipient: options.to, template: options.template }
      }
    );
  }

  /**
   * Builds transport payload from email options and rendered content
   */
  private buildTransportPayload(
    options: EmailOptions,
    htmlContent: string,
    textContent: string
  ): EmailTransportPayload {
    return {
      from: `"${this.senderInfo.name}" <${this.senderInfo.email}>`,
      to: options.to,
      subject: options.subject,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Template': options.template,
        'X-Priority': options.priority ?? 'normal',
        ...(options.userId && { 'X-User-ID': options.userId }),
        'X-Mailer': `DealScrapper ${this.transport.getProviderName()}`,
      },
    };
  }

  async sendDealMatchEmail(
    to: string,
    dealData: {
      title: string;
      price: number;
      url: string;
      imageUrl?: string;
      score: number;
      merchant: string;
      originalPrice?: number;
      discountPercentage?: number;
    },
    filterName: string,
    userId: string
  ): Promise<boolean> {
    const unsubscribeUrl = this.generateUnsubscribeUrl(userId);

    return this.sendEmail({
      to,
      subject: `🎯 New Deal Alert: ${dealData.title} - €${dealData.price}`,
      template: 'deal-match',
      data: {
        dealTitle: dealData.title,
        dealPrice: dealData.price,
        dealUrl: dealData.url,
        dealImageUrl: dealData.imageUrl,
        merchant: dealData.merchant,
        score: dealData.score,
        originalPrice: dealData.originalPrice,
        discountPercentage: dealData.discountPercentage,
        filterName,
        unsubscribeUrl,
        savings: dealData.originalPrice
          ? dealData.originalPrice - dealData.price
          : null,
      },
      priority: this.calculateEmailPriority(dealData.score),
      userId,
    });
  }

  async sendDigestEmail(
    to: string,
    matches: Array<{
      title: string;
      price: number;
      url: string;
      score: number;
      merchant: string;
      filterName: string;
    }>,
    period: 'daily' | 'weekly',
    userId: string
  ): Promise<boolean> {
    const unsubscribeUrl = this.generateUnsubscribeUrl(userId);
    const preferencesUrl = this.generatePreferencesUrl(userId);

    // Group matches by filter and sort by score
    const groupedMatches = matches.reduce(
      (acc, match) => {
        if (!acc[match.filterName]) {
          acc[match.filterName] = [];
        }
        acc[match.filterName].push(match);
        return acc;
      },
      {} as Record<string, typeof matches>
    );

    // Sort each group by score
    Object.keys(groupedMatches).forEach((filterName) => {
      groupedMatches[filterName].sort((a, b) => b.score - a.score);
    });

    const totalSavings = matches.reduce((sum, match) => {
      // Estimate savings based on score (simplified)
      return sum + (match.score > 80 ? match.price * 0.2 : 0);
    }, 0);

    return this.sendEmail({
      to,
      subject: `📊 Your ${period} deal digest - ${matches.length} new deals found`,
      template: 'digest',
      data: {
        period,
        totalMatches: matches.length,
        groupedMatches,
        totalSavings: Math.round(totalSavings),
        unsubscribeUrl,
        preferencesUrl,
        topDeal: matches.sort((a, b) => b.score - a.score)[0],
      },
      priority: 'normal',
      userId,
    });
  }

  async sendSystemNotification(
    to: string,
    subject: string,
    message: string,
    userId: string
  ): Promise<boolean> {
    const unsubscribeUrl = this.generateUnsubscribeUrl(userId);

    // Sanitize subject to prevent XSS
    const sanitizedSubject = purify.sanitize(subject, { ALLOWED_TAGS: [] });

    return this.sendEmail({
      to,
      subject: `📢 DealScrapper: ${sanitizedSubject}`,
      template: 'system',
      data: {
        message,
        unsubscribeUrl,
      },
      priority: 'normal',
      userId,
    });
  }

  /**
   * Sends email verification notification with secure verification link
   * @param to - Recipient email address
   * @param verificationUrl - Complete verification URL with JWT token
   * @param userId - User identifier for tracking and preferences
   * @returns Promise resolving to delivery success status
   */
  async sendEmailVerification(
    to: string,
    verificationUrl: string,
    userId: string
  ): Promise<boolean> {
    const supportUrl = this.sharedConfig.get<string>('WEB_APP_URL');

    return this.sendEmail({
      to,
      subject: '✅ Verify your email address - DealScrapper',
      template: 'email-verification',
      data: {
        verificationUrl,
        supportUrl,
        recipientEmail: to,
      },
      priority: 'high',
      userId,
    });
  }

  /**
   * Sends a password reset email with a secure one-time reset URL.
   * Used for both admin-initiated resets and user-initiated forgot-password flows.
   * @param to - Recipient email address
   * @param resetUrl - Secure one-time reset URL
   * @param userId - User identifier for tracking
   * @param expiresIn - Human-readable expiration duration (e.g. "30 minutes", "1 hour")
   * @returns Promise resolving to delivery success status
   */
  async sendPasswordReset(
    to: string,
    resetUrl: string,
    userId: string,
    expiresIn: string = '30 minutes'
  ): Promise<boolean> {
    return this.sendEmail({
      to,
      subject: 'Reset your DealScrapper password',
      template: 'password-reset',
      data: {
        resetUrl,
        recipientEmail: to,
        expiresIn,
      },
      priority: 'high',
      userId,
    });
  }

  /**
   * Gets email service status and health information
   */
  getProviderStatus() {
    return this.transport.getProviderStatus();
  }

  // Private template rendering and utility methods

  /**
   * Validates email options for security and completeness
   * @param options - Email options to validate
   * @returns Boolean indicating if options are valid
   */
  private isValidEmailOptions(options: EmailOptions): boolean {
    // Check required fields
    if (!options.to || !options.subject || !options.template || !options.data) {
      return false;
    }

    // Handle null/undefined emails
    if (typeof options.to !== 'string' || options.to.trim().length === 0) {
      return false;
    }

    // Validate email address format - strict regex requiring TLD
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?){1,}$/;
    if (!emailRegex.test(options.to.trim())) {
      this.logger.warn(`Invalid email address format: ${options.to}`);
      return false;
    }

    // Check for consecutive dots
    if (options.to.includes('..')) {
      this.logger.warn(
        `Invalid email address with consecutive dots: ${options.to}`
      );
      return false;
    }

    // Check for suspicious patterns in recipient (XSS/injection attempts)
    const suspiciousPatterns = [
      /<script[^>]*>/i,
      /<iframe[^>]*>/i,
      /<object[^>]*>/i,
      /<embed[^>]*>/i,
      /javascript:/i,
      /data:text\/html/i,
      /vbscript:/i,
      /on\w+=/i, // onclick, onload, etc.
      /\.\.\/\.\.\//, // path traversal
    ];

    if (suspiciousPatterns.some((pattern) => pattern.test(options.to))) {
      this.logger.warn(`Suspicious email address detected: ${options.to}`);
      return false;
    }

    // Validate template name to prevent path traversal
    const allowedTemplates = [
      'deal-match',
      'digest',
      'system',
      'email-verification',
      'password-reset',
    ];
    if (!allowedTemplates.includes(options.template)) {
      this.logger.warn(`Invalid template name: ${options.template}`);
      return false;
    }

    return true;
  }

  /**
   * Sanitize text input to prevent XSS
   */
  private sanitizeText(text: unknown): string {
    if (typeof text !== 'string') {
      return String(text || '');
    }

    // Use DOMPurify to remove dangerous content
    return purify.sanitize(text, {
      ALLOWED_TAGS: [], // No HTML tags allowed in text fields
      ALLOWED_ATTR: [],
    });
  }

  /**
   * Sanitize template data before rendering
   */
  private sanitizeTemplateData(data: EmailTemplateData): EmailTemplateData {
    const sanitized = { ...data };

    // Sanitize text fields
    if (sanitized.dealTitle) {
      sanitized.dealTitle = this.sanitizeText(sanitized.dealTitle);
    }
    if (sanitized.merchant) {
      sanitized.merchant = this.sanitizeText(sanitized.merchant);
    }
    if (sanitized.filterName) {
      sanitized.filterName = this.sanitizeText(sanitized.filterName);
    }
    if (sanitized.message) {
      sanitized.message = this.sanitizeText(sanitized.message);
    }
    if (sanitized.recipientEmail) {
      sanitized.recipientEmail = this.sanitizeText(sanitized.recipientEmail);
    }
    if (sanitized.period) {
      sanitized.period = this.sanitizeText(sanitized.period);
    }

    // Sanitize all URL fields
    if (sanitized.dealUrl) {
      sanitized.dealUrl = sanitizeUrl(sanitized.dealUrl);
    }
    if (sanitized.dealImageUrl) {
      sanitized.dealImageUrl = sanitizeUrl(sanitized.dealImageUrl);
    }
    if (sanitized.unsubscribeUrl) {
      sanitized.unsubscribeUrl = sanitizeUrl(sanitized.unsubscribeUrl);
    }
    if (sanitized.verificationUrl) {
      sanitized.verificationUrl = sanitizeUrl(sanitized.verificationUrl);
    }
    if (sanitized.resetUrl) {
      sanitized.resetUrl = sanitizeUrl(sanitized.resetUrl);
    }
    if (sanitized.supportUrl) {
      sanitized.supportUrl = sanitizeUrl(sanitized.supportUrl);
    }
    if (sanitized.preferencesUrl) {
      sanitized.preferencesUrl = sanitizeUrl(sanitized.preferencesUrl);
    }

    // Sanitize grouped matches
    if (sanitized.groupedMatches) {
      Object.keys(sanitized.groupedMatches).forEach((key) => {
        sanitized.groupedMatches![key] = sanitized.groupedMatches![key].map(
          (match) => ({
            ...match,
            title: this.sanitizeText(match.title),
            merchant: this.sanitizeText(match.merchant),
            filterName: this.sanitizeText(match.filterName),
            url: sanitizeUrl(match.url),
          })
        );
      });
    }

    // Sanitize top deal
    if (sanitized.topDeal) {
      sanitized.topDeal = {
        ...sanitized.topDeal,
        title: this.sanitizeText(sanitized.topDeal.title),
        merchant: this.sanitizeText(sanitized.topDeal.merchant),
        url: sanitizeUrl(sanitized.topDeal.url),
      };
    }

    return sanitized;
  }

  private async renderTemplate(
    templateName: string,
    data: EmailTemplateData
  ): Promise<{ htmlContent: string; textContent: string }> {
    return withErrorHandling(
      this.logger,
      `rendering template ${templateName}`,
      async () => {
        // Sanitize data before rendering
        const sanitizedData = this.sanitizeTemplateData(data);

        // Load MJML template
        const mjmlTemplate = await this.loadTemplate(`${templateName}.mjml`);

        // Compile with Handlebars
        const template = Handlebars.compile(mjmlTemplate);
        const mjmlContent = template(sanitizedData);

        // Convert MJML to HTML
        const { html, errors } = mjml(mjmlContent, {
          keepComments: false,
        });

        if (errors.length > 0) {
          this.logger.warn(`MJML template warnings for ${templateName}: ${JSON.stringify(errors)}`);
        }

        // Generate text version
        const textContent = this.htmlToText(html);

        return {
          htmlContent: html,
          textContent,
        };
      },
      {
        throwOnError: false,
        fallbackValue: this.renderFallbackTemplate(templateName, data),
        context: { templateName, dataKeys: Object.keys(data) }
      }
    );
  }

  private async loadTemplate(templateName: string): Promise<string> {
    // For now, return inline templates. In production, load from files.
    const templates: Record<string, string> = {
      'deal-match.mjml': this.getDealMatchTemplate(),
      'digest.mjml': this.getDigestTemplate(),
      'system.mjml': this.getSystemTemplate(),
      'email-verification.mjml': this.getEmailVerificationTemplate(),
      'password-reset.mjml': this.getPasswordResetTemplate(),
    };

    return templates[templateName] || templates['system.mjml'];
  }

  private renderFallbackTemplate(
    templateName: string,
    data: EmailTemplateData
  ): { htmlContent: string; textContent: string } {
    let htmlContent = '';
    let textContent = '';

    switch (templateName) {
      case 'deal-match':
        htmlContent = `
          <html>
            <body>
              <h1>🎯 New Deal Alert!</h1>
              <h2>${data.dealTitle}</h2>
              <p><strong>Price:</strong> €${data.dealPrice}</p>
              <p><strong>Merchant:</strong> ${data.merchant}</p>
              <p><strong>Score:</strong> ${data.score}/100</p>
              <a href="${data.dealUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none;">View Deal</a>
              <hr>
              <small><a href="${data.unsubscribeUrl}">Unsubscribe</a></small>
            </body>
          </html>
        `;
        textContent = `🎯 New Deal Alert!\n\n${data.dealTitle}\nPrice: €${data.dealPrice}\nMerchant: ${data.merchant}\nScore: ${data.score}/100\n\nView Deal: ${data.dealUrl}\n\nUnsubscribe: ${data.unsubscribeUrl}`;
        break;

      case 'email-verification':
        htmlContent = `
          <html>
            <body>
              <h1>✅ Verify Your Email Address</h1>
              <p>Welcome to DealScrapper! Please verify your email address to complete your account setup.</p>
              <p><strong>Email:</strong> ${data.recipientEmail}</p>
              <a href="${data.verificationUrl}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0;">Verify Email Address</a>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; font-family: monospace; background: #f8f9fa; padding: 10px; border-radius: 4px;">${data.verificationUrl}</p>
              <hr>
              <small>If you didn't create an account with DealScrapper, you can safely ignore this email.</small>
            </body>
          </html>
        `;
        textContent = `✅ Verify Your Email Address\n\nWelcome to DealScrapper! Please verify your email address to complete your account setup.\n\nEmail: ${data.recipientEmail}\n\nVerify your email: ${data.verificationUrl}\n\nIf you didn't create an account with DealScrapper, you can safely ignore this email.`;
        break;

      case 'password-reset':
        htmlContent = `
          <html>
            <body>
              <h1>Reset Your Password</h1>
              <p>We received a request to reset your DealScrapper password.</p>
              <p><strong>Email:</strong> ${data.recipientEmail}</p>
              <a href="${data.resetUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0;">Reset Password</a>
              <p>This link expires in ${data.expiresIn ?? '30 minutes'}.</p>
              <hr>
              <small>If you didn't request this, you can safely ignore this email.</small>
            </body>
          </html>
        `;
        textContent = `Reset Your Password\n\nWe received a request to reset your DealScrapper password.\n\nReset your password: ${data.resetUrl}\n\nThis link expires in ${data.expiresIn ?? '30 minutes'}.\n\nIf you didn't request this, you can safely ignore this email.`;
        break;

      default:
        htmlContent = `
          <html>
            <body>
              <h1>DealScrapper Notification</h1>
              <p>${data.message || 'You have a new notification.'}</p>
              <hr>
              <small><a href="${data.unsubscribeUrl}">Unsubscribe</a></small>
            </body>
          </html>
        `;
        textContent = `DealScrapper Notification\n\n${data.message || 'You have a new notification.'}\n\nUnsubscribe: ${data.unsubscribeUrl}`;
    }

    return { htmlContent, textContent };
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculates email priority based on deal match score
   * @param score - Deal match score (0-100)
   * @returns Email priority level for proper queue handling
   */
  private calculateEmailPriority(score: number): 'high' | 'normal' | 'low' {
    if (score >= 90) return 'high';
    if (score >= 70) return 'normal';
    return 'low';
  }

  /**
   * Generates unsubscribe URL for email notifications
   * @param userId - User identifier for unsubscribe tracking
   * @returns Complete unsubscribe URL for email templates
   */
  private generateUnsubscribeUrl(userId: string): string {
    const baseUrl = this.sharedConfig.get<string>('WEB_APP_URL');
    return `${baseUrl}/unsubscribe?user=${userId}`;
  }

  /**
   * Generates user preferences URL for email management
   * @param userId - User identifier for preferences access
   * @returns Complete preferences URL for email templates
   */
  private generatePreferencesUrl(userId: string): string {
    const baseUrl = this.sharedConfig.get<string>('WEB_APP_URL');
    return `${baseUrl}/preferences?user=${userId}`;
  }

  /**
   * Enhances template data with UTM parameters and tracking pixel
   * Following REFINED_NOTIFICATION_PERSISTENCE_TDD.md specification
   * @param options - Email options with template data
   * @returns Enhanced template data with tracking URLs and pixel
   */
  private async enhanceTemplateData(
    options: EmailOptions
  ): Promise<EmailTemplateData> {
    const data = { ...options.data };

    // Add tracking pixel if notificationId is provided
    if (options.notificationId) {
      const apiUrl = this.sharedConfig.get<string>('WEB_APP_URL'); // API base URL
      data.trackingPixel = `${apiUrl}/track/email/${options.notificationId}/open.png`;
    }

    // Enhance deal URLs with UTM parameters
    if (data.dealUrl && options.notificationId) {
      data.dealUrl = this.generateTrackedUrl(
        data.dealUrl,
        options.notificationId,
        'deal_alert'
      );
    }

    // Enhance top deal URL in digest emails
    if (data.topDeal?.url && options.notificationId) {
      data.topDeal.url = this.generateTrackedUrl(
        data.topDeal.url,
        options.notificationId,
        'deal_alert'
      );
    }

    // Enhance grouped matches URLs in digest emails
    if (data.groupedMatches) {
      for (const filterName in data.groupedMatches) {
        data.groupedMatches[filterName] = data.groupedMatches[filterName].map(
          (match) => ({
            ...match,
            url: options.notificationId
              ? this.generateTrackedUrl(
                  match.url,
                  options.notificationId,
                  'deal_alert'
                )
              : match.url,
          })
        );
      }
    }

    return data;
  }

  /**
   * Generates tracked URL with UTM parameters following TDD specification
   * @param originalUrl - Original deal URL
   * @param notificationId - Notification ID for tracking
   * @param campaign - UTM campaign identifier
   * @returns URL with UTM tracking parameters
   */
  private generateTrackedUrl(
    originalUrl: string,
    notificationId: string,
    campaign: string
  ): string {
    try {
      const url = new URL(originalUrl);

      // Add UTM parameters as specified in TDD
      url.searchParams.set('utm_source', 'dealscrapper');
      url.searchParams.set('utm_medium', 'email');
      url.searchParams.set('utm_campaign', campaign);
      url.searchParams.set('notification_id', notificationId);

      return url.toString();
    } catch (error) {
      // If URL parsing fails, return original URL
      this.logger.warn(`Failed to parse URL for UTM tracking: ${originalUrl}`);
      return originalUrl;
    }
  }

  // MJML Templates

  private getDealMatchTemplate(): string {
    return `
<mjml>
  <mj-head>
    <mj-title>🎯 New Deal Alert</mj-title>
    <mj-preview>{{dealTitle}} - €{{dealPrice}} at {{merchant}}</mj-preview>
    <mj-attributes>
      <mj-all font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" />
      <mj-button background-color="#007bff" border-radius="8px" font-size="16px" font-weight="bold" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f6f9fc">
    <mj-section background-color="#ffffff" border-radius="8px" padding="20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" color="#333333" align="center">
          🎯 New Deal Alert!
        </mj-text>
        
        {{#if dealImageUrl}}
        <mj-image src="{{dealImageUrl}}" alt="{{dealTitle}}" border-radius="8px" />
        {{/if}}
        
        <mj-text font-size="20px" font-weight="bold" color="#333333">
          {{dealTitle}}
        </mj-text>
        
        <!-- Price and Score Section -->
        <mj-section background-color="#f8f9fa" border-radius="8px" padding="15px">
          <mj-column width="50%">
            <mj-text font-size="14px" color="#666666">Price</mj-text>
            <mj-text font-size="24px" font-weight="bold" color="#28a745">€{{dealPrice}}</mj-text>
          </mj-column>
          <mj-column width="50%">
            <mj-text font-size="14px" color="#666666">Score</mj-text>
            <mj-text font-size="24px" font-weight="bold" color="#007bff">{{score}}/100</mj-text>
          </mj-column>
        </mj-section>
        
        {{#if savings}}
        <mj-text font-size="16px" color="#28a745" align="center">
          💰 You save €{{savings}}!
        </mj-text>
        {{/if}}
        
        <mj-text font-size="14px" color="#666666">
          <strong>Merchant:</strong> {{merchant}}<br>
          <strong>Filter:</strong> {{filterName}}
        </mj-text>
        
        <mj-button href="{{dealUrl}}">
          View Deal
        </mj-button>
        
        <mj-divider border-color="#e9ecef" />
        
        <mj-text font-size="12px" color="#999999" align="center">
          <a href="{{unsubscribeUrl}}" style="color: #999999;">Unsubscribe</a> | 
          <a href="{{preferencesUrl}}" style="color: #999999;">Preferences</a>
        </mj-text>
        
        {{#if trackingPixel}}
        <!-- Email open tracking pixel -->
        <mj-image src="{{trackingPixel}}" alt="" width="1px" height="1px" />
        {{/if}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
    `;
  }

  private getDigestTemplate(): string {
    return `
<mjml>
  <mj-head>
    <mj-title>📊 Your {{period}} deal digest</mj-title>
    <mj-preview>{{totalMatches}} new deals found</mj-preview>
  </mj-head>
  <mj-body background-color="#f6f9fc">
    <mj-section background-color="#ffffff" border-radius="8px" padding="20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" color="#333333" align="center">
          📊 Your {{period}} digest
        </mj-text>
        
        <mj-text font-size="18px" color="#666666" align="center">
          {{totalMatches}} new deals found
        </mj-text>
        
        {{#if totalSavings}}
        <mj-text font-size="16px" color="#28a745" align="center">
          💰 Potential savings: €{{totalSavings}}
        </mj-text>
        {{/if}}
        
        {{#if topDeal}}
        <!-- Top Deal Section -->
        <mj-section background-color="#f8f9fa" border-radius="8px" padding="15px">
          <mj-column>
            <mj-text font-size="16px" font-weight="bold" color="#333333">
              🏆 Top Deal
            </mj-text>
            <mj-text font-size="14px">
              {{topDeal.title}} - €{{topDeal.price}} (Score: {{topDeal.score}})
            </mj-text>
            <mj-button href="{{topDeal.url}}" font-size="14px">
              View Top Deal
            </mj-button>
          </mj-column>
        </mj-section>
        {{/if}}
        
        <!-- Grouped Matches Section -->
        {{#each groupedMatches}}
        <mj-section padding="10px 0">
          <mj-column>
            <mj-text font-size="16px" font-weight="bold" color="#333333" padding="10px 0 5px 0">
              {{@key}} ({{this.length}} deals)
            </mj-text>
            {{#each this}}
            <mj-text font-size="14px" padding="5px 0">
              • {{title}} - €{{price}} at {{merchant}} ({{score}}/100)
            </mj-text>
            {{/each}}
          </mj-column>
        </mj-section>
        {{/each}}
        
        <mj-divider border-color="#e9ecef" />
        
        <mj-text font-size="12px" color="#999999" align="center">
          <a href="{{unsubscribeUrl}}" style="color: #999999;">Unsubscribe</a> | 
          <a href="{{preferencesUrl}}" style="color: #999999;">Preferences</a>
        </mj-text>
        
        {{#if trackingPixel}}
        <!-- Email open tracking pixel -->
        <mj-image src="{{trackingPixel}}" alt="" width="1px" height="1px" />
        {{/if}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
    `;
  }

  private getSystemTemplate(): string {
    return `
<mjml>
  <mj-head>
    <mj-title>📢 DealScrapper Notification</mj-title>
  </mj-head>
  <mj-body background-color="#f6f9fc">
    <mj-section background-color="#ffffff" border-radius="8px" padding="20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" color="#333333" align="center">
          📢 DealScrapper
        </mj-text>
        
        <mj-text font-size="16px" color="#333333">
          {{message}}
        </mj-text>
        
        <mj-divider border-color="#e9ecef" />
        
        <mj-text font-size="12px" color="#999999" align="center">
          <a href="{{unsubscribeUrl}}" style="color: #999999;">Unsubscribe</a>
        </mj-text>
        
        {{#if trackingPixel}}
        <!-- Email open tracking pixel -->
        <mj-image src="{{trackingPixel}}" alt="" width="1px" height="1px" />
        {{/if}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
    `;
  }

  /**
   * MJML template for email verification notifications
   * Professional design with clear call-to-action and security messaging
   */
  private getEmailVerificationTemplate(): string {
    return `
<mjml>
  <mj-head>
    <mj-title>✅ Verify Your Email Address - DealScrapper</mj-title>
    <mj-preview>Complete your account setup by verifying your email address</mj-preview>
    <mj-attributes>
      <mj-all font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" />
      <mj-button background-color="#28a745" border-radius="6px" font-size="16px" font-weight="bold" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f6f9fc">
    <mj-section background-color="#ffffff" border-radius="8px" padding="40px 20px">
      <mj-column>
        <!-- Header -->
        <mj-text font-size="28px" font-weight="bold" color="#333333" align="center">
          ✅ Verify Your Email Address
        </mj-text>
        
        <mj-text font-size="16px" color="#666666" align="center" padding="10px 0 30px">
          Welcome to DealScrapper! Complete your account setup in just one click.
        </mj-text>
        
      </mj-column>
    </mj-section>
    
    <!-- Email Display -->
    <mj-section background-color="#f8f9fa" border-radius="6px" padding="20px">
      <mj-column>
        <mj-text font-size="14px" color="#666666" align="center">
          Verifying email address
        </mj-text>
        <mj-text font-size="18px" font-weight="bold" color="#333333" align="center">
          {{recipientEmail}}
        </mj-text>
      </mj-column>
    </mj-section>
    
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        
        <!-- Verification Button -->
        <mj-button href="{{verificationUrl}}" padding="30px 0">
          Verify Email Address
        </mj-button>
        
        <!-- Alternative Link -->
        <mj-text font-size="14px" color="#666666" align="center" padding="20px 0 10px">
          If the button doesn't work, copy and paste this link into your browser:
        </mj-text>
        
        <mj-text font-size="12px" color="#007bff" align="center" padding="0 20px">
          <a href="{{verificationUrl}}" style="color: #007bff; word-break: break-all;">{{verificationUrl}}</a>
        </mj-text>
        
        <!-- Security Note -->
        <mj-divider border-color="#e9ecef" padding="30px 0 20px" />
        
        <mj-text font-size="13px" color="#999999" align="center" padding="0 20px">
          🔒 This verification link will expire in 24 hours for security.
        </mj-text>
        
        <mj-text font-size="12px" color="#999999" align="center" padding="15px 20px 0">
          If you didn't create an account with DealScrapper, you can safely ignore this email.
        </mj-text>
        
        <!-- Support Link -->
        <mj-text font-size="12px" color="#999999" align="center" padding="10px 0 0">
          Need help? Visit <a href="{{supportUrl}}" style="color: #007bff;">DealScrapper Support</a>
        </mj-text>
        
        {{#if trackingPixel}}
        <!-- Email open tracking pixel -->
        <mj-image src="{{trackingPixel}}" alt="" width="1px" height="1px" />
        {{/if}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
    `;
  }

  private getPasswordResetTemplate(): string {
    return `
<mjml>
  <mj-head>
    <mj-title>Reset your DealScrapper password</mj-title>
    <mj-preview>Reset your DealScrapper password — link expires in {{expiresIn}}</mj-preview>
    <mj-attributes>
      <mj-all font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" />
      <mj-button background-color="#007bff" border-radius="6px" font-size="16px" font-weight="bold" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f6f9fc">
    <mj-section background-color="#ffffff" border-radius="8px" padding="40px 20px">
      <mj-column>
        <mj-text font-size="28px" font-weight="bold" color="#333333" align="center">
          Reset Your Password
        </mj-text>

        <mj-text font-size="16px" color="#666666" align="center" padding="10px 0 30px">
          We received a request to reset the password for your account.
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#f8f9fa" border-radius="6px" padding="20px">
      <mj-column>
        <mj-text font-size="14px" color="#666666" align="center">
          Account email
        </mj-text>
        <mj-text font-size="18px" font-weight="bold" color="#333333" align="center">
          {{recipientEmail}}
        </mj-text>
      </mj-column>
    </mj-section>

    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-button href="{{resetUrl}}" padding="30px 0">
          Reset Password
        </mj-button>

        <mj-text font-size="14px" color="#666666" align="center" padding="20px 0 10px">
          If the button doesn't work, copy and paste this link into your browser:
        </mj-text>

        <mj-text font-size="12px" color="#007bff" align="center" padding="0 20px">
          <a href="{{resetUrl}}" style="color: #007bff; word-break: break-all;">{{resetUrl}}</a>
        </mj-text>

        <mj-divider border-color="#e9ecef" padding="30px 0 20px" />

        <mj-text font-size="13px" color="#999999" align="center" padding="0 20px">
          This link expires in {{expiresIn}} for security.
        </mj-text>

        <mj-text font-size="12px" color="#999999" align="center" padding="15px 20px 0">
          If you didn't request a password reset, you can safely ignore this email.
        </mj-text>

        {{#if trackingPixel}}
        <!-- Email open tracking pixel -->
        <mj-image src="{{trackingPixel}}" alt="" width="1px" height="1px" />
        {{/if}}
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
    `;
  }
}
