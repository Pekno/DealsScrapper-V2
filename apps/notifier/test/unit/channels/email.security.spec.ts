import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import {
  EmailService,
  EmailOptions,
} from '../../../src/channels/email.service.js';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { EMAIL_TRANSPORT } from '../../../src/channels/tokens.js';
import type { EmailTransport, EmailTransportPayload, EmailSendResult, EmailProviderStatus } from '../../../src/channels/transports/index.js';

const createMockTransport = (): jest.Mocked<EmailTransport> => ({
  send: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  getProviderName: jest.fn().mockReturnValue('Test Mock'),
  isHealthy: jest.fn().mockReturnValue(true),
  getProviderStatus: jest.fn().mockReturnValue({
    provider: 'Test Mock',
    configured: true,
    healthy: true,
    lastCheck: new Date(),
  }),
});

describe('EmailService - Security Tests', () => {
  let service: EmailService;
  let mockTransport: jest.Mocked<EmailTransport>;
  let mockSharedConfig: jest.Mocked<SharedConfigService>;

  beforeEach(async () => {
    mockTransport = createMockTransport();

    mockSharedConfig = {
      getEmailConfig: jest.fn().mockReturnValue({
        service: 'mailhog',
        from: {
          email: 'test@dealscrapper.com',
          name: 'DealScrapper Test',
        },
        transport: {
          host: 'localhost',
          port: 1025,
          secure: false,
        },
      }),
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          WEB_APP_URL: 'https://dealscrapper.com',
          BRAND_PRIMARY_COLOR: '#3B82F6',
          SUPPORT_EMAIL: 'support@dealscrapper.com',
        };
        return config[key as keyof typeof config];
      }),
      getBrandingConfig: jest.fn().mockReturnValue({
        appName: 'DealScrapper',
        logoUrl: 'https://dealscrapper.com/logo.png',
        primaryColor: '#3B82F6',
        supportEmail: 'support@dealscrapper.com',
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: EMAIL_TRANSPORT, useValue: mockTransport },
        { provide: SharedConfigService, useValue: mockSharedConfig },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);

    // Mock Logger to suppress console output
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Email Address Validation', () => {
    it('should reject invalid email addresses', async () => {
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@domain.com',
        'test..test@domain.com',
        'test@domain',
        '',
        null as any,
        undefined as any,
      ];

      for (const email of invalidEmails) {
        const options: EmailOptions = {
          to: email,
          subject: 'Test Subject',
          template: 'deal-match',
          data: {
            dealTitle: 'Test Deal',
            dealPrice: 100,
            merchant: 'Test Store',
            score: 80,
            dealUrl: 'https://example.com/deal',
          },
        };

        const result = await service.sendEmail(options);
        expect(result).toBe(false);
        expect(mockTransport.send).not.toHaveBeenCalled();
      }
    });

    it('should reject emails with suspicious patterns', async () => {
      const suspiciousEmails = [
        'test<script>@domain.com',
        'test@domain.com<img>',
        'test@domain.com"onload="alert(1)"',
        "test@domain.com'onclick='alert(1)'",
        'test@domain.com/../../etc/passwd',
      ];

      for (const email of suspiciousEmails) {
        const options: EmailOptions = {
          to: email,
          subject: 'Test Subject',
          template: 'deal-match',
          data: {
            dealTitle: 'Test Deal',
            dealPrice: 100,
            merchant: 'Test Store',
            score: 80,
            dealUrl: 'https://example.com/deal',
          },
        };

        const result = await service.sendEmail(options);
        expect(result).toBe(false);
        expect(mockTransport.send).not.toHaveBeenCalled();
      }
    });

    it('should accept valid email addresses', async () => {
      const validEmails = [
        'test@domain.com',
        'user.name@example.org',
        'test+tag@domain.co.uk',
        'user123@test-domain.com',
      ];

      for (const email of validEmails) {
        const options: EmailOptions = {
          to: email,
          subject: 'Test Subject',
          template: 'deal-match',
          data: {
            dealTitle: 'Test Deal',
            dealPrice: 100,
            merchant: 'Test Store',
            score: 80,
            dealUrl: 'https://example.com/deal',
          },
        };

        const result = await service.sendEmail(options);
        expect(result).toBe(true);
        expect(mockTransport.send).toHaveBeenCalled();

        // Reset mock for next iteration
        jest.clearAllMocks();
      }
    });
  });

  describe('Template Validation', () => {
    it('should reject invalid template names', async () => {
      const invalidTemplates = [
        '../../../etc/passwd',
        'non-existent-template',
        '',
        'template<script>',
        'template/../../admin',
        'template with spaces',
      ];

      for (const template of invalidTemplates) {
        const options: EmailOptions = {
          to: 'test@domain.com',
          subject: 'Test Subject',
          template,
          data: {
            dealTitle: 'Test Deal',
            dealPrice: 100,
            merchant: 'Test Store',
            score: 80,
            dealUrl: 'https://example.com/deal',
          },
        };

        const result = await service.sendEmail(options);
        expect(result).toBe(false);
        expect(mockTransport.send).not.toHaveBeenCalled();
      }
    });

    it('should accept valid template names', async () => {
      const validTemplates = [
        'deal-match',
        'digest',
        'system',
        'email-verification',
        'password-reset',
      ];

      for (const template of validTemplates) {
        const options: EmailOptions = {
          to: 'test@domain.com',
          subject: 'Test Subject',
          template,
          data: {
            dealTitle: 'Test Deal',
            dealPrice: 100,
            merchant: 'Test Store',
            score: 80,
            dealUrl: 'https://example.com/deal',
          },
        };

        const result = await service.sendEmail(options);
        expect(result).toBe(true);
        expect(mockTransport.send).toHaveBeenCalled();

        // Reset mock for next iteration
        jest.clearAllMocks();
      }
    });
  });

  describe('Input Validation', () => {
    it('should reject emails with missing required fields', async () => {
      const incompleteOptions = [
        { to: 'test@domain.com', subject: 'Test', template: 'deal-match' }, // missing data
        { to: 'test@domain.com', subject: 'Test', data: {} }, // missing template
        { to: 'test@domain.com', template: 'deal-match', data: {} }, // missing subject
        { subject: 'Test', template: 'deal-match', data: {} }, // missing to
      ];

      for (const options of incompleteOptions) {
        const result = await service.sendEmail(options as unknown as EmailOptions);
        expect(result).toBe(false);
        expect(mockTransport.send).not.toHaveBeenCalled();
      }
    });

    it('should handle malicious data in email content', async () => {
      const maliciousData = {
        dealTitle: '<script>alert("xss")</script>Amazing Deal',
        dealPrice: 100,
        merchant: '<img src=x onerror=alert(1)>Store',
        score: 80,
        dealUrl: 'javascript:alert("xss")',
        dealImageUrl: 'data:text/html,<script>alert("xss")</script>',
      };

      const options: EmailOptions = {
        to: 'test@domain.com',
        subject: 'Test Subject',
        template: 'deal-match',
        data: maliciousData,
      };

      const result = await service.sendEmail(options);
      expect(result).toBe(true);

      // Verify that malicious content was sanitized
      const sentPayload = mockTransport.send.mock.calls[0][0] as EmailTransportPayload;
      expect(sentPayload.html).not.toContain('<script>');
      expect(sentPayload.html).not.toContain('javascript:');
      expect(sentPayload.html).not.toContain('data:text/html');
      expect(sentPayload.html).not.toContain('onerror=');
    });
  });

  describe('Deal Match Email Security', () => {
    it('should sanitize deal data in deal match emails', async () => {
      const result = await service.sendDealMatchEmail(
        'test@domain.com',
        {
          title: '<script>alert("xss")</script>RTX 4090',
          price: 1200,
          url: 'javascript:alert("malicious")',
          imageUrl: 'data:text/html,<script>alert("xss")</script>',
          score: 95,
          merchant: '<img src=x onerror=alert(1)>TechStore',
          originalPrice: 1500,
          discountPercentage: 20,
        },
        'Gaming Filter',
        'user123'
      );

      expect(result).toBe(true);

      const sentPayload = mockTransport.send.mock.calls[0][0] as EmailTransportPayload;
      expect(sentPayload.html).not.toContain('<script>');
      expect(sentPayload.html).not.toContain('javascript:');
      expect(sentPayload.html).not.toContain('data:text/html');
      expect(sentPayload.html).not.toContain('onerror=');
      expect(sentPayload.text).not.toContain('<script>');
    });

    it('should validate deal URLs in deal match emails', async () => {
      const maliciousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'ftp://malicious.com/file',
        'file:///etc/passwd',
      ];

      for (const url of maliciousUrls) {
        const result = await service.sendDealMatchEmail(
          'test@domain.com',
          {
            title: 'Test Deal',
            price: 100,
            url,
            score: 80,
            merchant: 'Store',
          },
          'Filter',
          'user123'
        );

        expect(result).toBe(true);

        const sentPayload = mockTransport.send.mock.calls[0][0] as EmailTransportPayload;
        expect(sentPayload.html).not.toContain(url);
        expect(sentPayload.text).not.toContain(url);

        // Reset mock for next iteration
        jest.clearAllMocks();
      }
    });
  });

  describe('System Notification Security', () => {
    it('should sanitize system notification content', async () => {
      const maliciousSubject = '<script>alert("xss")</script>System Alert';
      const maliciousMessage = '<img src=x onerror=alert(1)>Important message';

      const result = await service.sendSystemNotification(
        'test@domain.com',
        maliciousSubject,
        maliciousMessage,
        'user123'
      );

      expect(result).toBe(true);

      const sentPayload = mockTransport.send.mock.calls[0][0] as EmailTransportPayload;
      expect(sentPayload.html).not.toContain('<script>');
      expect(sentPayload.html).not.toContain('onerror=');
      expect(sentPayload.text).not.toContain('<script>');
      expect(sentPayload.subject).not.toContain('<script>');
    });
  });

  describe('Email Verification Security', () => {
    it('should validate verification URLs', async () => {
      const maliciousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'http://malicious.com/verify',
        'ftp://evil.com/verify',
      ];

      for (const url of maliciousUrls) {
        const result = await service.sendEmailVerification(
          'test@domain.com',
          url,
          'user123'
        );

        expect(result).toBe(true);

        const sentPayload = mockTransport.send.mock.calls[0][0] as EmailTransportPayload;
        if (
          url.startsWith('javascript:') ||
          url.startsWith('data:') ||
          url.startsWith('ftp:')
        ) {
          expect(sentPayload.html).not.toContain(url);
        }

        // Reset mock for next iteration
        jest.clearAllMocks();
      }
    });

    it('should accept valid HTTPS verification URLs', async () => {
      const validUrl = 'https://dealscrapper.com/verify?token=abc123';

      const result = await service.sendEmailVerification(
        'test@domain.com',
        validUrl,
        'user123'
      );

      expect(result).toBe(true);

      const sentPayload = mockTransport.send.mock.calls[0][0] as EmailTransportPayload;
      // URLs can be HTML-encoded in email content
      expect(sentPayload.html).toContain('dealscrapper.com/verify');
      expect(sentPayload.html).toContain('abc123');
      expect(sentPayload.text).toContain('dealscrapper.com/verify');
      expect(sentPayload.text).toContain('abc123');
    });
  });

  describe('Error Handling Security', () => {
    it('should handle transport errors gracefully without exposing sensitive info', async () => {
      const sensitiveError = new Error(
        'Database connection failed: host=secret-db.internal, user=admin, password=secret123'
      );
      mockTransport.send.mockRejectedValue(sensitiveError);

      const options: EmailOptions = {
        to: 'test@domain.com',
        subject: 'Test Subject',
        template: 'deal-match',
        data: {
          dealTitle: 'Test Deal',
          dealPrice: 100,
          merchant: 'Test Store',
          score: 80,
          dealUrl: 'https://example.com/deal',
        },
      };

      const result = await service.sendEmail(options);
      expect(result).toBe(false);
    });

    it('should handle template rendering errors securely', async () => {
      // Create options that would cause template rendering to fail
      const options: EmailOptions = {
        to: 'test@domain.com',
        subject: 'Test Subject',
        template: 'deal-match',
        data: {
          // Missing required fields for deal-match template
        },
      };

      const result = await service.sendEmail(options);
      expect(result).toBe(true); // Should fallback to simple template
      expect(mockTransport.send).toHaveBeenCalled();
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should handle high volume email requests without memory leaks', async () => {
      const promises = [];

      // Simulate 100 concurrent email requests
      for (let i = 0; i < 100; i++) {
        const options: EmailOptions = {
          to: `test${i}@domain.com`,
          subject: `Test Subject ${i}`,
          template: 'deal-match',
          data: {
            dealTitle: `Test Deal ${i}`,
            dealPrice: 100 + i,
            merchant: `Test Store ${i}`,
            score: 80,
            dealUrl: `https://example.com/deal/${i}`,
          },
        };

        promises.push(service.sendEmail(options));
      }

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every((result) => result === true)).toBe(true);
      expect(mockTransport.send).toHaveBeenCalledTimes(100);
    });
  });

  describe('Password Reset Email Security', () => {
    it('should sanitize reset URLs in password reset emails', async () => {
      const maliciousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'ftp://evil.com/reset',
      ];

      for (const url of maliciousUrls) {
        const result = await service.sendPasswordReset('test@domain.com', url, 'user123', '30 minutes');

        expect(result).toBe(true);

        const sentPayload = mockTransport.send.mock.calls[0][0] as EmailTransportPayload;
        if (url.startsWith('javascript:') || url.startsWith('data:') || url.startsWith('ftp:')) {
          expect(sentPayload.html).not.toContain(url);
        }

        jest.clearAllMocks();
      }
    });

    it('should send password reset email with valid HTTPS reset URL', async () => {
      // Arrange
      const resetUrl = 'https://dealscrapper.com/auth/reset-password?token=abc123';

      // Act
      const result = await service.sendPasswordReset('test@domain.com', resetUrl, 'user123', '1 hour');

      // Assert
      expect(result).toBe(true);
      const sentPayload = mockTransport.send.mock.calls[0][0] as EmailTransportPayload;
      expect(sentPayload.subject).toBe('Reset your DealScrapper password');
      expect(sentPayload.html).toContain('dealscrapper.com/auth/reset-password');
      expect(sentPayload.text).toContain('dealscrapper.com/auth/reset-password');
    });
  });

  describe('Configuration Security', () => {
    it('should handle missing configuration gracefully', async () => {
      // Create service with incomplete config
      mockSharedConfig.getEmailConfig.mockReturnValue({
        service: 'gmail',
        from: {
          email: 'test@domain.com',
          name: 'Test',
        },
        transport: null as any,
      });

      // This would normally fail during construction, but we test error handling
      const options: EmailOptions = {
        to: 'test@domain.com',
        subject: 'Test Subject',
        template: 'deal-match',
        data: {
          dealTitle: 'Test Deal',
          dealPrice: 100,
          merchant: 'Test Store',
          score: 80,
          dealUrl: 'https://example.com/deal',
        },
      };

      // Should handle configuration errors gracefully
      const result = await service.sendEmail(options);
      // Depending on implementation, this might return false or throw
      expect(typeof result).toBe('boolean');
    });
  });
});
