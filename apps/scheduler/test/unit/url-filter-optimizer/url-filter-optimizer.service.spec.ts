import { Test, TestingModule } from '@nestjs/testing';
import { UrlFilterOptimizerService } from '../../../src/url-filter-optimizer/url-filter-optimizer.service';
import { PrismaService } from '@dealscrapper/database';
import type { Filter } from '@dealscrapper/database';
import { SiteSource } from '@dealscrapper/shared-types';
import { SharedConfigService } from '@dealscrapper/shared-config';

describe('UrlFilterOptimizerService', () => {
  let service: UrlFilterOptimizerService;
  let prisma: jest.Mocked<PrismaService>;
  let sharedConfig: jest.Mocked<SharedConfigService>;

  const createTestFilter = (overrides = {}): Filter => ({
    id: 'filter-123',
    userId: 'user-123',
    name: 'Test Filter',
    description: 'Test filter description',
    active: true,
    filterExpression: {
      rules: [{ field: 'currentPrice', operator: '<=', value: 500, weight: 1.0 }],
      matchLogic: 'AND',
      minScore: 50,
    },
    immediateNotifications: true,
    digestFrequency: 'daily',
    maxNotificationsPerDay: 50,
    totalMatches: 0,
    matchesLast24h: 0,
    lastMatchAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createRuleFilter = (
    field: string,
    operator: string,
    value: any,
    options: { name?: string; siteSpecific?: string } = {},
  ): Filter =>
    createTestFilter({
      name: options.name ?? `${field} Filter`,
      filterExpression: {
        rules: [{
          field,
          operator,
          value,
          weight: 1.0,
          ...(options.siteSpecific ? { siteSpecific: options.siteSpecific } : {}),
        }],
        matchLogic: 'AND',
        minScore: 50,
      },
    });

  /** Parse a query string into a key-value map for easier assertions */
  const parseQuery = (query: string): Record<string, string> => {
    const params = new URLSearchParams(query);
    const result: Record<string, string> = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  };

  beforeEach(async () => {
    prisma = {
      filter: { findMany: jest.fn() },
      category: { findUnique: jest.fn() },
      scheduledJob: { upsert: jest.fn().mockResolvedValue({}) },
    } as any;

    sharedConfig = {
      get: jest.fn((key: string) => {
        if (key === 'URL_OPTIMIZATION_ENABLED') return true;
        return undefined;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UrlFilterOptimizerService,
        { provide: PrismaService, useValue: prisma },
        { provide: SharedConfigService, useValue: sharedConfig },
      ],
    }).compile();

    service = module.get<UrlFilterOptimizerService>(UrlFilterOptimizerService);
  });

  describe('Dealabs URL optimization', () => {
    it('maps temperature >= 100 to temperatureFrom with 5° buffer', () => {
      const filters = [createRuleFilter('temperature', '>=', 100)];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureFrom']).toBe('95'); // 100 - 5 buffer
      expect(params['sortBy']).toBe('new');
      expect(params['hide_expired']).toBe('true');
      expect(params['hide_local']).toBe('true');
    });

    it('maps temperature <= 200 to temperatureTo with 5° buffer', () => {
      const filters = [createRuleFilter('temperature', '<=', 200)];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureTo']).toBe('205'); // 200 + 5 buffer
    });

    it('maps heat alias to temperature params', () => {
      const filters = [createRuleFilter('heat', '>=', 50)];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureFrom']).toBe('45'); // 50 - 5 buffer
    });

    it('maps price <= 500 to priceTo', () => {
      const filters = [createRuleFilter('currentPrice', '<=', 500)];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['priceTo']).toBe('500');
      expect(params['priceFrom']).toBeUndefined();
    });

    it('maps price BETWEEN [100, 500] to priceFrom and priceTo', () => {
      const filters = [createRuleFilter('currentPrice', 'BETWEEN', [100, 500])];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['priceFrom']).toBe('100');
      expect(params['priceTo']).toBe('500');
    });

    it('maps merchant IN to retailers using idMap', () => {
      const filters = [createRuleFilter('merchant', 'IN', ['Amazon', 'Fnac'])];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['retailers']).toBe('1,45'); // Amazon=1, Fnac=45
    });

    it('consolidates multiple temperature filters using broadest range', () => {
      const filters = [
        createRuleFilter('temperature', '>=', 80),
        createRuleFilter('temperature', '<=', 120),
        createRuleFilter('temperature', '>=', 90), // narrower, should use 80
      ];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureFrom']).toBe('75'); // min(80, 90) - 5 = 75
      expect(params['temperatureTo']).toBe('125'); // 120 + 5
    });

    it('prevents negative temperature with buffer', () => {
      const filters = [createRuleFilter('temperature', '>=', 3)];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureFrom']).toBe('0'); // max(0, 3-5)
    });

    it('returns only universal params when no filters match', () => {
      const query = service.buildOptimizedQuery([], SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['sortBy']).toBe('new');
      expect(params['hide_expired']).toBe('true');
      expect(params['hide_local']).toBe('true');
      expect(Object.keys(params)).toHaveLength(3);
    });

    it('skips NOT_EQUALS operators (cannot optimize)', () => {
      const filters = [createRuleFilter('temperature', '!=', 50)];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureFrom']).toBeUndefined();
      expect(params['temperatureTo']).toBeUndefined();
    });
  });

  describe('LeBonCoin URL optimization', () => {
    it('maps title CONTAINS to text param', () => {
      const filters = [createRuleFilter('title', 'CONTAINS', 'cabane')];
      const query = service.buildOptimizedQuery(filters, SiteSource.LEBONCOIN);
      const params = parseQuery(query);

      expect(params['text']).toBe('cabane');
      expect(params['sort']).toBe('time');
      expect(params['order']).toBe('desc');
    });

    it('maps price BETWEEN [2, 40] to custom range format', () => {
      const filters = [createRuleFilter('currentPrice', 'BETWEEN', [2, 40])];
      const query = service.buildOptimizedQuery(filters, SiteSource.LEBONCOIN);
      const params = parseQuery(query);

      expect(params['price']).toBe('2-40');
    });

    it('maps price >= 2 to price=2-max', () => {
      const filters = [createRuleFilter('currentPrice', '>=', 2)];
      const query = service.buildOptimizedQuery(filters, SiteSource.LEBONCOIN);
      const params = parseQuery(query);

      expect(params['price']).toBe('2-max');
    });

    it('maps price <= 40 to price=min-40', () => {
      const filters = [createRuleFilter('currentPrice', '<=', 40)];
      const query = service.buildOptimizedQuery(filters, SiteSource.LEBONCOIN);
      const params = parseQuery(query);

      expect(params['price']).toBe('min-40');
    });

    it('maps proSeller IS_TRUE to owner_type=pro', () => {
      const filters = [createRuleFilter('proSeller', 'IS_TRUE', true, { siteSpecific: 'leboncoin' })];
      const query = service.buildOptimizedQuery(filters, SiteSource.LEBONCOIN);
      const params = parseQuery(query);

      expect(params['owner_type']).toBe('pro');
    });

    it('maps proSeller IS_FALSE to owner_type=private', () => {
      const filters = [createRuleFilter('proSeller', 'IS_FALSE', false, { siteSpecific: 'leboncoin' })];
      const query = service.buildOptimizedQuery(filters, SiteSource.LEBONCOIN);
      const params = parseQuery(query);

      expect(params['owner_type']).toBe('private');
    });

    it('returns only universal params when no filters', () => {
      const query = service.buildOptimizedQuery([], SiteSource.LEBONCOIN);
      const params = parseQuery(query);

      expect(params['sort']).toBe('time');
      expect(params['order']).toBe('desc');
      expect(Object.keys(params)).toHaveLength(2);
    });
  });

  describe('Vinted URL optimization', () => {
    it('maps price <= 56 to price_to', () => {
      const filters = [createRuleFilter('currentPrice', '<=', 56)];
      const query = service.buildOptimizedQuery(filters, SiteSource.VINTED);
      const params = parseQuery(query);

      expect(params['price_to']).toBe('56');
      expect(params['currency']).toBe('EUR');
      expect(params['order']).toBe('newest_first');
    });

    it('maps price >= 10 to price_from', () => {
      const filters = [createRuleFilter('currentPrice', '>=', 10)];
      const query = service.buildOptimizedQuery(filters, SiteSource.VINTED);
      const params = parseQuery(query);

      expect(params['price_from']).toBe('10');
    });

    it('returns only universal params when no filters', () => {
      const query = service.buildOptimizedQuery([], SiteSource.VINTED);
      const params = parseQuery(query);

      expect(params['currency']).toBe('EUR');
      expect(params['order']).toBe('newest_first');
      expect(Object.keys(params)).toHaveLength(2);
    });
  });

  describe('Site-specific field filtering', () => {
    it('skips conditions with mismatched siteSpecific', () => {
      // A vinted-specific rule should be skipped when building for dealabs
      const filters = [createRuleFilter('favoriteCount', '>=', 10, { siteSpecific: 'vinted' })];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      // Should only have universal params
      expect(params['sortBy']).toBe('new');
      expect(params['hide_expired']).toBe('true');
      expect(params['hide_local']).toBe('true');
      expect(Object.keys(params)).toHaveLength(3);
    });

    it('processes conditions with matching siteSpecific', () => {
      const filters = [createRuleFilter('temperature', '>=', 100, { siteSpecific: 'dealabs' })];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureFrom']).toBe('95');
    });

    it('processes conditions without siteSpecific on any site', () => {
      // Universal fields like price should work on any site
      const filters = [createRuleFilter('currentPrice', '<=', 100)];

      const dealabsParams = parseQuery(service.buildOptimizedQuery(filters, SiteSource.DEALABS));
      expect(dealabsParams['priceTo']).toBe('100');

      const vintedParams = parseQuery(service.buildOptimizedQuery(filters, SiteSource.VINTED));
      expect(vintedParams['price_to']).toBe('100');
    });
  });

  describe('Complex multi-field filters', () => {
    it('handles Dealabs filter with temperature + price + merchant', () => {
      const filters = [createTestFilter({
        name: 'Complex Dealabs Filter',
        filterExpression: {
          rules: [
            { field: 'temperature', operator: '>=', value: 90 },
            { field: 'currentPrice', operator: 'BETWEEN', value: [800, 2500] },
            { field: 'merchant', operator: 'IN', value: ['Amazon'] },
          ],
        },
      })];

      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureFrom']).toBe('85'); // 90 - 5
      expect(params['priceFrom']).toBe('800');
      expect(params['priceTo']).toBe('2500');
      expect(params['retailers']).toBe('1'); // Amazon ID
      expect(params['sortBy']).toBe('new');
    });

    it('handles LeBonCoin filter with title + price + proSeller', () => {
      const filters = [createTestFilter({
        name: 'Complex LBC Filter',
        filterExpression: {
          rules: [
            { field: 'title', operator: 'CONTAINS', value: 'cabane' },
            { field: 'currentPrice', operator: 'BETWEEN', value: [50, 200] },
            { field: 'proSeller', operator: 'IS_TRUE', value: true, siteSpecific: 'leboncoin' },
          ],
        },
      })];

      const query = service.buildOptimizedQuery(filters, SiteSource.LEBONCOIN);
      const params = parseQuery(query);

      expect(params['text']).toBe('cabane');
      expect(params['price']).toBe('50-200');
      expect(params['owner_type']).toBe('pro');
      expect(params['sort']).toBe('time');
      expect(params['order']).toBe('desc');
    });
  });

  describe('Legacy filter format support', () => {
    it('handles conditions array format', () => {
      const filters = [createTestFilter({
        filterExpression: {
          conditions: [
            { field: 'temperature', operator: '>=', value: 85 },
            { field: 'currentPrice', operator: '<=', value: 1000 },
          ],
        },
      })];

      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureFrom']).toBe('80'); // 85 - 5
      expect(params['priceTo']).toBe('1000');
    });
  });

  describe('Edge cases', () => {
    it('handles malformed filter expressions gracefully', () => {
      const filters = [createTestFilter({ filterExpression: null })];
      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      // Should still have universal params
      expect(params['sortBy']).toBe('new');
    });

    it('handles inactive filters by filtering them out', () => {
      const filters = [
        createRuleFilter('temperature', '>=', 80),
        { ...createRuleFilter('temperature', '>=', 200), active: false },
      ];

      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureFrom']).toBe('75'); // Only from active filter: 80 - 5
    });

    it('handles non-numeric values in numeric fields gracefully', () => {
      const filters = [
        createRuleFilter('temperature', '>=', 'invalid'),
        createRuleFilter('temperature', '>=', 85),
      ];

      const query = service.buildOptimizedQuery(filters, SiteSource.DEALABS);
      const params = parseQuery(query);

      expect(params['temperatureFrom']).toBe('80'); // Only valid: 85 - 5
    });

    it('handles empty text value for title CONTAINS', () => {
      const filters = [createRuleFilter('title', 'CONTAINS', '')];
      const query = service.buildOptimizedQuery(filters, SiteSource.LEBONCOIN);
      const params = parseQuery(query);

      expect(params['text']).toBeUndefined(); // Empty string should be skipped
    });
  });

  describe('handleFilterChangeEvent integration', () => {
    it('looks up category siteId and generates site-specific query', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        siteId: 'dealabs',
        site: { id: 'dealabs' },
      });
      (prisma.filter.findMany as jest.Mock).mockResolvedValue([
        createRuleFilter('temperature', '>=', 100),
      ]);

      await service.handleFilterChangeEvent(['cat-1']);

      expect(prisma.scheduledJob.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            optimizedQuery: expect.stringContaining('temperatureFrom=95'),
          }),
        }),
      );
    });

    it('generates universal params only when no filters exist', async () => {
      (prisma.category.findUnique as jest.Mock).mockResolvedValue({
        id: 'cat-1',
        siteId: 'vinted',
        site: { id: 'vinted' },
      });
      (prisma.filter.findMany as jest.Mock).mockResolvedValue([]);

      await service.handleFilterChangeEvent(['cat-1']);

      expect(prisma.scheduledJob.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            optimizedQuery: expect.stringContaining('currency=EUR'),
          }),
        }),
      );
    });

    it('continues processing other categories when one fails', async () => {
      (prisma.category.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'cat-1', siteId: 'dealabs', site: { id: 'dealabs' } })
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ id: 'cat-3', siteId: 'dealabs', site: { id: 'dealabs' } });
      (prisma.filter.findMany as jest.Mock).mockResolvedValue([]);

      await service.handleFilterChangeEvent(['cat-1', 'cat-2', 'cat-3']);

      expect(prisma.scheduledJob.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
