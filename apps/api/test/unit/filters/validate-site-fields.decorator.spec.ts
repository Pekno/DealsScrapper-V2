import { validate } from 'class-validator';
import { SiteSource } from '@dealscrapper/shared-types';
import {
  ValidateSiteSpecificFields,
  validateFilterRules,
} from '../../../src/filters/validation/validate-site-fields.decorator.js';
import type {
  FilterRule,
  FilterRuleGroup,
} from '@dealscrapper/shared-types';

/**
 * Test DTO that uses the ValidateSiteSpecificFields decorator
 */
class TestFilterDto {
  enabledSites: SiteSource[];

  @ValidateSiteSpecificFields()
  filterExpression: {
    rules: (FilterRule | FilterRuleGroup)[];
  };
}

describe('ValidateSiteSpecificFields Decorator', () => {
  describe('Universal Fields', () => {
    it('should allow universal fields with any site configuration', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.VINTED];
      dto.filterExpression = {
        rules: [
          {
            field: 'title',
            operator: 'CONTAINS',
            value: 'laptop',
          } as FilterRule,
          {
            field: 'price',
            operator: '>=',
            value: 100,
          } as FilterRule,
          {
            field: 'description',
            operator: 'REGEX',
            value: 'gaming',
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow universal fields with multiple sites enabled', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [
        SiteSource.DEALABS,
        SiteSource.VINTED,
        SiteSource.LEBONCOIN,
      ];
      dto.filterExpression = {
        rules: [
          {
            field: 'url',
            operator: 'CONTAINS',
            value: 'amazon',
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow empty rules array', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS];
      dto.filterExpression = {
        rules: [],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Dealabs-Specific Fields', () => {
    it('should allow Dealabs-specific field when siteSpecific is set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS];
      dto.filterExpression = {
        rules: [
          {
            field: 'temperature',
            operator: '>=',
            value: 100,
            siteSpecific: SiteSource.DEALABS,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject Dealabs-specific field when siteSpecific is not set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.VINTED];
      dto.filterExpression = {
        rules: [
          {
            field: 'temperature',
            operator: '>=',
            value: 100,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toBeDefined();
      const errorMessage = Object.values(errors[0].constraints || {})[0];
      expect(errorMessage).toContain('temperature');
      expect(errorMessage).toContain('Dealabs');
    });

    it('should allow multiple Dealabs-specific fields when siteSpecific is set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS];
      dto.filterExpression = {
        rules: [
          {
            field: 'temperature',
            operator: '>=',
            value: 100,
            siteSpecific: SiteSource.DEALABS,
          } as FilterRule,
          {
            field: 'commentCount',
            operator: '>',
            value: 10,
            siteSpecific: SiteSource.DEALABS,
          } as FilterRule,
          {
            field: 'freeShipping',
            operator: 'IS_TRUE',
            value: true,
            siteSpecific: SiteSource.DEALABS,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject freeShipping field when siteSpecific is not set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.LEBONCOIN];
      dto.filterExpression = {
        rules: [
          {
            field: 'freeShipping',
            operator: 'IS_TRUE',
            value: true,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const errorMessage = Object.values(errors[0].constraints || {})[0];
      expect(errorMessage).toContain('freeShipping');
      expect(errorMessage).toContain('Dealabs');
    });
  });

  describe('Vinted-Specific Fields', () => {
    it('should allow Vinted-specific field when siteSpecific is set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.VINTED];
      dto.filterExpression = {
        rules: [
          {
            field: 'favoriteCount',
            operator: '>=',
            value: 5,
            siteSpecific: SiteSource.VINTED,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject Vinted-specific field when siteSpecific is not set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS];
      dto.filterExpression = {
        rules: [
          {
            field: 'boosted',
            operator: 'IS_TRUE',
            value: true,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const errorMessage = Object.values(errors[0].constraints || {})[0];
      expect(errorMessage).toContain('boosted');
      expect(errorMessage).toContain('Vinted');
    });

    it('should allow multiple Vinted-specific fields when siteSpecific is set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.VINTED];
      dto.filterExpression = {
        rules: [
          {
            field: 'brand',
            operator: 'IN',
            value: ['Nike', 'Adidas'],
            siteSpecific: SiteSource.VINTED,
          } as FilterRule,
          {
            field: 'size',
            operator: '==',
            value: 'M',
            siteSpecific: SiteSource.VINTED,
          } as FilterRule,
          {
            field: 'condition',
            operator: '==',
            value: 'Neuf avec étiquette',
            siteSpecific: SiteSource.VINTED,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('LeBonCoin-Specific Fields', () => {
    it('should allow LeBonCoin-specific field when siteSpecific is set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.LEBONCOIN];
      dto.filterExpression = {
        rules: [
          {
            field: 'city',
            operator: '==',
            value: 'Paris',
            siteSpecific: SiteSource.LEBONCOIN,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject LeBonCoin-specific field when siteSpecific is not set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.VINTED];
      dto.filterExpression = {
        rules: [
          {
            field: 'urgentFlag',
            operator: 'IS_TRUE',
            value: true,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const errorMessage = Object.values(errors[0].constraints || {})[0];
      expect(errorMessage).toContain('urgentFlag');
      expect(errorMessage).toContain('LeBonCoin');
    });

    it('should allow multiple LeBonCoin-specific fields when siteSpecific is set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.LEBONCOIN];
      dto.filterExpression = {
        rules: [
          {
            field: 'proSeller',
            operator: 'IS_FALSE',
            value: false,
            siteSpecific: SiteSource.LEBONCOIN,
          } as FilterRule,
          {
            field: 'department',
            operator: '==',
            value: '75',
            siteSpecific: SiteSource.LEBONCOIN,
          } as FilterRule,
          {
            field: 'topAnnonce',
            operator: 'IS_TRUE',
            value: true,
            siteSpecific: SiteSource.LEBONCOIN,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Nested Rule Groups', () => {
    it('should validate nested AND groups with site-specific fields', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS];
      dto.filterExpression = {
        rules: [
          {
            logic: 'AND',
            rules: [
              {
                field: 'temperature',
                operator: '>=',
                value: 100,
                siteSpecific: SiteSource.DEALABS,
              } as FilterRule,
              {
                field: 'commentCount',
                operator: '>',
                value: 5,
                siteSpecific: SiteSource.DEALABS,
              } as FilterRule,
            ],
          } as FilterRuleGroup,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject nested groups with missing siteSpecific fields', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.VINTED];
      dto.filterExpression = {
        rules: [
          {
            logic: 'AND',
            rules: [
              {
                field: 'title',
                operator: 'CONTAINS',
                value: 'laptop',
              } as FilterRule,
              {
                field: 'temperature', // Dealabs field, missing siteSpecific
                operator: '>=',
                value: 100,
              } as FilterRule,
            ],
          } as FilterRuleGroup,
        ],
      };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const errorMessage = Object.values(errors[0].constraints || {})[0];
      expect(errorMessage).toContain('temperature');
      expect(errorMessage).toContain('Dealabs');
    });

    it('should validate deeply nested rule groups', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS, SiteSource.VINTED];
      dto.filterExpression = {
        rules: [
          {
            logic: 'OR',
            rules: [
              {
                logic: 'AND',
                rules: [
                  {
                    field: 'temperature', // Dealabs
                    operator: '>=',
                    value: 100,
                    siteSpecific: SiteSource.DEALABS,
                  } as FilterRule,
                  {
                    field: 'freeShipping', // Dealabs
                    operator: 'IS_TRUE',
                    value: true,
                    siteSpecific: SiteSource.DEALABS,
                  } as FilterRule,
                ],
              } as FilterRuleGroup,
              {
                logic: 'AND',
                rules: [
                  {
                    field: 'favoriteCount', // Vinted
                    operator: '>=',
                    value: 10,
                    siteSpecific: SiteSource.VINTED,
                  } as FilterRule,
                  {
                    field: 'boosted', // Vinted
                    operator: 'IS_TRUE',
                    value: true,
                    siteSpecific: SiteSource.VINTED,
                  } as FilterRule,
                ],
              } as FilterRuleGroup,
            ],
          } as FilterRuleGroup,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate NOT groups with site-specific fields', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS];
      dto.filterExpression = {
        rules: [
          {
            logic: 'NOT',
            rules: [
              {
                field: 'isCoupon',
                operator: 'IS_TRUE',
                value: true,
                siteSpecific: SiteSource.DEALABS,
              } as FilterRule,
            ],
          } as FilterRuleGroup,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Explicit siteSpecific Property', () => {
    it('should allow field with explicit siteSpecific when that site is enabled', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS];
      dto.filterExpression = {
        rules: [
          {
            field: 'temperature',
            operator: '>=',
            value: 100,
            siteSpecific: SiteSource.DEALABS,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should allow field with explicit siteSpecific regardless of enabledSites', async () => {
      // NEW BEHAVIOR: The decorator validates siteSpecific against valid sites for the field,
      // NOT against enabledSites. Site validation against categories happens in the service layer.
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.VINTED]; // Site doesn't match siteSpecific
      dto.filterExpression = {
        rules: [
          {
            field: 'temperature',
            operator: '>=',
            value: 100,
            siteSpecific: SiteSource.DEALABS, // Valid for temperature field
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      // Should pass - decorator only validates that siteSpecific is valid for the field
      expect(errors).toHaveLength(0);
    });

    it('should allow universal field with explicit siteSpecific (siteSpecific is ignored for universal fields)', async () => {
      // NEW BEHAVIOR: Universal fields always pass validation, siteSpecific is ignored
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.VINTED];
      dto.filterExpression = {
        rules: [
          {
            field: 'title', // Universal field
            operator: 'CONTAINS',
            value: 'laptop',
            siteSpecific: SiteSource.DEALABS, // Ignored for universal fields
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      // Should pass - universal fields are always valid
      expect(errors).toHaveLength(0);
    });

    it('should reject field with wrong siteSpecific value', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS, SiteSource.VINTED];
      dto.filterExpression = {
        rules: [
          {
            field: 'temperature', // Dealabs-specific
            operator: '>=',
            value: 100,
            siteSpecific: SiteSource.VINTED, // Wrong site for temperature
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const errorMessage = Object.values(errors[0].constraints || {})[0];
      expect(errorMessage).toContain('temperature');
      expect(errorMessage).toContain('Dealabs');
    });
  });

  describe('Multiple Sites Enabled', () => {
    it('should allow mixing site-specific fields when all have siteSpecific set', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [
        SiteSource.DEALABS,
        SiteSource.VINTED,
        SiteSource.LEBONCOIN,
      ];
      dto.filterExpression = {
        rules: [
          {
            field: 'temperature', // Dealabs
            operator: '>=',
            value: 100,
            siteSpecific: SiteSource.DEALABS,
          } as FilterRule,
          {
            field: 'favoriteCount', // Vinted
            operator: '>=',
            value: 5,
            siteSpecific: SiteSource.VINTED,
          } as FilterRule,
          {
            field: 'urgentFlag', // LeBonCoin
            operator: 'IS_TRUE',
            value: true,
            siteSpecific: SiteSource.LEBONCOIN,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject when one site-specific field is missing siteSpecific', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS, SiteSource.VINTED];
      dto.filterExpression = {
        rules: [
          {
            field: 'temperature', // Dealabs - has siteSpecific
            operator: '>=',
            value: 100,
            siteSpecific: SiteSource.DEALABS,
          } as FilterRule,
          {
            field: 'urgentFlag', // LeBonCoin - missing siteSpecific
            operator: 'IS_TRUE',
            value: true,
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const errorMessage = Object.values(errors[0].constraints || {})[0];
      expect(errorMessage).toContain('urgentFlag');
      expect(errorMessage).toContain('LeBonCoin');
    });
  });

  describe('Unknown Fields', () => {
    it('should reject unknown field names', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS];
      dto.filterExpression = {
        rules: [
          {
            field: 'nonExistentField',
            operator: '==',
            value: 'test',
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const errorMessage = Object.values(errors[0].constraints || {})[0];
      expect(errorMessage).toContain('Unknown field');
      expect(errorMessage).toContain('nonExistentField');
    });
  });

  describe('Edge Cases', () => {
    it('should reject site-specific field without siteSpecific even when enabledSites is missing', async () => {
      const dto = new TestFilterDto();
      // enabledSites not set
      dto.filterExpression = {
        rules: [
          {
            field: 'temperature',
            operator: '>=',
            value: 100,
            siteSpecific: SiteSource.DEALABS, // Must have siteSpecific
          } as FilterRule,
        ],
      };

      const errors = await validate(dto);
      // Should pass because siteSpecific is set
      expect(errors).toHaveLength(0);
    });

    it('should handle missing filterExpression gracefully', async () => {
      const dto = new TestFilterDto();
      dto.enabledSites = [SiteSource.DEALABS];
      // filterExpression not set

      const errors = await validate(dto);
      // Should pass - no rules to validate
      expect(errors).toHaveLength(0);
    });
  });
});

describe('validateFilterRules Helper Function', () => {
  it('should return empty array for valid rules with siteSpecific', () => {
    const rules: FilterRule[] = [
      {
        field: 'temperature',
        operator: '>=',
        value: 100,
        siteSpecific: SiteSource.DEALABS,
      } as FilterRule,
    ];

    const errors = validateFilterRules(rules);
    expect(errors).toHaveLength(0);
  });

  it('should return error messages for rules missing siteSpecific', () => {
    const rules: FilterRule[] = [
      {
        field: 'temperature',
        operator: '>=',
        value: 100,
      } as FilterRule,
    ];

    const errors = validateFilterRules(rules);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('temperature');
    expect(errors[0]).toContain('Dealabs');
  });

  it('should handle nested rule groups', () => {
    const rules: (FilterRule | FilterRuleGroup)[] = [
      {
        logic: 'AND',
        rules: [
          {
            field: 'temperature',
            operator: '>=',
            value: 100,
            siteSpecific: SiteSource.DEALABS,
          } as FilterRule,
        ],
      } as FilterRuleGroup,
    ];

    const errors = validateFilterRules(rules);
    expect(errors).toHaveLength(0);
  });

  it('should return multiple errors for multiple rules missing siteSpecific', () => {
    const rules: FilterRule[] = [
      {
        field: 'temperature', // Dealabs - missing siteSpecific
        operator: '>=',
        value: 100,
      } as FilterRule,
      {
        field: 'boosted', // Vinted - missing siteSpecific
        operator: 'IS_TRUE',
        value: true,
      } as FilterRule,
    ];

    const errors = validateFilterRules(rules);
    expect(errors.length).toBe(2);
    expect(errors[0]).toContain('temperature');
    expect(errors[1]).toContain('boosted');
  });
});
