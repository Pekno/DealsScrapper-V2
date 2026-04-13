import { Injectable, Logger } from '@nestjs/common';
import type { Filter } from '@dealscrapper/database';
import type { RuleBasedFilterExpression } from '@dealscrapper/shared-types';

/**
 * Represents extracted constraints from filters that can be applied as URL parameters
 */
export interface FilterConstraints {
  temperature: {
    min: number | null;
    max: number | null;
  } | null;
  price: {
    min: number | null;
    max: number | null;
  } | null;
  merchants: string[];
}

/**
 * Estimated performance improvement from URL optimization
 */
export interface OptimizationPotential {
  estimatedReduction: number; // Percentage (0-1) of deals that will be filtered out at source
  confidence: 'none' | 'low' | 'medium' | 'high';
  reasoning: string;
}

/**
 * Represents a filter condition extracted from filter expressions
 */
interface FilterCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

/**
 * Represents the structure of a filter expression stored as JSON
 * Used for type-safe parsing of filterExpression from database
 */
interface ParsedFilterExpression {
  conditions?: Array<{
    field?: string;
    operator?: string;
    value?: string | number | boolean;
  }>;
  field?: string;
  operator?: string;
  value?: string | number | boolean;
}

/**
 * Service that optimizes scraping URLs by applying filter constraints as query parameters
 * This reduces the amount of data scraped by leveraging Dealabs' native filtering
 */
@Injectable()
export class UrlFilterOptimizerService {
  private readonly logger = new Logger(UrlFilterOptimizerService.name);

  /**
   * Known Dealabs retailer name to ID mappings (to be expanded)
   */
  private readonly retailerIdMap = new Map<string, string>([
    ['Amazon', 'amazon'],
    ['Cdiscount', 'cdiscount'],
    ['Fnac', 'fnac'],
    ['Darty', 'darty'],
    ['Boulanger', 'boulanger'],
    // Add more mappings as we discover them
  ]);

  /**
   * Analyzes active filters for a category to extract constraints that can be applied as URL parameters
   * @param filters - Active filters for the category
   * @returns Extracted constraints that can optimize the scraping URL
   */
  analyzeFiltersForCategory(filters: Filter[]): FilterConstraints {
    const activeFilters = filters.filter((f) => f.active);

    if (activeFilters.length === 0) {
      return this.createEmptyConstraints();
    }

    this.logger.debug(
      `Analyzing ${activeFilters.length} active filters for URL optimization`
    );

    const temperatureConstraints: Array<{ min?: number; max?: number }> = [];
    const priceConstraints: Array<{ min?: number; max?: number }> = [];
    const merchantConstraints: Set<string> = new Set();

    for (const filter of activeFilters) {
      try {
        const conditions = this.extractConditionsFromFilter(filter);

        for (const condition of conditions) {
          this.processCondition(
            condition,
            temperatureConstraints,
            priceConstraints,
            merchantConstraints
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to process filter ${filter.name}:`, error);
      }
    }

    return {
      temperature: this.consolidateTemperatureConstraints(
        temperatureConstraints
      ),
      price: this.consolidatePriceConstraints(priceConstraints),
      merchants: Array.from(merchantConstraints),
    };
  }

  /**
   * Generates an optimized URL with filter constraints applied as query parameters
   * @param baseUrl - Original category URL
   * @param constraints - Extracted filter constraints
   * @returns Optimized URL with query parameters
   */
  generateOptimizedUrl(
    baseUrl: string,
    constraints: FilterConstraints
  ): string {
    const url = new URL(baseUrl);
    let hasOptimizations = false;

    // Apply temperature constraints
    if (constraints.temperature) {
      if (constraints.temperature.min !== null) {
        url.searchParams.set(
          'temperatureFrom',
          constraints.temperature.min.toString()
        );
        hasOptimizations = true;
      }
      if (constraints.temperature.max !== null) {
        url.searchParams.set(
          'temperatureTo',
          constraints.temperature.max.toString()
        );
        hasOptimizations = true;
      }
    }

    // Apply price constraints
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

    // Apply merchant constraints (simplified implementation)
    if (constraints.merchants.length > 0) {
      // For now, we'll add a placeholder parameter
      // In the future, we need to map merchant names to Dealabs retailer IDs
      const retailerIds = constraints.merchants
        .map((merchant) => this.retailerIdMap.get(merchant))
        .filter(Boolean);

      if (retailerIds.length > 0) {
        url.searchParams.set('retailers', retailerIds.join(','));
        hasOptimizations = true;
      }
    }

    const optimizedUrl = url.toString();

    if (hasOptimizations) {
      this.logger.debug(`Optimized URL: ${baseUrl} -> ${optimizedUrl}`);
    }

    return optimizedUrl;
  }

  /**
   * Calculates the estimated performance improvement from applying URL optimization
   * @param constraints - Filter constraints to evaluate
   * @returns Estimated optimization potential
   */
  calculateOptimizationPotential(
    constraints: FilterConstraints
  ): OptimizationPotential {
    let totalReduction = 0;
    const reasons: string[] = [];

    // Temperature-based reduction estimates
    if (constraints.temperature && constraints.temperature.min !== null) {
      const tempMin = constraints.temperature.min;
      if (tempMin >= 200) {
        totalReduction += 0.8; // Very hot deals only (~20% of deals)
        reasons.push(`high temperature threshold (${tempMin}°+)`);
      } else if (tempMin >= 100) {
        totalReduction += 0.6; // Hot deals (~40% of deals)
        reasons.push(`moderate temperature threshold (${tempMin}°+)`);
      } else if (tempMin >= 50) {
        totalReduction += 0.3; // Lukewarm+ deals (~70% of deals)
        reasons.push(`mild temperature threshold (${tempMin}°+)`);
      } else {
        totalReduction += 0.1; // Very loose constraint
        reasons.push(`loose temperature threshold (${tempMin}°+)`);
      }
    }

    // Price-based reduction estimates
    if (constraints.price && constraints.price.max !== null) {
      const priceMax = constraints.price.max;
      if (priceMax <= 50) {
        totalReduction += 0.7; // Very budget deals
        reasons.push(`strict price limit (≤€${priceMax})`);
      } else if (priceMax <= 200) {
        totalReduction += 0.4; // Budget deals
        reasons.push(`moderate price limit (≤€${priceMax})`);
      } else if (priceMax <= 1000) {
        totalReduction += 0.2; // Mid-range deals
        reasons.push(`price limit (≤€${priceMax})`);
      }
    }

    // Merchant-based reduction (less predictable)
    if (constraints.merchants.length > 0 && constraints.merchants.length <= 3) {
      totalReduction += 0.3; // Specific retailers only
      reasons.push(`specific retailers (${constraints.merchants.join(', ')})`);
    }

    // Cap at 95% to be realistic
    totalReduction = Math.min(totalReduction, 0.95);

    // Determine confidence level
    let confidence: OptimizationPotential['confidence'];
    if (totalReduction === 0) {
      confidence = 'none';
    } else if (totalReduction < 0.2 || reasons.length === 0) {
      confidence = 'low';
    } else if (totalReduction < 0.5 || reasons.length === 1) {
      confidence = 'medium';
    } else {
      confidence = 'high';
    }

    const reasoning =
      reasons.length > 0
        ? `Filtering by ${reasons.join(' and ')}`
        : 'No significant constraints found';

    return {
      estimatedReduction: totalReduction,
      confidence,
      reasoning,
    };
  }

  /**
   * Extracts individual conditions from a filter's expression tree
   */
  private extractConditionsFromFilter(filter: Filter): FilterCondition[] {
    const conditions: FilterCondition[] = [];

    try {
      // Parse JSON expression with type safety - filterExpression is Prisma.JsonValue
      const rawExpression = filter.filterExpression;
      if (!rawExpression || typeof rawExpression !== 'object') {
        return conditions;
      }
      const expression = rawExpression as ParsedFilterExpression;

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
      this.logger.warn(
        `Failed to parse filter expression for ${filter.name}:`,
        error
      );
    }

    return conditions;
  }

  /**
   * Processes a single condition and updates the appropriate constraint arrays
   */
  private processCondition(
    condition: FilterCondition,
    temperatureConstraints: Array<{ min?: number; max?: number }>,
    priceConstraints: Array<{ min?: number; max?: number }>,
    merchantConstraints: Set<string>
  ): void {
    const { field, operator, value } = condition;

    if (field === 'temperature') {
      const constraint: { min?: number; max?: number } = {};
      const numValue = typeof value === 'number' ? value : Number(value);

      if (!isNaN(numValue)) {
        if (operator === '>=' || operator === '>') {
          constraint.min = operator === '>' ? numValue + 1 : numValue;
        } else if (operator === '<=' || operator === '<') {
          constraint.max = operator === '<' ? numValue - 1 : numValue;
        }

        if (constraint.min !== undefined || constraint.max !== undefined) {
          temperatureConstraints.push(constraint);
        }
      }
    } else if (field === 'currentPrice') {
      const constraint: { min?: number; max?: number } = {};
      const numValue = typeof value === 'number' ? value : Number(value);

      if (!isNaN(numValue)) {
        if (operator === '>=' || operator === '>') {
          constraint.min = operator === '>' ? numValue + 0.01 : numValue;
        } else if (operator === '<=' || operator === '<') {
          constraint.max = operator === '<' ? numValue - 0.01 : numValue;
        }

        if (constraint.min !== undefined || constraint.max !== undefined) {
          priceConstraints.push(constraint);
        }
      }
    } else if (field === 'merchant' && operator === '==') {
      merchantConstraints.add(String(value));
    }
  }

  /**
   * Consolidates multiple temperature constraints into a single range
   * Uses the broadest range to ensure all filters can potentially match
   */
  private consolidateTemperatureConstraints(
    constraints: Array<{ min?: number; max?: number }>
  ): { min: number | null; max: number | null } | null {
    if (constraints.length === 0) {
      return null;
    }

    const mins = constraints
      .map((c) => c.min)
      .filter((m) => m !== undefined) as number[];
    const maxs = constraints
      .map((c) => c.max)
      .filter((m) => m !== undefined) as number[];

    return {
      min: mins.length > 0 ? Math.min(...mins) : null,
      max: maxs.length > 0 ? Math.max(...maxs) : null,
    };
  }

  /**
   * Consolidates multiple price constraints into a single range
   * Uses the broadest range to ensure all filters can potentially match
   */
  private consolidatePriceConstraints(
    constraints: Array<{ min?: number; max?: number }>
  ): { min: number | null; max: number | null } | null {
    if (constraints.length === 0) {
      return null;
    }

    const mins = constraints
      .map((c) => c.min)
      .filter((m) => m !== undefined) as number[];
    const maxs = constraints
      .map((c) => c.max)
      .filter((m) => m !== undefined) as number[];

    return {
      min: mins.length > 0 ? Math.min(...mins) : null,
      max: maxs.length > 0 ? Math.max(...maxs) : null,
    };
  }

  /**
   * Creates empty constraints object
   */
  private createEmptyConstraints(): FilterConstraints {
    return {
      temperature: null,
      price: null,
      merchants: [],
    };
  }
}
