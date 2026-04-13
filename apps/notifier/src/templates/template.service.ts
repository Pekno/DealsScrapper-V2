import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { SharedConfigService } from '@dealscrapper/shared-config';
import Handlebars from 'handlebars';
import { extractErrorMessage } from '../utils/error-handling.utils.js';
import { notifierLogConfig } from '../config/logging.config.js';
import { sanitizeUrl, sanitizeInput } from '../utils/sanitization.utils.js';

export interface TemplateData {
  user?: {
    name?: string;
    email?: string;
    id: string;
  };
  deal?: {
    title: string;
    price: number;
    originalPrice?: number;
    merchant: string;
    score: number;
    url: string;
    imageUrl?: string;
    category?: string;
    discountPercentage?: number;
    savings?: number;
  };
  filter?: {
    name: string;
    id: string;
  };
  system?: {
    subject: string;
    message: string;
    priority: 'high' | 'normal' | 'low';
  };
  digest?: {
    matches: Array<{
      title: string;
      price: number;
      url: string;
      score: number;
      merchant: string;
      filterName: string;
    }>;
    frequency: 'daily' | 'weekly';
    periodStart: Date;
    periodEnd: Date;
  };
  branding?: {
    appName: string;
    logoUrl?: string;
    primaryColor: string;
    supportEmail: string;
    unsubscribeUrl?: string;
  };
}

export interface TemplateOutput {
  subject?: string;
  title: string;
  body: string;
  htmlBody?: string;
  metadata?: Record<string, string | number | boolean | Date>;
}

@Injectable()
export class TemplateService {
  private readonly logger = createServiceLogger(notifierLogConfig);
  private handlebars: typeof Handlebars;
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(private readonly sharedConfig: SharedConfigService) {
    this.handlebars = Handlebars;
    this.registerHelpers();
    this.initializeTemplates();
  }

  /**
   * Sanitizes template data to prevent XSS attacks
   * @param data - Raw template data
   * @returns Sanitized template data safe for rendering
   */
  private sanitizeTemplateData(data: TemplateData): TemplateData {
    const sanitized: TemplateData = {};

    if (data.user) {
      sanitized.user = {
        id: String(data.user.id).replace(/[^a-zA-Z0-9-_]/g, ''), // Sanitize ID
        name: data.user.name ? sanitizeInput(data.user.name) : undefined,
        email: data.user.email ? sanitizeInput(data.user.email) : undefined,
      };
    }

    if (data.deal) {
      // Enhanced sanitization for deal data
      sanitized.deal = {
        title: sanitizeInput(data.deal.title),
        price:
          typeof data.deal.price === 'number'
            ? Math.max(0, data.deal.price)
            : 0,
        originalPrice:
          typeof data.deal.originalPrice === 'number'
            ? Math.max(0, data.deal.originalPrice)
            : undefined,
        merchant: sanitizeInput(data.deal.merchant),
        score:
          typeof data.deal.score === 'number'
            ? Math.max(0, Math.min(100, data.deal.score))
            : 0,
        url: sanitizeUrl(data.deal.url),
        imageUrl: data.deal.imageUrl
          ? sanitizeUrl(data.deal.imageUrl)
          : undefined,
        category: data.deal.category
          ? sanitizeInput(data.deal.category)
          : undefined,
        discountPercentage:
          typeof data.deal.discountPercentage === 'number'
            ? Math.max(0, Math.min(100, data.deal.discountPercentage))
            : undefined,
        savings:
          typeof data.deal.savings === 'number'
            ? Math.max(0, data.deal.savings)
            : undefined,
      };
    }

    if (data.filter) {
      sanitized.filter = {
        name: sanitizeInput(data.filter.name),
        id: String(data.filter.id).replace(/[^a-zA-Z0-9-_]/g, ''), // Sanitize ID
      };
    }

    if (data.system) {
      sanitized.system = {
        subject: sanitizeInput(data.system.subject),
        message: sanitizeInput(data.system.message),
        priority: ['high', 'normal', 'low'].includes(data.system.priority)
          ? data.system.priority
          : 'normal', // Validate enum
      };
    }

    if (data.digest) {
      sanitized.digest = {
        matches: data.digest.matches.map((match) => ({
          title: sanitizeInput(match.title),
          price: typeof match.price === 'number' ? Math.max(0, match.price) : 0,
          url: sanitizeUrl(match.url),
          score:
            typeof match.score === 'number'
              ? Math.max(0, Math.min(100, match.score))
              : 0,
          merchant: sanitizeInput(match.merchant),
          filterName: sanitizeInput(match.filterName),
        })),
        frequency: ['daily', 'weekly', 'monthly'].includes(
          data.digest.frequency
        )
          ? data.digest.frequency
          : 'daily', // Validate enum
        periodStart:
          data.digest.periodStart instanceof Date
            ? data.digest.periodStart
            : new Date(),
        periodEnd:
          data.digest.periodEnd instanceof Date
            ? data.digest.periodEnd
            : new Date(),
      };
    }

    if (data.branding) {
      sanitized.branding = {
        appName: sanitizeInput(data.branding.appName),
        logoUrl: data.branding.logoUrl
          ? sanitizeUrl(data.branding.logoUrl)
          : undefined,
        primaryColor: this.sanitizeColor(data.branding.primaryColor),
        supportEmail: sanitizeInput(data.branding.supportEmail),
        unsubscribeUrl: data.branding.unsubscribeUrl
          ? sanitizeUrl(data.branding.unsubscribeUrl)
          : undefined,
      };
    }

    // Sanitize verification email data
    if ('verificationUrl' in data) {
      (sanitized as Record<string, unknown>).verificationUrl = sanitizeUrl((data as Record<string, unknown>).verificationUrl);
    }
    if ('supportUrl' in data) {
      (sanitized as Record<string, unknown>).supportUrl = sanitizeUrl((data as Record<string, unknown>).supportUrl);
    }
    if ('recipientEmail' in data) {
      (sanitized as Record<string, unknown>).recipientEmail = sanitizeInput((data as Record<string, unknown>).recipientEmail);
    }

    return sanitized;
  }

  private registerHelpers(): void {
    // Currency formatter
    this.handlebars.registerHelper('currency', (amount: unknown) => {
      // Validate and sanitize amount input
      if (amount === null || amount === undefined) {
        return new Handlebars.SafeString('€0.00');
      }

      const numAmount =
        typeof amount === 'number' ? amount : parseFloat(String(amount));

      // Check for valid number
      if (isNaN(numAmount) || !isFinite(numAmount)) {
        return new Handlebars.SafeString('€0.00');
      }

      // Prevent extremely large numbers that could cause issues
      const safeAmount = Math.max(0, Math.min(numAmount, 999999999));

      return new Handlebars.SafeString(`€${safeAmount.toFixed(2)}`);
    });

    // Percentage formatter
    this.handlebars.registerHelper('percentage', (value: number) => {
      return new Handlebars.SafeString(`${Math.round(value)}%`);
    });

    // Score color helper
    this.handlebars.registerHelper('scoreColor', (score: number) => {
      if (score >= 95) return '#10B981'; // Green
      if (score >= 85) return '#F59E0B'; // Orange
      if (score >= 70) return '#6B7280'; // Gray
      return '#EF4444'; // Red
    });

    // Truncate helper
    this.handlebars.registerHelper(
      'truncate',
      (text: unknown, length: number = 50) => {
        if (!text) return new Handlebars.SafeString('');

        // More aggressive sanitization for helpers - remove HTML tags entirely
        let sanitizedText = sanitizeInput(text);
        sanitizedText = sanitizedText
          .replace(/<[^>]*>/g, '') // Remove all HTML tags
          .replace(/&[a-zA-Z0-9#]+;/g, '') // Remove HTML entities
          .trim();

        // Ensure length is a safe positive number
        const safeLength =
          typeof length === 'number' && length > 0
            ? Math.min(length, 1000)
            : 50;

        const truncated =
          sanitizedText.length <= safeLength
            ? sanitizedText
            : sanitizedText.substring(0, safeLength) + '...';

        return new Handlebars.SafeString(truncated);
      }
    );

    // Date formatter
    this.handlebars.registerHelper('formatDate', (date: Date) => {
      return date.toLocaleDateString('en-EU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Emoji helper
    this.handlebars.registerHelper('emoji', (type: string) => {
      const emojiMap: Record<string, string> = {
        deal: '🎯',
        fire: '🔥',
        money: '💰',
        save: '💸',
        alert: '🚨',
        star: '⭐',
        heart: '❤️',
        check: '✅',
        warning: '⚠️',
        info: 'ℹ️',
        mail: '📧',
        phone: '📱',
        bell: '🔔',
      };
      return emojiMap[type] || '';
    });

    // Equality helper for conditional rendering
    this.handlebars.registerHelper(
      'eq',
      function (a: unknown, b: unknown, options: Handlebars.HelperOptions) {
        if (a === b) {
          return options.fn(this);
        }
        return options.inverse(this);
      }
    );
  }

  private initializeTemplates(): void {
    // Deal Match Templates

    this.templates.set(
      'deal-match-email-subject',
      this.handlebars.compile(
        '{{emoji "deal"}} Deal Alert: {{truncate deal.title 60}} - {{currency deal.price}}'
      )
    );

    // System Notification Templates

    this.templates.set(
      'system-email-subject',
      this.handlebars.compile('[{{branding.appName}}] {{system.subject}}')
    );

    // Digest Templates
    this.templates.set(
      'digest-email-subject',
      this.handlebars.compile(
        '{{emoji "fire"}} Your {{digest.frequency}} deal summary - {{digest.matches.length}} matches found'
      )
    );

    this.logger.log('📄 Template system initialized with Handlebars helpers');
  }

  // Deal Match Templates

  async generateDealMatchEmail(data: TemplateData): Promise<TemplateOutput> {
    if (!data.deal) {
      throw new Error('Deal data is required for deal match email template');
    }

    // Add default branding if not provided
    if (!data.branding) {
      data.branding = this.sharedConfig.getBrandingConfig();
    }

    // Calculate savings for template
    if (data.deal.originalPrice && data.deal.originalPrice > data.deal.price) {
      data.deal.savings = data.deal.originalPrice - data.deal.price;
      data.deal.discountPercentage =
        (data.deal.savings / data.deal.originalPrice) * 100;
    }

    // Sanitize all input data to prevent XSS
    const sanitizedData = this.sanitizeTemplateData(data);

    const subject = this.templates.get('deal-match-email-subject')!(
      sanitizedData
    );

    // Generate HTML body using MJML template structure matching frontend design
    const htmlTemplate = this.handlebars.compile(`
      <mjml>
        <mj-head>
          <mj-title>{{subject}}</mj-title>
          <mj-attributes>
            <mj-all font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif" />
            <mj-button background-color="#0F62FE" color="white" border-radius="9999px" font-weight="600" padding="12px 24px" />
            <mj-text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif" line-height="1.6" />
          </mj-attributes>
          <mj-style>
            .deal-card {
              background: white;
              border-radius: 12px;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
              overflow: hidden;
              margin-bottom: 16px;
            }
            .price-highlight {
              background: linear-gradient(135deg, #EBF4FF 0%, #DBEAFE 100%);
              border-radius: 8px;
              padding: 16px;
            }
            .score-badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 9999px;
              font-size: 12px;
              font-weight: 600;
            }
          </mj-style>
        </mj-head>
        <mj-body background-color="#F9FAFB">
          <!-- Header -->
          <mj-section background-color="#F9FAFB" padding="20px 20px 0">
            <mj-column>
              <mj-text align="center" font-size="16px" color="#6B7280" padding="0">
                {{branding.appName}}
              </mj-text>
            </mj-column>
          </mj-section>
          
          <!-- Main Deal Card -->
          <mj-section background-color="#F9FAFB" padding="16px">
            <mj-column>
              <mj-wrapper css-class="deal-card" background-color="white" border-radius="12px" padding="0">
                
                <!-- Deal Header -->
                <mj-section background-color="white" padding="24px 24px 16px">
                  <mj-column>
                    <mj-text font-size="28px" font-weight="700" color="#111827" align="center" padding="0 0 8px">
                      {{emoji "deal"}} Deal Found!
                    </mj-text>
                    <mj-text font-size="14px" color="#6B7280" align="center" padding="0">
                      Perfect match for your filters
                    </mj-text>
                  </mj-column>
                </mj-section>

                <!-- Product Image -->
                {{#if deal.imageUrl}}
                <mj-section background-color="white" padding="0 24px 16px">
                  <mj-column>
                    <mj-image src="{{deal.imageUrl}}" alt="{{deal.title}}" width="280px" border-radius="8px" />
                  </mj-column>
                </mj-section>
                {{/if}}
                
                <!-- Product Info -->
                <mj-section background-color="white" padding="0 24px 20px">
                  <mj-column>
                    <mj-text font-size="20px" font-weight="600" color="#111827" align="center" padding="0 0 8px">
                      {{deal.title}}
                    </mj-text>
                    
                    <mj-text font-size="16px" color="#6B7280" align="center" padding="0 0 16px">
                      at <strong>{{deal.merchant}}</strong>
                    </mj-text>
                    
                    {{#if deal.category}}
                    <mj-text align="center" padding="0 0 16px">
                      <span style="background: #EBF4FF; color: #0F62FE; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">
                        {{deal.category}}
                      </span>
                    </mj-text>
                    {{/if}}
                  </mj-column>
                </mj-section>

                <!-- Price Section -->
                <mj-section background-color="white" padding="0 24px 20px">
                  <mj-column>
                    <mj-wrapper css-class="price-highlight">
                      <mj-section background-color="transparent" padding="0">
                        <mj-column>
                          <mj-text align="center" padding="0 0 8px">
                            <span style="font-size: 32px; color: #0F62FE; font-weight: 700;">
                              {{currency deal.price}}
                            </span>
                            {{#if deal.originalPrice}}
                            <span style="font-size: 18px; color: #9CA3AF; text-decoration: line-through; margin-left: 12px;">
                              {{currency deal.originalPrice}}
                            </span>
                            {{/if}}
                          </mj-text>
                          
                          {{#if deal.savings}}
                          <mj-text align="center" padding="0 0 12px">
                            <span style="background: #10B981; color: white; padding: 6px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600;">
                              {{emoji "save"}} Save {{currency deal.savings}} ({{percentage deal.discountPercentage}} off!)
                            </span>
                          </mj-text>
                          {{/if}}
                          
                          <mj-text align="center" padding="0">
                            <span class="score-badge" style="background: {{scoreColor deal.score}}; color: white;">
                              {{emoji "star"}} {{deal.score}}/100
                            </span>
                          </mj-text>
                        </mj-column>
                      </mj-section>
                    </mj-wrapper>
                  </mj-column>
                </mj-section>
                
                <!-- CTA Button -->
                <mj-section background-color="white" padding="0 24px 24px">
                  <mj-column>
                    <mj-button href="{{deal.url}}" background-color="#0F62FE" color="white" border-radius="9999px" font-weight="600" font-size="16px" padding="14px 28px">
                      View Deal {{emoji "fire"}}
                    </mj-button>
                  </mj-column>
                </mj-section>
                
              </mj-wrapper>
            </mj-column>
          </mj-section>
          
          <!-- Filter Info -->
          {{#if filter.name}}
          <mj-section background-color="#F9FAFB" padding="0 20px 16px">
            <mj-column>
              <mj-text font-size="14px" color="#6B7280" align="center" padding="0">
                {{emoji "bell"}} This deal matches your filter: <strong>{{filter.name}}</strong>
              </mj-text>
            </mj-column>
          </mj-section>
          {{/if}}
          
          <!-- Footer -->
          <mj-section background-color="#F9FAFB" padding="16px 20px 20px">
            <mj-column>
              <mj-divider border-color="#E5E7EB" border-width="1px" padding="0 0 16px" />
              <mj-text font-size="12px" color="#9CA3AF" align="center" padding="0">
                {{branding.appName}} • {{branding.supportEmail}}
                {{#if branding.unsubscribeUrl}}
                <br><br><a href="{{branding.unsubscribeUrl}}" style="color: #6B7280;">Unsubscribe from deal alerts</a>
                {{/if}}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `);

    const htmlBody = htmlTemplate(sanitizedData);

    // Generate plain text version
    const textTemplate = this.handlebars.compile(
      `🎯 DEAL ALERT!·{{deal.title}}·at {{deal.merchant}}·Price: {{currency deal.price}}{{#if deal.originalPrice}} (was {{currency deal.originalPrice}}){{/if}}··{{#if deal.savings}}💸 Save {{currency deal.savings}} ({{percentage deal.discountPercentage}} off!){{/if}}·⭐ Deal Score: {{deal.score}}/100·View Deal: {{deal.url}}···{{#if filter.name}}This deal matches your filter: {{filter.name}}{{/if}}···---·{{branding.appName}}·{{branding.supportEmail}}·{{#if branding.unsubscribeUrl}}Unsubscribe: {{branding.unsubscribeUrl}}{{/if}}`
    );

    const body = textTemplate(sanitizedData);

    return {
      subject,
      title: subject,
      body,
      htmlBody,
      metadata: {
        type: 'deal-match',
        dealUrl: data.deal.url,
        score: data.deal.score,
        merchant: data.deal.merchant,
        hasImage: !!data.deal.imageUrl,
        hasSavings: !!data.deal.savings,
      },
    };
  }

  // System Notification Templates

  async generateSystemEmail(data: TemplateData): Promise<TemplateOutput> {
    if (!data.system) {
      throw new Error('System data is required for system email template');
    }

    if (!data.branding) {
      data.branding = this.sharedConfig.getBrandingConfig();
    }

    const subject = this.templates.get('system-email-subject')!(data);

    // Generate HTML body using MJML template structure matching frontend design
    const htmlTemplate = this.handlebars.compile(`
      <mjml>
        <mj-head>
          <mj-title>{{subject}}</mj-title>
          <mj-attributes>
            <mj-all font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif" />
            <mj-text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif" line-height="1.6" />
          </mj-attributes>
          <mj-style>
            .system-card {
              background: white;
              border-radius: 12px;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
              overflow: hidden;
            }
            .priority-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 9999px;
              font-size: 12px;
              font-weight: 600;
            }
          </mj-style>
        </mj-head>
        <mj-body background-color="#F9FAFB">
          <!-- Header -->
          <mj-section background-color="#F9FAFB" padding="20px 20px 0">
            <mj-column>
              <mj-text align="center" font-size="16px" color="#6B7280" padding="0">
                {{branding.appName}}
              </mj-text>
            </mj-column>
          </mj-section>
          
          <!-- Main System Card -->
          <mj-section background-color="#F9FAFB" padding="16px">
            <mj-column>
              <mj-wrapper css-class="system-card" background-color="white" border-radius="12px" padding="0">
                
                <!-- System Header -->
                <mj-section background-color="white" padding="24px 24px 16px">
                  <mj-column>
                    <mj-text font-size="24px" font-weight="700" color="#111827" align="center" padding="0 0 8px">
                      {{emoji "bell"}} {{system.subject}}
                    </mj-text>
                    
                    {{#if system.priority}}
                    <mj-text align="center" padding="0 0 16px">
                      {{#eq system.priority 'high'}}
                      <span class="priority-badge" style="background: #FEE2E2; color: #DC2626;">High Priority</span>
                      {{else}}
                      {{#eq system.priority 'low'}}
                      <span class="priority-badge" style="background: #F3F4F6; color: #6B7280;">Low Priority</span>
                      {{else}}
                      <span class="priority-badge" style="background: #EBF4FF; color: #0F62FE;">Normal Priority</span>
                      {{/eq}}
                      {{/eq}}
                    </mj-text>
                    {{/if}}
                  </mj-column>
                </mj-section>
                
                <!-- System Message -->
                <mj-section background-color="white" padding="0 24px 24px">
                  <mj-column>
                    <mj-text font-size="16px" color="#374151" line-height="1.6" padding="0">
                      {{system.message}}
                    </mj-text>
                  </mj-column>
                </mj-section>
                
              </mj-wrapper>
            </mj-column>
          </mj-section>
          
          <!-- Footer -->
          <mj-section background-color="#F9FAFB" padding="16px 20px 20px">
            <mj-column>
              <mj-divider border-color="#E5E7EB" border-width="1px" padding="0 0 16px" />
              <mj-text font-size="12px" color="#9CA3AF" align="center" padding="0">
                {{branding.appName}} • {{branding.supportEmail}}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `);

    const htmlBody = htmlTemplate(data);

    // Generate plain text version
    const textTemplate = this.handlebars.compile(`
🔔 {{system.subject}}

{{system.message}}

{{#if system.priority}}Priority: {{system.priority}}{{/if}}

---
{{branding.appName}}
{{branding.supportEmail}}
    `);

    const body = textTemplate(data);

    return {
      subject,
      title: subject,
      body,
      htmlBody,
      metadata: {
        type: 'system',
        priority: data.system.priority,
        subject: data.system.subject,
      },
    };
  }

  // Digest Templates

  async generateDigestEmail(data: TemplateData): Promise<TemplateOutput> {
    if (
      !data.digest ||
      !data.digest.matches ||
      data.digest.matches.length === 0
    ) {
      throw new Error(
        'Digest data with matches is required for digest email template'
      );
    }

    if (!data.branding) {
      data.branding = this.sharedConfig.getBrandingConfig();
    }

    const subject = this.templates.get('digest-email-subject')!(data);

    // Generate HTML body using MJML template structure matching frontend design
    const htmlTemplate = this.handlebars.compile(`
      <mjml>
        <mj-head>
          <mj-title>{{subject}}</mj-title>
          <mj-attributes>
            <mj-all font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif" />
            <mj-button background-color="#0F62FE" color="white" border-radius="9999px" font-weight="600" padding="10px 20px" />
            <mj-text font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif" line-height="1.6" />
          </mj-attributes>
          <mj-style>
            .digest-card {
              background: white;
              border-radius: 12px;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
              overflow: hidden;
              margin-bottom: 16px;
            }
            .deal-item {
              border: 1px solid #E5E7EB;
              border-radius: 8px;
              margin-bottom: 12px;
              overflow: hidden;
            }
            .score-badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 9999px;
              font-size: 12px;
              font-weight: 600;
              color: white;
            }
            .filter-tag {
              background: #EBF4FF;
              color: #0F62FE;
              padding: 2px 8px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 600;
            }
          </mj-style>
        </mj-head>
        <mj-body background-color="#F9FAFB">
          <!-- Header -->
          <mj-section background-color="#F9FAFB" padding="20px 20px 0">
            <mj-column>
              <mj-text align="center" font-size="16px" color="#6B7280" padding="0">
                {{branding.appName}}
              </mj-text>
            </mj-column>
          </mj-section>
          
          <!-- Main Digest Card -->
          <mj-section background-color="#F9FAFB" padding="16px">
            <mj-column>
              <mj-wrapper css-class="digest-card" background-color="white" border-radius="12px" padding="0">
                
                <!-- Digest Header -->
                <mj-section background-color="white" padding="24px 24px 20px">
                  <mj-column>
                    <mj-text font-size="28px" font-weight="700" color="#111827" align="center" padding="0 0 8px">
                      {{emoji "fire"}} Your {{digest.frequency}} Deal Summary
                    </mj-text>
                    
                    <mj-text font-size="14px" color="#6B7280" align="center" padding="0 0 16px">
                      {{formatDate digest.periodStart}} - {{formatDate digest.periodEnd}}
                    </mj-text>
                    
                    <mj-text font-size="18px" color="#374151" align="center" padding="0">
                      We found <strong style="color: #0F62FE;">{{digest.matches.length}} deals</strong> matching your filters!
                    </mj-text>
                  </mj-column>
                </mj-section>
                
                <!-- Deals List -->
                <mj-section background-color="white" padding="0 24px 20px">
                  <mj-column>
                    {{#each digest.matches}}
                    <mj-wrapper css-class="deal-item" background-color="#FAFBFC" padding="0" border="1px solid #E5E7EB" border-radius="8px">
                      <mj-section background-color="#FAFBFC" padding="16px">
                        <mj-column>
                          <mj-text font-size="16px" font-weight="600" color="#111827" padding="0 0 4px">
                            {{title}}
                          </mj-text>
                          
                          <mj-text font-size="14px" color="#6B7280" padding="0 0 8px">
                            <strong>{{merchant}}</strong> • <span class="filter-tag">{{filterName}}</span>
                          </mj-text>
                          
                          <mj-text padding="0 0 12px">
                            <span style="font-size: 20px; color: #0F62FE; font-weight: 700;">
                              {{currency price}}
                            </span>
                            <span class="score-badge" style="background: {{scoreColor score}}; margin-left: 12px;">
                              {{emoji "star"}} {{score}}/100
                            </span>
                          </mj-text>
                          
                          <mj-button href="{{url}}" background-color="#0F62FE" color="white" border-radius="9999px" font-weight="600" font-size="14px" padding="8px 16px">
                            View Deal
                          </mj-button>
                        </mj-column>
                      </mj-section>
                    </mj-wrapper>
                    {{/each}}
                  </mj-column>
                </mj-section>
                
                <!-- Summary Footer -->
                <mj-section background-color="#F8F9FA" padding="20px 24px 24px">
                  <mj-column>
                    <mj-text align="center" font-size="16px" color="#374151" padding="0 0 8px">
                      That's all for your {{digest.frequency}} summary! {{emoji "check"}}
                    </mj-text>
                    <mj-text align="center" font-size="14px" color="#6B7280" padding="0">
                      Keep your filters active to catch the best deals.
                    </mj-text>
                  </mj-column>
                </mj-section>
                
              </mj-wrapper>
            </mj-column>
          </mj-section>
          
          <!-- Footer -->
          <mj-section background-color="#F9FAFB" padding="16px 20px 20px">
            <mj-column>
              <mj-divider border-color="#E5E7EB" border-width="1px" padding="0 0 16px" />
              <mj-text font-size="12px" color="#9CA3AF" align="center" padding="0">
                {{branding.appName}} • {{branding.supportEmail}}
                {{#if branding.unsubscribeUrl}}
                <br><br><a href="{{branding.unsubscribeUrl}}" style="color: #6B7280;">Unsubscribe from digest emails</a>
                {{/if}}
              </mj-text>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `);

    const htmlBody = htmlTemplate(data);

    // Generate plain text version
    const textTemplate = this.handlebars.compile(`
🔥 Your {{digest.frequency}} Deal Summary

{{formatDate digest.periodStart}} - {{formatDate digest.periodEnd}}

We found {{digest.matches.length}} deals matching your filters!

{{#each digest.matches}}
---
{{title}}
{{merchant}} • Filter: {{filterName}}
Price: {{currency price}} • ⭐ {{score}}/100
View: {{url}}

{{/each}}---

That's all for your {{digest.frequency}} summary!
Keep your filters active to catch the best deals.

{{branding.appName}}
{{branding.supportEmail}}
{{#if branding.unsubscribeUrl}}Unsubscribe: {{branding.unsubscribeUrl}}{{/if}}
    `);

    const body = textTemplate(data);

    return {
      subject,
      title: subject,
      body,
      htmlBody,
      metadata: {
        type: 'digest',
        frequency: data.digest.frequency,
        matchCount: data.digest.matches.length,
        periodStart: data.digest.periodStart,
        periodEnd: data.digest.periodEnd,
      },
    };
  }

  // Utility Methods

  /**
   * Sanitizes color values to prevent CSS injection
   * @param color - Color value to sanitize
   * @returns Safe color value
   */
  private sanitizeColor(color: string): string {
    if (!color || typeof color !== 'string') {
      return '#0F62FE'; // Default safe color
    }

    // Allow only hex colors, rgb/rgba, and named colors
    const colorPattern =
      /^(#[0-9A-Fa-f]{3,6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[0-9.]+\s*\)|[a-zA-Z]+)$/;

    if (colorPattern.test(color.trim())) {
      return color.trim();
    }

    return '#0F62FE'; // Default safe color
  }

  private calculatePriority(score: number): 'high' | 'normal' | 'low' {
    if (score >= 90) return 'high';
    if (score >= 70) return 'normal';
    return 'low';
  }

  // Template customization methods

  registerCustomTemplate(name: string, template: string): void {
    this.templates.set(name, this.handlebars.compile(template));
    this.logger.log(`📄 Registered custom template: ${name}`);
  }

  registerCustomHelper(name: string, helper: Handlebars.HelperDelegate): void {
    this.handlebars.registerHelper(name, helper);
    this.logger.log(`📄 Registered custom helper: ${name}`);
  }

  // Template validation and testing

  async validateTemplate(
    templateName: string,
    sampleData: TemplateData
  ): Promise<{ valid: boolean; error?: string; output?: string }> {
    try {
      const template = this.templates.get(templateName);
      if (!template) {
        return { valid: false, error: `Template '${templateName}' not found` };
      }

      const output = template(sampleData);
      return { valid: true, output };
    } catch (error) {
      return {
        valid: false,
        error: extractErrorMessage(error),
      };
    }
  }

  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  getTemplateStats(): {
    totalTemplates: number;
    totalHelpers: number;
    registeredTemplates: string[];
  } {
    return {
      totalTemplates: this.templates.size,
      totalHelpers: Object.keys(this.handlebars.helpers).length,
      registeredTemplates: this.getAvailableTemplates(),
    };
  }
}
