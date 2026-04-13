import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsNumber, IsPositive } from 'class-validator';
import type { FilterExpressionInput } from '../types/filter-expression.types.js';

export class TestFilterDto {
  @ApiProperty({
    description: 'Filter expression to test',
    example: {
      categories: ['electronics', 'gaming'],
      minPrice: 500,
      maxPrice: 1500,
      titleKeywords: ['gaming', 'laptop', 'RTX'],
      excludedKeywords: ['refurbished', 'used'],
      minHeat: 100,
      dealTypes: ['direct', 'coupon'],
      specifications: {
        brand: ['ASUS', 'MSI', 'Dell'],
        ram: ['16GB', '32GB'],
        storage: ['SSD'],
      },
    },
  })
  @IsObject()
  filterExpression: FilterExpressionInput;

  @ApiPropertyOptional({
    description: 'Number of sample deals to test against',
    example: 100,
    minimum: 1,
    maximum: 1000,
    default: 100,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  sampleSize?: number = 100;
}
