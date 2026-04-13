import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Transform, plainToInstance, Type } from 'class-transformer';

// Import shared types from @dealscrapper/shared-types (single source of truth)
import type {
  FilterRule,
  FilterRuleGroup,
  RuleBasedFilterExpression,
  FilterExpressionInput,
  LogicalOperator,
  FilterOperator,
  FilterableField,
  RawDealField,
  ComputedField,
  FieldTypeMap,
} from '@dealscrapper/shared-types';
import { COMMON_FILTERABLE_FIELDS, SiteSource } from '@dealscrapper/shared-types';

// Re-export shared types for convenience (maintains backward compatibility)
export type {
  FilterRule,
  FilterRuleGroup,
  RuleBasedFilterExpression,
  FilterExpressionInput,
  LogicalOperator,
  FilterOperator,
  FilterableField,
  RawDealField,
  ComputedField,
  FieldTypeMap,
};

// Import RawDeal from shared-types as well
import type { RawDeal } from '@dealscrapper/shared-types';
export type { RawDeal };

// Use the authoritative field list from shared-types
export const FILTERABLE_FIELDS = COMMON_FILTERABLE_FIELDS;

// DTO classes for API validation (NestJS-specific)
export class FilterRuleDto {
  @ApiProperty({
    description: 'Field to filter on (derived from RawDeal interface)',
    example: 'temperature',
  })
  @IsString()
  @IsNotEmpty()
  field: FilterableField;

  @ApiProperty({
    description: 'Comparison operator',
    example: '>=',
  })
  @IsString()
  @IsNotEmpty()
  operator: FilterOperator;

  @ApiProperty({
    description:
      'Value(s) to compare against. Can be string, number, boolean, array, or Date',
    example: 100,
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array', items: { type: 'string' } },
      { type: 'string', format: 'date-time' },
    ],
  })
  value: string | number | boolean | string[] | number[] | Date | Date[];

  @ApiPropertyOptional({
    description: 'Whether string comparisons should be case sensitive',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean = false;

  @ApiPropertyOptional({
    description: 'Scoring weight for this rule (higher = more important)',
    example: 1.0,
    default: 1.0,
  })
  @IsOptional()
  @IsNumber()
  weight?: number = 1.0;

  @ApiPropertyOptional({
    description: 'Site-specific rule (only applies to articles from this site). If not specified, applies to all sites.',
    example: SiteSource.DEALABS,
    enum: SiteSource,
  })
  @IsOptional()
  @IsEnum(SiteSource, { message: 'Invalid site source for site-specific rule' })
  siteSpecific?: SiteSource;
}

export class FilterRuleGroupDto {
  @ApiProperty({
    description: 'Logical operator for combining rules in this group',
    example: 'AND',
  })
  @IsString()
  @IsNotEmpty()
  logic: LogicalOperator;

  @ApiProperty({
    description: 'Rules and sub-groups in this logical group',
    oneOf: [
      { $ref: '#/components/schemas/FilterRuleDto' },
      { $ref: '#/components/schemas/FilterRuleGroupDto' },
    ],
    isArray: true,
  })
  @IsArray()
  @IsNotEmpty()
  rules: (FilterRuleDto | FilterRuleGroupDto)[];

  @ApiPropertyOptional({
    description: 'Scoring weight for this entire group',
    example: 1.5,
    default: 1.0,
  })
  @IsOptional()
  @IsNumber()
  weight?: number = 1.0;
}

export class RuleBasedFilterExpressionDto {
  @ApiProperty({
    description: 'Rule-based filtering system with flexible expressions',
    oneOf: [
      { $ref: '#/components/schemas/FilterRuleDto' },
      { $ref: '#/components/schemas/FilterRuleGroupDto' },
    ],
    isArray: true,
    example: [
      {
        field: 'temperature',
        operator: '>=',
        value: 100,
        weight: 2.0,
      },
      {
        field: 'price',
        operator: 'BETWEEN',
        value: [800, 1500],
        weight: 1.5,
      },
      {
        logic: 'OR',
        rules: [
          {
            field: 'title',
            operator: 'REGEX',
            value: '.*(ps5|xbox|nintendo).*',
          },
          {
            field: 'category',
            operator: 'IN',
            value: ['gaming', 'consoles'],
          },
        ],
      },
    ],
  })
  @IsArray()
  @IsNotEmpty()
  rules: (FilterRuleDto | FilterRuleGroupDto)[];

  @ApiPropertyOptional({
    description: 'How to combine rules (default: AND)',
    example: 'AND',
    default: 'AND',
  })
  @IsOptional()
  @IsString()
  matchLogic?: LogicalOperator = 'AND';

  @ApiPropertyOptional({
    description: 'Minimum score threshold for matches',
    example: 75,
    default: 50,
  })
  @IsOptional()
  @IsNumber()
  minScore?: number = 50;

  @ApiPropertyOptional({
    description: 'Scoring calculation method',
    example: 'weighted',
    default: 'weighted',
  })
  @IsOptional()
  @IsString()
  scoreMode?: 'weighted' | 'percentage' | 'points' = 'weighted';
}

// Example complex filter expressions
export const EXAMPLE_FILTERS = {
  // Gaming laptops with complex rules
  GAMING_LAPTOPS: {
    rules: [
      {
        field: 'category',
        operator: 'IN',
        value: ['laptops', 'computers', 'gaming'],
        weight: 1.0,
      },
      {
        field: 'temperature',
        operator: '>=',
        value: 100,
        weight: 2.0,
      },
      {
        field: 'price',
        operator: 'BETWEEN',
        value: [800, 1500],
        weight: 1.5,
      },
      {
        logic: 'OR',
        weight: 1.2,
        rules: [
          {
            field: 'title',
            operator: 'REGEX',
            value: '.*(rtx|geforce|radeon|gaming).*',
            caseSensitive: false,
          },
          {
            field: 'description',
            operator: 'INCLUDES_ANY',
            value: ['RTX', 'GeForce', 'gaming', 'gamer'],
            caseSensitive: false,
          },
        ],
      },
      {
        logic: 'NOT',
        rules: [
          {
            field: 'title',
            operator: 'INCLUDES_ANY',
            value: ['refurbished', 'used', 'broken', 'damaged'],
            caseSensitive: false,
          },
        ],
      },
    ],
    matchLogic: 'AND',
    minScore: 75,
    scoreMode: 'weighted',
  } as RuleBasedFilterExpression,

  // Console deals with time constraints
  CONSOLE_DEALS: {
    rules: [
      {
        field: 'category',
        operator: 'CONTAINS',
        value: 'gaming',
        weight: 1.0,
      },
      {
        field: 'title',
        operator: 'REGEX',
        value: '.*(ps5|xbox|nintendo|switch|playstation).*',
        caseSensitive: false,
        weight: 2.0,
      },
      {
        field: 'temperature',
        operator: '>=',
        value: 200,
        weight: 1.5,
      },
      {
        field: 'age',
        operator: '<=',
        value: 6, // Hours
        weight: 0.8,
      },
      {
        field: 'freeShipping',
        operator: 'IS_TRUE',
        value: true,
        weight: 0.5,
      },
    ],
    matchLogic: 'AND',
    minScore: 80,
    scoreMode: 'weighted',
  } as RuleBasedFilterExpression,
};
