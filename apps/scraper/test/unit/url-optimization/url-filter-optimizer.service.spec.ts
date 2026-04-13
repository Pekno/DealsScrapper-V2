import { Test, TestingModule } from '@nestjs/testing';
import { UrlFilterOptimizerService } from '../../../src/url-optimization/url-filter-optimizer.service.js';
import type { Filter } from '@dealscrapper/database';

/**
 * Mock filter data for testing
 */
const createMockFilter = (
  name: string,
  filterExpression: any,
  active: boolean = true
): Partial<Filter> => ({
  id: `filter-${name}`,
  name,
  filterExpression,
  active,
  userId: 'test-user',
  description: `Test filter: ${name}`,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('UrlFilterOptimizerService', () => {
  let service: UrlFilterOptimizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UrlFilterOptimizerService],
    }).compile();

    service = module.get<UrlFilterOptimizerService>(UrlFilterOptimizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeFiltersForCategory', () => {
    it('should extract temperature constraints from multiple filters', () => {
      const filters = [
        createMockFilter('gaming-hot-deals', {
          type: 'AND',
          conditions: [
            { field: 'temperature', operator: '>=', value: 40 },
            { field: 'category', operator: 'contains', value: 'gaming' },
          ],
        }),
        createMockFilter('super-hot-deals', {
          type: 'AND',
          conditions: [
            { field: 'temperature', operator: '>=', value: 200 },
            { field: 'category', operator: 'contains', value: 'gaming' },
          ],
        }),
      ];

      const result = service.analyzeFiltersForCategory(filters as Filter[]);

      expect(result.temperature).toEqual({
        min: 40, // Should use the minimum across all filters
        max: null,
      });
    });

    it('should extract price constraints from multiple filters', () => {
      const filters = [
        createMockFilter('budget-deals', {
          type: 'AND',
          conditions: [
            { field: 'currentPrice', operator: '<=', value: 100 },
            { field: 'currentPrice', operator: '>=', value: 10 },
          ],
        }),
        createMockFilter('mid-range-deals', {
          type: 'AND',
          conditions: [
            { field: 'currentPrice', operator: '<=', value: 500 },
            { field: 'currentPrice', operator: '>=', value: 50 },
          ],
        }),
      ];

      const result = service.analyzeFiltersForCategory(filters as Filter[]);

      expect(result.price).toEqual({
        min: 10, // Minimum across all filters
        max: 500, // Maximum across all filters
      });
    });

    it('should handle overlapping temperature ranges correctly', () => {
      const filters = [
        createMockFilter('filter1', {
          type: 'AND',
          conditions: [
            { field: 'temperature', operator: '>=', value: 100 },
            { field: 'temperature', operator: '<=', value: 300 },
          ],
        }),
        createMockFilter('filter2', {
          type: 'AND',
          conditions: [
            { field: 'temperature', operator: '>=', value: 150 },
            { field: 'temperature', operator: '<=', value: 250 },
          ],
        }),
      ];

      const result = service.analyzeFiltersForCategory(filters as Filter[]);

      expect(result.temperature).toEqual({
        min: 100, // Use broadest range to capture all filter possibilities
        max: 300,
      });
    });

    it('should ignore inactive filters', () => {
      const filters = [
        createMockFilter(
          'active-filter',
          {
            conditions: [{ field: 'temperature', operator: '>=', value: 100 }],
          },
          true
        ),
        createMockFilter(
          'inactive-filter',
          {
            conditions: [{ field: 'temperature', operator: '>=', value: 50 }],
          },
          false
        ),
      ];

      const result = service.analyzeFiltersForCategory(filters as Filter[]);

      expect(result.temperature?.min).toBe(100); // Should only consider active filter
    });

    it('should extract merchant constraints', () => {
      const filters = [
        createMockFilter('amazon-deals', {
          conditions: [{ field: 'merchant', operator: '==', value: 'Amazon' }],
        }),
        createMockFilter('cdiscount-deals', {
          conditions: [
            { field: 'merchant', operator: '==', value: 'Cdiscount' },
          ],
        }),
      ];

      const result = service.analyzeFiltersForCategory(filters as Filter[]);

      expect(result.merchants).toEqual(['Amazon', 'Cdiscount']);
    });

    it('should return empty constraints when no applicable filters exist', () => {
      const filters = [
        createMockFilter('text-only-filter', {
          conditions: [
            { field: 'title', operator: 'contains', value: 'iPhone' },
          ],
        }),
      ];

      const result = service.analyzeFiltersForCategory(filters as Filter[]);

      expect(result.temperature).toBeNull();
      expect(result.price).toBeNull();
      expect(result.merchants).toEqual([]);
    });
  });

  describe('generateOptimizedUrl', () => {
    it('should generate URL with temperature filter', () => {
      const baseUrl = 'https://www.dealabs.com/groupe/gaming';
      const constraints = {
        temperature: { min: 100, max: 400 },
        price: null,
        merchants: [],
      };

      const result = service.generateOptimizedUrl(baseUrl, constraints);

      expect(result).toBe(
        'https://www.dealabs.com/groupe/gaming?temperatureFrom=100&temperatureTo=400'
      );
    });

    it('should generate URL with price filter', () => {
      const baseUrl = 'https://www.dealabs.com/groupe/high-tech';
      const constraints = {
        temperature: null,
        price: { min: 50, max: 1000 },
        merchants: [],
      };

      const result = service.generateOptimizedUrl(baseUrl, constraints);

      expect(result).toBe(
        'https://www.dealabs.com/groupe/high-tech?priceFrom=50&priceTo=1000'
      );
    });

    it('should generate URL with multiple filters', () => {
      const baseUrl = 'https://www.dealabs.com/groupe/gaming';
      const constraints = {
        temperature: { min: 50, max: null },
        price: { min: null, max: 500 },
        merchants: [],
      };

      const result = service.generateOptimizedUrl(baseUrl, constraints);

      const url = new URL(result);
      expect(url.searchParams.get('temperatureFrom')).toBe('50');
      expect(url.searchParams.get('priceTo')).toBe('500');
      expect(url.searchParams.has('temperatureTo')).toBe(false);
      expect(url.searchParams.has('priceFrom')).toBe(false);
    });

    it('should preserve existing query parameters', () => {
      const baseUrl = 'https://www.dealabs.com/groupe/gaming?sortBy=new&page=1';
      const constraints = {
        temperature: { min: 100, max: null },
        price: null,
        merchants: [],
      };

      const result = service.generateOptimizedUrl(baseUrl, constraints);

      const url = new URL(result);
      expect(url.searchParams.get('sortBy')).toBe('new');
      expect(url.searchParams.get('page')).toBe('1');
      expect(url.searchParams.get('temperatureFrom')).toBe('100');
    });

    it('should handle merchant filtering (future enhancement)', () => {
      const baseUrl = 'https://www.dealabs.com/groupe/gaming';
      const constraints = {
        temperature: null,
        price: null,
        merchants: ['Amazon', 'Cdiscount'],
      };

      const result = service.generateOptimizedUrl(baseUrl, constraints);

      // Note: This test assumes we'll implement merchant ID mapping in the future
      expect(result).toContain('retailers=');
    });

    it('should return original URL when no constraints are applicable', () => {
      const baseUrl = 'https://www.dealabs.com/groupe/gaming';
      const constraints = {
        temperature: null,
        price: null,
        merchants: [],
      };

      const result = service.generateOptimizedUrl(baseUrl, constraints);

      expect(result).toBe(baseUrl);
    });
  });

  describe('calculateOptimizationPotential', () => {
    it('should estimate performance improvement for restrictive filters', () => {
      const constraints = {
        temperature: { min: 200, max: null }, // Very restrictive (hot deals only)
        price: { min: null, max: 100 }, // Budget constraint
        merchants: [],
      };

      const potential = service.calculateOptimizationPotential(constraints);

      expect(potential.estimatedReduction).toBeGreaterThan(0.5); // Expect >50% reduction
      expect(potential.confidence).toBe('high');
      expect(potential.reasoning).toContain('temperature');
      expect(potential.reasoning).toContain('price');
    });

    it('should estimate low improvement for loose filters', () => {
      const constraints = {
        temperature: { min: 10, max: null }, // Very loose
        price: null,
        merchants: [],
      };

      const potential = service.calculateOptimizationPotential(constraints);

      expect(potential.estimatedReduction).toBeLessThan(0.3); // Expect <30% reduction
      expect(potential.confidence).toBe('low');
    });

    it('should return zero improvement when no constraints exist', () => {
      const constraints = {
        temperature: null,
        price: null,
        merchants: [],
      };

      const potential = service.calculateOptimizationPotential(constraints);

      expect(potential.estimatedReduction).toBe(0);
      expect(potential.confidence).toBe('none');
    });
  });

  describe('integration scenarios', () => {
    it('should handle the example scenario from user requirements', () => {
      // User's example: 2 filters on gaming category
      // Filter 1: temp >= 40
      // Filter 2: temp >= 200
      // Expected: temperatureFrom=40 (minimum across filters)

      const filters = [
        createMockFilter('moderate-gaming-deals', {
          type: 'AND',
          conditions: [
            { field: 'temperature', operator: '>=', value: 40 },
            { field: 'category', operator: 'contains', value: 'gaming' },
          ],
        }),
        createMockFilter('hot-gaming-deals', {
          type: 'AND',
          conditions: [
            { field: 'temperature', operator: '>=', value: 200 },
            { field: 'category', operator: 'contains', value: 'gaming' },
          ],
        }),
      ];

      const constraints = service.analyzeFiltersForCategory(
        filters as Filter[]
      );
      const optimizedUrl = service.generateOptimizedUrl(
        'https://www.dealabs.com/groupe/gaming',
        constraints
      );

      expect(optimizedUrl).toBe(
        'https://www.dealabs.com/groupe/gaming?temperatureFrom=40'
      );

      const potential = service.calculateOptimizationPotential(constraints);
      expect(potential.estimatedReduction).toBeGreaterThan(0.05); // At least 5% improvement for loose constraint
    });

    it('should optimize complex multi-constraint scenario', () => {
      const filters = [
        createMockFilter('budget-tech-deals', {
          type: 'AND',
          conditions: [
            { field: 'currentPrice', operator: '<=', value: 200 },
            { field: 'temperature', operator: '>=', value: 50 },
            { field: 'merchant', operator: '==', value: 'Amazon' },
          ],
        }),
        createMockFilter('premium-tech-deals', {
          type: 'AND',
          conditions: [
            { field: 'currentPrice', operator: '<=', value: 1000 },
            { field: 'temperature', operator: '>=', value: 100 },
            { field: 'merchant', operator: '==', value: 'Fnac' },
          ],
        }),
      ];

      const constraints = service.analyzeFiltersForCategory(
        filters as Filter[]
      );
      expect(constraints.temperature?.min).toBe(50);
      expect(constraints.price?.max).toBe(1000);
      expect(constraints.merchants).toEqual(['Amazon', 'Fnac']);

      const optimizedUrl = service.generateOptimizedUrl(
        'https://www.dealabs.com/groupe/high-tech',
        constraints
      );

      const url = new URL(optimizedUrl);
      expect(url.searchParams.get('temperatureFrom')).toBe('50');
      expect(url.searchParams.get('priceTo')).toBe('1000');
    });
  });
});
