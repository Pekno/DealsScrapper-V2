import { Test, TestingModule } from '@nestjs/testing';
import {
  TemplateService,
  TemplateData,
} from '../../../src/templates/template.service.js';
import { SharedConfigService } from '@dealscrapper/shared-config';

describe('TemplateService - Security Tests', () => {
  let service: TemplateService;
  let mockSharedConfig: jest.Mocked<SharedConfigService>;

  beforeEach(async () => {
    mockSharedConfig = {
      getBrandingConfig: jest.fn().mockReturnValue({
        appName: 'DealScrapper',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#3B82F6',
        supportEmail: 'support@dealscrapper.com',
        unsubscribeUrl: 'https://example.com/unsubscribe',
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        { provide: SharedConfigService, useValue: mockSharedConfig },
      ],
    }).compile();

    service = module.get<TemplateService>(TemplateService);
  });

  describe('XSS Protection', () => {
    it('should sanitize malicious script tags in deal titles', async () => {
      const maliciousData: TemplateData = {
        deal: {
          title: '<script>alert("xss")</script>RTX 4090',
          price: 1200,
          merchant: 'TestStore',
          score: 95,
          url: 'https://example.com/deal',
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      const result = await service.generateDealMatchEmail(maliciousData);

      expect(result.htmlBody).not.toContain('<script>');
      expect(result.htmlBody).not.toContain('alert(');
      expect(result.body).not.toContain('<script>');
      expect(result.body).toContain('&lt;script&gt;');
    });

    it('should sanitize dangerous characters in merchant names', async () => {
      const maliciousData: TemplateData = {
        deal: {
          title: 'Gaming Laptop',
          price: 1500,
          merchant: 'Store<img src=x onerror=alert(1)>',
          score: 88,
          url: 'https://example.com/deal',
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      const result = await service.generateDealMatchEmail(maliciousData);

      expect(result.htmlBody).not.toContain('<img');
      expect(result.htmlBody).not.toContain('onerror=');
      expect(result.body).toContain('&lt;img');
    });

    it('should handle null and undefined values safely', async () => {
      const dataWithNulls: TemplateData = {
        deal: {
          title: 'Test Deal',
          price: 100,
          merchant: 'Store',
          score: 80,
          url: 'https://example.com/deal',
          originalPrice: undefined,
          discountPercentage: null as any,
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
          name: undefined,
        },
      };

      const result = await service.generateDealMatchEmail(dataWithNulls);

      expect(result.subject).toBeTruthy();
      expect(result.htmlBody).toBeTruthy();
      expect(result.body).toBeTruthy();
    });

    it('should block javascript: URLs in deal links', async () => {
      const maliciousData: TemplateData = {
        deal: {
          title: 'Test Deal',
          price: 100,
          merchant: 'Store',
          score: 80,
          url: 'javascript:alert("xss")',
          imageUrl: 'javascript:void(0)',
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      const result = await service.generateDealMatchEmail(maliciousData);

      expect(result.htmlBody).not.toContain('javascript:');
      expect(result.body).not.toContain('javascript:');
      // URLs should be sanitized to empty strings
      expect(result.htmlBody).toContain('href=""');
    });

    it('should block data: URLs in images', async () => {
      const maliciousData: TemplateData = {
        deal: {
          title: 'Test Deal',
          price: 100,
          merchant: 'Store',
          score: 80,
          url: 'https://example.com/deal',
          imageUrl: 'data:text/html,<script>alert("xss")</script>',
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      const result = await service.generateDealMatchEmail(maliciousData);

      expect(result.htmlBody).not.toContain('data:text/html');
      expect(result.htmlBody).not.toContain('<script>');
    });

    it('should remove control characters from input', async () => {
      const maliciousData: TemplateData = {
        deal: {
          title: 'Test\x00Deal\x1F\x7F',
          price: 100,
          merchant: 'Store\n\r\t',
          score: 80,
          url: 'https://example.com/deal',
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      const result = await service.generateDealMatchEmail(maliciousData);

      expect(result.htmlBody).not.toContain('\x00');
      expect(result.htmlBody).not.toContain('\x1F');
      expect(result.htmlBody).not.toContain('\x7F');
      expect(result.body).not.toContain('\n');
      expect(result.body).not.toContain('\r');
    });
  });

  describe('URL Validation', () => {
    it('should allow localhost URLs in test/development mode', async () => {
      const testData: TemplateData = {
        deal: {
          title: 'Test Deal',
          price: 100,
          merchant: 'Store',
          score: 80,
          url: 'http://localhost:8080/admin',
          imageUrl: 'https://127.0.0.1/sensitive-data',
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      const result = await service.generateDealMatchEmail(testData);

      // In test mode (NODE_ENV=test), localhost URLs should be preserved for local development
      expect(result.htmlBody).toContain('localhost');
      expect(result.htmlBody).toContain('127.0.0.1');
    });

    it('should only allow HTTP and HTTPS protocols', async () => {
      const testCases = [
        'ftp://example.com/file',
        'file:///etc/passwd',
        'chrome://settings',
        'about:blank',
      ];

      for (const maliciousUrl of testCases) {
        const maliciousData: TemplateData = {
          deal: {
            title: 'Test Deal',
            price: 100,
            merchant: 'Store',
            score: 80,
            url: maliciousUrl,
          },
          user: {
            id: 'user123',
            email: 'test@example.com',
          },
        };

        const result = await service.generateDealMatchEmail(maliciousData);

        expect(result.htmlBody).not.toContain(maliciousUrl.split(':')[0]);
        expect(result.body).not.toContain(maliciousUrl);
      }
    });
  });

  describe('Template Injection Protection', () => {
    it('should protect against Handlebars template injection', async () => {
      const maliciousData: TemplateData = {
        deal: {
          title:
            '{{#each this}}{{@root.constructor.constructor("return process")()}}{{/each}}',
          price: 100,
          merchant: '{{constructor.constructor("alert(1)")()}}',
          score: 80,
          url: 'https://example.com/deal',
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      const result = await service.generateDealMatchEmail(maliciousData);

      expect(result.htmlBody).not.toContain('constructor');
      expect(result.htmlBody).not.toContain('process');
      expect(result.body).not.toContain('constructor');
    });

    it('should handle circular references in data safely', async () => {
      const circularData: any = {
        deal: {
          title: 'Test Deal',
          price: 100,
          merchant: 'Store',
          score: 80,
          url: 'https://example.com/deal',
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      // Create circular reference
      circularData.deal.circular = circularData;

      // Should not throw error
      const result = await service.generateDealMatchEmail(circularData);

      expect(result.subject).toBeTruthy();
      expect(result.htmlBody).toBeTruthy();
      expect(result.body).toBeTruthy();
    });
  });

  describe('Data Validation', () => {
    it('should throw error for missing required deal data', async () => {
      const invalidData = {
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      } as TemplateData;

      await expect(service.generateDealMatchEmail(invalidData)).rejects.toThrow(
        'Deal data is required for deal match email template'
      );
    });

    it('should throw error for missing required system data', async () => {
      const invalidData = {
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      } as TemplateData;

      await expect(service.generateSystemEmail(invalidData)).rejects.toThrow(
        'System data is required for system email template'
      );
    });

    it('should throw error for missing required digest data', async () => {
      const invalidData = {
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      } as TemplateData;

      await expect(service.generateDigestEmail(invalidData)).rejects.toThrow(
        'Digest data with matches is required for digest email template'
      );
    });

    it('should handle empty digest matches array', async () => {
      const invalidData: TemplateData = {
        digest: {
          matches: [],
          frequency: 'daily',
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      await expect(service.generateDigestEmail(invalidData)).rejects.toThrow(
        'Digest data with matches is required for digest email template'
      );
    });
  });

  describe('Performance and Memory Safety', () => {
    it('should handle large deal titles without performance degradation', async () => {
      const largeTitle = 'A'.repeat(10000); // 10KB title

      const data: TemplateData = {
        deal: {
          title: largeTitle,
          price: 100,
          merchant: 'Store',
          score: 80,
          url: 'https://example.com/deal',
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      const startTime = Date.now();
      const result = await service.generateDealMatchEmail(data);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.subject).toBeTruthy();
      expect(result.htmlBody).toBeTruthy();
    });

    it('should handle many digest matches efficiently', async () => {
      const manyMatches = Array(1000)
        .fill(null)
        .map((_, i) => ({
          title: `Deal ${i}`,
          price: 100 + i,
          url: `https://example.com/deal/${i}`,
          score: 80 + (i % 20),
          merchant: `Store ${i % 10}`,
          filterName: `Filter ${i % 5}`,
        }));

      const data: TemplateData = {
        digest: {
          matches: manyMatches,
          frequency: 'daily' as const,
          periodStart: new Date(),
          periodEnd: new Date(),
        },
        user: {
          id: 'user123',
          email: 'test@example.com',
        },
      };

      const startTime = Date.now();
      const result = await service.generateDigestEmail(data);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.metadata?.matchCount).toBe(1000);
    });
  });

  describe('Template Helpers Security', () => {
    it('should validate currency helper input', () => {
      const helpers = service['handlebars'].helpers;

      // Test with malicious input
      const maliciousInput = '<script>alert(1)</script>123';
      const result = helpers.currency(maliciousInput as any);

      expect(result.toString()).not.toContain('<script>');
      expect(result.toString()).toContain('€');
    });

    it('should validate truncate helper input', () => {
      const helpers = service['handlebars'].helpers;

      // Test with malicious input
      const maliciousInput =
        '<img src=x onerror=alert(1)>Long text that should be truncated';
      const result = helpers.truncate(maliciousInput, 10);

      expect(result.toString()).not.toContain('<img');
      expect(result.toString()).not.toContain('onerror=');
      expect(result.toString().length).toBeLessThanOrEqual(13); // 10 + '...'
    });

    it('should validate emoji helper input', () => {
      const helpers = service['handlebars'].helpers;

      // Test with malicious input
      const result = helpers.emoji('<script>alert(1)</script>');

      expect(result).toBe(''); // Should return empty string for invalid input
    });
  });
});
