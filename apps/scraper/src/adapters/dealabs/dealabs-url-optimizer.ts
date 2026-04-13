import { Injectable, Logger } from '@nestjs/common';
import type {
  IUrlOptimizer,
  FilterConstraints,
} from '../base/url-optimizer.interface.js';

interface FilterCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

interface Filter {
  filterExpression: unknown;
}

@Injectable()
export class DealabsUrlOptimizer implements IUrlOptimizer {
  private readonly logger = new Logger(DealabsUrlOptimizer.name);

  /**
   * Dealabs-specific merchant ID mapping.
   * Maps merchant names to Dealabs retailer IDs.
   */
  private readonly retailerIdMap = new Map<string, string>([
    ['amazon', '1'],
    ['Amazon', '1'],
    ['fnac', '45'],
    ['Fnac', '45'],
    ['cdiscount', '78'],
    ['Cdiscount', '78'],
    ['boulanger', '102'],
    ['Boulanger', '102'],
    ['darty', '67'],
    ['Darty', '67'],
    // Add more Dealabs merchant IDs as discovered
  ]);

  supportsOptimization(): boolean {
    return true;
  }

  /**
   * Generates optimized URL with Dealabs-specific query params.
   * Example: https://www.dealabs.com/groupe/high-tech?temperatureFrom=100&priceFrom=10&priceTo=500
   */
  optimizeUrl(baseUrl: string, constraints: FilterConstraints): string {
    const url = new URL(baseUrl);
    let hasOptimizations = false;

    // Dealabs-specific: temperature filtering
    if (constraints.temperature) {
      if (constraints.temperature.min !== null) {
        url.searchParams.set(
          'temperatureFrom',
          constraints.temperature.min.toString(),
        );
        hasOptimizations = true;
      }
      if (constraints.temperature.max !== null) {
        url.searchParams.set(
          'temperatureTo',
          constraints.temperature.max.toString(),
        );
        hasOptimizations = true;
      }
    }

    // Dealabs-specific: price filtering
    if (constraints.price) {
      if (constraints.price.min !== null) {
        url.searchParams.set('priceFrom', constraints.price.min.toString());
        hasOptimizations = true;
      }
      if (constraints.price.max !== null) {
        url.searchParams.set('priceTo', constraints.price.max.toString());
        hasOptimizations = true;
      }
    }

    // Dealabs-specific: merchant filtering (using retailer IDs)
    if (constraints.merchants && constraints.merchants.length > 0) {
      const retailerIds = constraints.merchants
        .map((merchant) => this.retailerIdMap.get(merchant.toLowerCase()))
        .filter((id): id is string => id !== undefined);

      if (retailerIds.length > 0) {
        url.searchParams.set('retailers', retailerIds.join(','));
        hasOptimizations = true;
      }
    }

    const optimizedUrl = url.toString();

    if (hasOptimizations) {
      this.logger.log('Optimized Dealabs URL', {
        original: baseUrl,
        optimized: optimizedUrl,
        constraints,
      });
    }

    return optimizedUrl;
  }

  /**
   * Extracts constraints from active filters.
   */
  extractConstraints(filters: unknown[]): FilterConstraints {
    const filterArray = filters as Filter[];
    const constraints: FilterConstraints = {
      price: { min: null, max: null },
      temperature: { min: null, max: null },
      merchants: [],
    };

    const temperatureConstraints: Array<{ min?: number; max?: number }> = [];
    const priceConstraints: Array<{ min?: number; max?: number }> = [];
    const merchantSet = new Set<string>();

    for (const filter of filterArray) {
      try {
        const conditions = this.extractConditionsFromFilter(filter);

        for (const condition of conditions) {
          this.processCondition(
            condition,
            temperatureConstraints,
            priceConstraints,
            merchantSet,
          );
        }
      } catch (error) {
        this.logger.warn('Failed to process filter', { error });
      }
    }

    // Consolidate overlapping constraints
    constraints.temperature =
      this.consolidateNumericConstraints(temperatureConstraints);
    constraints.price = this.consolidateNumericConstraints(priceConstraints);
    constraints.merchants = Array.from(merchantSet);

    return constraints;
  }

  /**
   * Extracts individual conditions from a filter's expression tree.
   */
  private extractConditionsFromFilter(filter: Filter): FilterCondition[] {
    const conditions: FilterCondition[] = [];

    try {
      const expression = filter.filterExpression as {
        conditions?: unknown[];
        field?: string;
        operator?: string;
        value?: string | number | boolean;
      };

      if (expression.conditions && Array.isArray(expression.conditions)) {
        // Handle AND/OR expression with conditions array
        for (const condition of expression.conditions) {
          if (
            typeof condition === 'object' &&
            condition !== null &&
            'field' in condition &&
            'operator' in condition &&
            'value' in condition &&
            condition.field &&
            condition.operator &&
            condition.value !== undefined
          ) {
            conditions.push(condition as FilterCondition);
          }
        }
      } else if (
        expression.field &&
        expression.operator &&
        expression.value !== undefined
      ) {
        // Handle single condition
        conditions.push(expression as FilterCondition);
      }
    } catch (error) {
      this.logger.warn('Failed to parse filter expression', { error });
    }

    return conditions;
  }

  /**
   * Processes a single condition and updates constraint arrays.
   */
  private processCondition(
    condition: FilterCondition,
    temperatureConstraints: Array<{ min?: number; max?: number }>,
    priceConstraints: Array<{ min?: number; max?: number }>,
    merchantSet: Set<string>,
  ): void {
    const { field, operator, value } = condition;

    if (field === 'temperature') {
      this.processNumericRule(value, operator, temperatureConstraints);
    } else if (field === 'currentPrice' || field === 'price') {
      this.processNumericRule(value, operator, priceConstraints);
    } else if (field === 'merchant') {
      if (operator === '==' || operator === 'equals' || operator === 'in') {
        const merchants = Array.isArray(value) ? value : [value];
        merchants.forEach((m) => merchantSet.add(String(m)));
      }
    }
  }

  /**
   * Processes numeric rule (temperature or price).
   */
  private processNumericRule(
    value: string | number | boolean,
    operator: string,
    constraints: Array<{ min?: number; max?: number }>,
  ): void {
    const numValue = typeof value === 'number' ? value : Number(value);

    if (isNaN(numValue)) return;

    const constraint: { min?: number; max?: number } = {};

    if (operator === '>=' || operator === 'gte') {
      constraint.min = numValue;
    } else if (operator === '>' || operator === 'greaterThan') {
      constraint.min = numValue + (Number.isInteger(numValue) ? 1 : 0.01);
    } else if (operator === '<=' || operator === 'lte') {
      constraint.max = numValue;
    } else if (operator === '<' || operator === 'lessThan') {
      constraint.max = numValue - (Number.isInteger(numValue) ? 1 : 0.01);
    } else if (operator === 'between' && Array.isArray(value) && value.length === 2) {
      constraint.min = Number(value[0]);
      constraint.max = Number(value[1]);
    }

    if (constraint.min !== undefined || constraint.max !== undefined) {
      constraints.push(constraint);
    }
  }

  /**
   * Consolidates multiple numeric constraints into a single range.
   * Uses the broadest range to ensure all filters can potentially match.
   */
  private consolidateNumericConstraints(
    constraints: Array<{ min?: number; max?: number }>,
  ): { min: number | null; max: number | null } | undefined {
    if (constraints.length === 0) {
      return undefined;
    }

    const mins = constraints
      .map((c) => c.min)
      .filter((m): m is number => m !== undefined);
    const maxs = constraints
      .map((c) => c.max)
      .filter((m): m is number => m !== undefined);

    return {
      min: mins.length > 0 ? Math.min(...mins) : null,
      max: maxs.length > 0 ? Math.max(...maxs) : null,
    };
  }
}
