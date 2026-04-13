import { Test, TestingModule } from '@nestjs/testing';
import { UrlFilterOptimizerService } from '../../../src/url-optimization/url-filter-optimizer.service.js';
import type { Filter } from '@dealscrapper/database';

/**
 * Integration tests for URL Filter Optimizer
 * These tests demonstrate real-world performance improvements
 */
describe('UrlFilterOptimizerService Integration', () => {
  let service: UrlFilterOptimizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UrlFilterOptimizerService],
    }).compile();

    service = module.get<UrlFilterOptimizerService>(UrlFilterOptimizerService);
  });

  describe('Real-world optimization scenarios', () => {
    it('should optimize gaming category with temperature and price filters', () => {
      // Realistic gaming filters from a typical user
      const filters: Partial<Filter>[] = [
        {
          id: 'gaming-hot-deals',
          name: 'Hot Gaming Deals',
          active: true,
          filterExpression: {
            type: 'AND',
            conditions: [
              { field: 'temperature', operator: '>=', value: 100 },
              { field: 'currentPrice', operator: '<=', value: 300 },
              { field: 'category', operator: 'contains', value: 'gaming' },
            ],
          },
        },
        {
          id: 'budget-gaming',
          name: 'Budget Gaming Deals',
          active: true,
          filterExpression: {
            type: 'AND',
            conditions: [
              { field: 'currentPrice', operator: '<=', value: 150 },
              { field: 'temperature', operator: '>=', value: 50 },
              { field: 'merchant', operator: '==', value: 'Amazon' },
            ],
          },
        },
      ];

      const constraints = service.analyzeFiltersForCategory(
        filters as Filter[]
      );
      const baseUrl = 'https://www.dealabs.com/groupe/gaming';
      const optimizedUrl = service.generateOptimizedUrl(baseUrl, constraints);

      // Verify URL optimization
      const url = new URL(optimizedUrl);
      expect(url.searchParams.get('temperatureFrom')).toBe('50'); // Min across filters
      expect(url.searchParams.get('priceTo')).toBe('300'); // Max across filters

      // Verify performance potential
      const potential = service.calculateOptimizationPotential(constraints);
      expect(potential.estimatedReduction).toBeGreaterThan(0.4); // >40% reduction expected
      expect(potential.confidence).toBe('high');

      console.log('Gaming Optimization Results:');
      console.log(`Original URL: ${baseUrl}`);
      console.log(`Optimized URL: ${optimizedUrl}`);
      console.log(
        `Estimated reduction: ${(potential.estimatedReduction * 100).toFixed(1)}%`
      );
      console.log(`Reasoning: ${potential.reasoning}`);
    });

    it('should optimize high-tech category with strict temperature requirements', () => {
      // Strict filters for high-tech deals
      const filters: Partial<Filter>[] = [
        {
          id: 'super-hot-tech',
          name: 'Super Hot Tech Deals',
          active: true,
          filterExpression: {
            type: 'AND',
            conditions: [
              { field: 'temperature', operator: '>=', value: 200 },
              { field: 'category', operator: 'contains', value: 'tech' },
            ],
          },
        },
        {
          id: 'premium-tech',
          name: 'Premium Tech Deals',
          active: true,
          filterExpression: {
            type: 'AND',
            conditions: [
              { field: 'temperature', operator: '>=', value: 150 },
              { field: 'currentPrice', operator: '>=', value: 500 },
              { field: 'currentPrice', operator: '<=', value: 2000 },
            ],
          },
        },
      ];

      const constraints = service.analyzeFiltersForCategory(
        filters as Filter[]
      );
      const baseUrl = 'https://www.dealabs.com/groupe/high-tech';
      const optimizedUrl = service.generateOptimizedUrl(baseUrl, constraints);

      // Verify optimization
      const url = new URL(optimizedUrl);
      expect(url.searchParams.get('temperatureFrom')).toBe('150'); // Min temperature
      expect(url.searchParams.get('priceFrom')).toBe('500');
      expect(url.searchParams.get('priceTo')).toBe('2000');

      // High temperature threshold should give significant optimization
      const potential = service.calculateOptimizationPotential(constraints);
      expect(potential.estimatedReduction).toBeGreaterThanOrEqual(0.6); // ≥60% reduction
      expect(potential.confidence).toBe('medium'); // Multiple constraints but one constraint type

      console.log('\nHigh-Tech Optimization Results:');
      console.log(`Original URL: ${baseUrl}`);
      console.log(`Optimized URL: ${optimizedUrl}`);
      console.log(
        `Estimated reduction: ${(potential.estimatedReduction * 100).toFixed(1)}%`
      );
      console.log(`Reasoning: ${potential.reasoning}`);
    });

    it('should handle the exact user scenario: temp >= 40 and temp >= 200', () => {
      // The exact scenario mentioned by the user
      const filters: Partial<Filter>[] = [
        {
          id: 'moderate-deals',
          name: 'Moderate Gaming Deals',
          active: true,
          filterExpression: {
            conditions: [{ field: 'temperature', operator: '>=', value: 40 }],
          },
        },
        {
          id: 'hot-deals',
          name: 'Hot Gaming Deals',
          active: true,
          filterExpression: {
            conditions: [{ field: 'temperature', operator: '>=', value: 200 }],
          },
        },
      ];

      const constraints = service.analyzeFiltersForCategory(
        filters as Filter[]
      );
      const optimizedUrl = service.generateOptimizedUrl(
        'https://www.dealabs.com/groupe/gaming',
        constraints
      );

      // Should use minimum temperature (40) to capture both filter requirements
      expect(optimizedUrl).toBe(
        'https://www.dealabs.com/groupe/gaming?temperatureFrom=40'
      );

      const potential = service.calculateOptimizationPotential(constraints);

      console.log('\nUser Scenario Results:');
      console.log('Filters: temp >= 40 and temp >= 200');
      console.log(`Optimized URL: ${optimizedUrl}`);
      console.log(
        `Expected temperature filter: temperatureFrom=40 (minimum across filters)`
      );
      console.log(
        `Estimated reduction: ${(potential.estimatedReduction * 100).toFixed(1)}%`
      );
    });

    it('should show minimal optimization for very loose filters', () => {
      const filters: Partial<Filter>[] = [
        {
          id: 'loose-filter',
          name: 'Very Loose Filter',
          active: true,
          filterExpression: {
            conditions: [
              { field: 'temperature', operator: '>=', value: 5 }, // Very loose
              { field: 'currentPrice', operator: '<=', value: 10000 }, // Very loose
            ],
          },
        },
      ];

      const constraints = service.analyzeFiltersForCategory(
        filters as Filter[]
      );
      const potential = service.calculateOptimizationPotential(constraints);

      expect(potential.estimatedReduction).toBeLessThan(0.3);
      expect(potential.confidence).toBe('low');

      console.log('\nLoose Filter Results:');
      console.log(
        `Estimated reduction: ${(potential.estimatedReduction * 100).toFixed(1)}%`
      );
      console.log(`Confidence: ${potential.confidence}`);
    });
  });

  describe('Performance benchmarking simulation', () => {
    it('should simulate performance improvements across different filter types', () => {
      const scenarios = [
        {
          name: 'Budget Gaming (≤€100, temp≥50)',
          filters: [
            {
              active: true,
              filterExpression: {
                conditions: [
                  { field: 'currentPrice', operator: '<=', value: 100 },
                  { field: 'temperature', operator: '>=', value: 50 },
                ],
              },
            },
          ],
        },
        {
          name: 'Super Hot Deals (temp≥300)',
          filters: [
            {
              active: true,
              filterExpression: {
                conditions: [
                  { field: 'temperature', operator: '>=', value: 300 },
                ],
              },
            },
          ],
        },
        {
          name: 'Amazon Budget Deals (≤€50, Amazon only)',
          filters: [
            {
              active: true,
              filterExpression: {
                conditions: [
                  { field: 'currentPrice', operator: '<=', value: 50 },
                  { field: 'merchant', operator: '==', value: 'Amazon' },
                ],
              },
            },
          ],
        },
        {
          name: 'No Meaningful Filters',
          filters: [
            {
              active: true,
              filterExpression: {
                conditions: [
                  { field: 'title', operator: 'contains', value: 'deal' },
                ],
              },
            },
          ],
        },
      ];

      console.log('\n=== Performance Benchmarking Simulation ===');

      scenarios.forEach((scenario) => {
        const constraints = service.analyzeFiltersForCategory(
          scenario.filters as unknown as Filter[]
        );
        const potential = service.calculateOptimizationPotential(constraints);

        console.log(`\n${scenario.name}:`);
        console.log(
          `  Estimated data reduction: ${(potential.estimatedReduction * 100).toFixed(1)}%`
        );
        console.log(`  Confidence: ${potential.confidence}`);
        console.log(`  Reasoning: ${potential.reasoning}`);

        if (potential.estimatedReduction > 0.3) {
          console.log(
            `  ✅ High optimization potential - recommended for URL filtering`
          );
        } else if (potential.estimatedReduction > 0.1) {
          console.log(`  ⚠️  Moderate optimization potential`);
        } else {
          console.log(
            `  ❌ Low optimization potential - may not be worth URL filtering`
          );
        }
      });
    });
  });

  describe('URL parameter validation', () => {
    it('should generate valid Dealabs URLs that match expected format', () => {
      const constraints = {
        temperature: { min: 100, max: 400 },
        price: { min: 50, max: 1000 },
        merchants: ['Amazon'],
      };

      const baseUrl = 'https://www.dealabs.com/groupe/gaming';
      const optimizedUrl = service.generateOptimizedUrl(baseUrl, constraints);

      // Verify URL structure
      expect(optimizedUrl).toMatch(
        /^https:\/\/www\.dealabs\.com\/groupe\/gaming\?/
      );

      const url = new URL(optimizedUrl);
      const params = url.searchParams;

      // Verify parameter format matches Dealabs expectations
      expect(params.get('temperatureFrom')).toBe('100');
      expect(params.get('temperatureTo')).toBe('400');
      expect(params.get('priceFrom')).toBe('50');
      expect(params.get('priceTo')).toBe('1000');

      console.log('\nGenerated URL Parameters:');
      params.forEach((value, key) => {
        console.log(`  ${key}: ${value}`);
      });
    });
  });
});
