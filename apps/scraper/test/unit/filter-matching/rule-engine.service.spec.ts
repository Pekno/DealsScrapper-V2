import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from '../../../src/filter-matching/rule-engine.service';
import { RawDeal } from '../../../src/common/interfaces';
import { RuleBasedFilterExpression } from '../../../src/common/interfaces';

describe('RuleEngineService', () => {
  let service: RuleEngineService;

  const mockDeal = {
    externalId: 'deal-12345',
    title: 'Gaming Laptop ASUS ROG RTX 4060 16GB',
    description: 'High-end gaming laptop with RTX graphics',
    category: 'laptops',
    categoryPath: ['tech', 'laptops', 'gaming'],
    currentPrice: 1299,
    originalPrice: 1599,
    discountPercentage: 18.76,
    discountAmount: 300,
    temperature: 150,
    voteCount: 45,
    upvotes: 40,
    downvotes: 5,
    commentCount: 12,
    viewCount: 850,
    shareCount: 15,
    merchant: 'Amazon',
    merchantType: 'official',
    merchantRating: 4.5,
    dealType: 'direct',
    exclusivityLevel: 'public',
    urgencyLevel: 'normal',
    stockLevel: 'in-stock',
    publishedAt: new Date('2025-01-07T10:00:00Z'),
    expiresAt: new Date('2025-01-15T23:59:59Z'),
    dealAge: 2,
    freeShipping: true,
    pickupAvailable: false,
    deliveryMethods: ['standard', 'express'],
    geographicRestrictions: [],
    communityVerified: true,
    contributorLevel: 'gold',
    url: 'https://example.com/deal',
    imageUrl: 'https://example.com/image.jpg',
    keywords: ['gaming', 'laptop', 'asus', 'rtx'],
    tags: ['high-tech', 'gaming'],
    searchTerms: ['gaming laptop', 'rtx 4060'],
    isExpired: false,
    isCoupon: false,
    isSponsored: false,
    qualityScore: 85,
    siteId: 'dealabs',
    isActive: true,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleEngineService],
    }).compile();

    service = module.get<RuleEngineService>(RuleEngineService);
  });

  describe('User Preference Evaluation', () => {
    it('should identify popular deals based on community engagement', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'temperature',
            operator: '>=',
            value: 100,
            weight: 1.0,
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      // Business outcome: User gets deals validated by community
      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(50);

      // Business value: Quality assurance through popularity
      expect(result.details).toHaveLength(1);
      expect(result.details[0].matches).toBe(true);
      expect(result.details[0].reason).toContain('Temperature');
    });

    it('should protect users from low-quality deals lacking community approval', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'temperature',
            operator: '>=',
            value: 200, // Deal has 150, below threshold
            weight: 1.0,
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      // Business outcome: User avoids deals without strong community endorsement
      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should respect user budget constraints for financial responsibility', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'price',
            operator: 'BETWEEN',
            value: [1000, 1500], // Deal at €1299 fits within budget
            weight: 1.0,
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      // Business outcome: User stays within planned spending range
      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(50);
    });

    it('should find products matching user interests and use cases', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'title',
            operator: 'REGEX',
            value: '.*(gaming|gamer).*laptop.*',
            caseSensitive: false,
            weight: 1.0,
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      // Business outcome: User finds products for their specific needs (gaming)
      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(50);
    });

    it('should match merchant with IN operator', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'merchant',
            operator: 'IN',
            value: ['Amazon', 'Fnac', 'Cdiscount'],
            weight: 1.0,
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(50);
    });

    it('should match boolean field with IS_TRUE operator', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'freeShipping',
            operator: 'IS_TRUE',
            value: true,
            weight: 1.0,
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(50);
    });
  });

  describe('Logical Rule Groups', () => {
    it('should handle AND logic correctly', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            logic: 'AND',
            rules: [
              {
                field: 'temperature',
                operator: '>=',
                value: 100,
              },
              {
                field: 'price',
                operator: '<=',
                value: 1500,
              },
            ],
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(50);
    });

    it('should handle OR logic correctly', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            logic: 'OR',
            rules: [
              {
                field: 'temperature',
                operator: '>=',
                value: 300, // This will fail
              },
              {
                field: 'freeShipping',
                operator: 'IS_TRUE',
                value: true, // This will pass
              },
            ],
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should handle NOT logic correctly', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            logic: 'NOT',
            rules: [
              {
                field: 'title',
                operator: 'INCLUDES_ANY',
                value: ['refurbished', 'used', 'broken'],
                caseSensitive: false,
              },
            ],
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      expect(result.matches).toBe(true); // Deal title doesn't contain excluded words
      expect(result.score).toBeGreaterThan(50); // Should have a positive score
    });
  });

  describe('Complex Real-World Scenarios', () => {
    it('should deliver high-quality gaming laptops that meet all user requirements', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'category',
            operator: 'IN',
            value: ['laptops', 'gaming', 'computers'],
            weight: 1.0,
          },
          {
            field: 'temperature',
            operator: '>=',
            value: 100,
            weight: 2.0, // Community approval is very important
          },
          {
            field: 'price',
            operator: 'BETWEEN',
            value: [800, 1600],
            weight: 1.5, // Budget compliance is important
          },
          {
            field: 'title',
            operator: 'REGEX',
            value: '.*(gaming|rtx).*',
            caseSensitive: false,
            weight: 1.2, // Gaming specs matter
          },
          {
            logic: 'NOT',
            rules: [
              {
                field: 'title',
                operator: 'INCLUDES_ANY',
                value: ['refurbished', 'used'],
                caseSensitive: false,
              },
            ],
          },
        ],
        matchLogic: 'AND',
        minScore: 75,
        scoreMode: 'weighted',
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      // Business outcome: User gets a comprehensive gaming laptop match
      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(75);

      // Business value: Multiple quality criteria are satisfied
      const ruleResults = result.details.filter((d) => d.matches);
      expect(ruleResults.length).toBeGreaterThan(3);

      // Business assurance: Deal meets category, popularity, budget AND gaming requirements
      expect(result.details.length).toBeGreaterThan(0);
    });

    it('should identify genuine savings opportunities for users', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'discountPercent',
            operator: '>=',
            value: 15,
            weight: 1.0,
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      // Business outcome: User gets significant savings (18.7% discount)
      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(50);

      // Business value: Real discounts validated (original €1599 → current €1299)
      expect(result.details[0].reason).toContain('discountPercent');
    });

    it('should handle age calculation correctly', async () => {
      // Create a deal that's 2 hours old
      const recentDeal = {
        ...mockDeal,
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      };

      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'age',
            operator: '<=',
            value: 6, // Less than 6 hours old
            weight: 1.0,
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        recentDeal
      );

      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(50);
    });

    it('should help bargain hunters find time-sensitive deals', async () => {
      // Create a recent deal for age testing
      const recentDeal = {
        ...mockDeal,
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      };

      // Test age-based filtering for fresh deals
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'age',
            operator: '<=',
            value: 6, // Deal posted within last 6 hours
            weight: 1.0,
          },
          {
            field: 'temperature',
            operator: '>=',
            value: 120, // Hot community response
            weight: 1.5,
          },
        ],
        matchLogic: 'AND',
        minScore: 60,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        recentDeal
      );

      // Business outcome: User catches trending deals while they're still available
      expect(result.matches).toBe(true);
      expect(result.score).toBeGreaterThan(60);

      // Business value: Both freshness and popularity criteria met
      const matchedRules = result.details.filter((d) => d.matches);
      expect(matchedRules).toHaveLength(2);

      // Business assurance: Deal is both recent and community-validated
      expect(result.details.some((d) => d.reason.includes('Deal Age'))).toBe(
        true
      );
      expect(result.details.some((d) => d.reason.includes('Temperature'))).toBe(
        true
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid regex gracefully', async () => {
      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'title',
            operator: 'REGEX',
            value: '[invalid-regex', // Invalid regex
            weight: 1.0,
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        mockDeal
      );

      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should handle missing fields gracefully', async () => {
      const incompleteDeal = {
        ...mockDeal,
        temperature: 0,
        merchant: undefined,
      };

      const expression: RuleBasedFilterExpression = {
        rules: [
          {
            field: 'temperature',
            operator: '>=',
            value: 100,
            weight: 1.0,
          },
          {
            field: 'merchant',
            operator: 'EQUALS',
            value: 'Amazon',
            weight: 1.0,
          },
        ],
        minScore: 50,
      };

      const result = await service.evaluateFilterExpression(
        expression as any,
        incompleteDeal
      );

      expect(result.matches).toBe(false);
      expect(result.score).toBe(0);
    });
  });
});
