import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RuleBasedFilterExpressionDto, type FilterExpressionInput } from '../types/rule-based-filter.types.js';
import { ValidateSiteSpecificFields } from '../validation/validate-site-fields.decorator.js';

export type DigestFrequency = 'hourly' | 'daily' | 'weekly' | 'disabled';

export class CreateFilterDto {
  @ApiProperty({
    description: 'Filter name for easy identification',
    example: 'Gaming Laptop Deals',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Detailed description of what this filter monitors',
    example: 'Monitor high-end gaming laptops under $1500 with RTX graphics',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this filter is actively monitoring deals',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean = true;

  @ApiProperty({
    description: 'List of category IDs to monitor for deals. Sites are derived from categories.',
    example: ['cldx123abc', 'cldx456def'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  categoryIds: string[];

  // Note: enabledSites removed - sites are now derived from filter.categories[].category.siteId

  @ApiProperty({
    description: 'Rule-based filtering system with flexible expressions',
    type: RuleBasedFilterExpressionDto,
    example: {
      rules: [
        {
          field: 'category',
          operator: 'IN',
          value: ['electronics', 'gaming'],
          weight: 1.0,
        },
        {
          field: 'price',
          operator: 'BETWEEN',
          value: [500, 1500],
          weight: 1.5,
        },
        {
          field: 'temperature',
          operator: '>=',
          value: 100,
          weight: 2.0,
        },
        {
          field: 'title',
          operator: 'REGEX',
          value: '.*(gaming|gamer).*laptop.*',
          caseSensitive: false,
          weight: 1.2,
        },
        {
          logic: 'NOT',
          rules: [
            {
              field: 'title',
              operator: 'INCLUDES_ANY',
              value: ['refurbished', 'used'],
            },
          ],
        },
        {
          logic: 'OR',
          rules: [
            {
              field: 'merchant',
              operator: 'IN',
              value: ['Amazon', 'Fnac'],
            },
            {
              field: 'freeShipping',
              operator: 'IS_TRUE',
              value: true,
            },
          ],
        },
      ],
      matchLogic: 'AND',
      minScore: 75,
      scoreMode: 'weighted',
    },
  })
  @IsObject()
  @ValidateSiteSpecificFields()
  filterExpression: FilterExpressionInput;

  @ApiPropertyOptional({
    description: 'Send immediate notifications when deals match this filter',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  immediateNotifications?: boolean = true;

  @ApiPropertyOptional({
    description: 'Frequency for digest notifications with matched deals',
    example: 'daily',
    enum: ['hourly', 'daily', 'weekly', 'disabled'],
    default: 'daily',
  })
  @IsOptional()
  @IsEnum(['hourly', 'daily', 'weekly', 'disabled'])
  digestFrequency?: DigestFrequency = 'daily';

  @ApiPropertyOptional({
    description: 'Maximum number of notifications per day to prevent spam',
    example: 50,
    minimum: 1,
    maximum: 200,
    default: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxNotificationsPerDay?: number = 50;
}
