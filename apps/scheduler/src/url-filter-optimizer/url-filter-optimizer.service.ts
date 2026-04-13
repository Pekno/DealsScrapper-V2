import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@dealscrapper/database';
import type { Filter } from '@dealscrapper/database';
import {
  SiteSource,
  resolveFieldAlias,
  getFieldDefinition,
  type UrlParamConfig,
} from '@dealscrapper/shared-types';
import { SharedConfigService } from '@dealscrapper/shared-config';
import { SITE_URL_CONFIGS } from './site-url-configs.js';

/**
 * Represents a filter condition extracted from filter expressions
 */
interface FilterCondition {
  field: string;
  operator: string;
  value: string | number | boolean | string[] | number[] | null | undefined;
  siteSpecific?: string;
}

/**
 * Type guard for filter expression structure
 */
interface FilterExpressionLike {
  rules?: Array<{
    field?: string;
    operator?: string;
    value?: unknown;
    siteSpecific?: string;
  }>;
  conditions?: Array<{
    field?: string;
    operator?: string;
    value?: unknown;
    siteSpecific?: string;
  }>;
  field?: string;
  operator?: string;
  value?: unknown;
  siteSpecific?: string;
}

function isFilterExpressionLike(value: unknown): value is FilterExpressionLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    (('rules' in value && Array.isArray(value.rules)) ||
      ('conditions' in value && Array.isArray(value.conditions)))
  );
}

/**
 * Collected range constraints for a single field, to be consolidated
 */
interface RangeEntry {
  min?: number;
  max?: number;
}

/**
 * Service that optimizes scraping URLs by applying filter constraints as query parameters.
 * Uses SiteFieldDefinition metadata and per-site configs to generate site-specific URL params.
 */
@Injectable()
export class UrlFilterOptimizerService {
  private readonly logger = new Logger(UrlFilterOptimizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sharedConfig: SharedConfigService
  ) {}

  /**
   * Handles filter-change events by computing optimized query strings for affected categories
   */
  async handleFilterChangeEvent(categoryIds: string[]): Promise<void> {
    let optimizationEnabled: boolean;
    try {
      optimizationEnabled = this.sharedConfig.get<boolean>('URL_OPTIMIZATION_ENABLED');
    } catch {
      optimizationEnabled = true;
    }

    if (!optimizationEnabled) {
      this.logger.debug('URL optimization disabled via URL_OPTIMIZATION_ENABLED=false');
      for (const categoryId of categoryIds) {
        try {
          const siteSource = await this.getSiteSourceForCategory(categoryId);
          const config = siteSource ? SITE_URL_CONFIGS[siteSource] : null;
          const universalQuery = config
            ? new URLSearchParams(config.universalParams).toString()
            : '';
          await this.updateScheduledJobOptimization(categoryId, universalQuery);
        } catch (error) {
          this.logger.error(
            `Failed to store universal flags for category ${categoryId}:`,
            error
          );
        }
      }
      return;
    }

    this.logger.log(
      `Processing filter-change event for ${categoryIds.length} categories`
    );

    for (const categoryId of categoryIds) {
      try {
        await this.computeAndStoreOptimizedQuery(categoryId);
      } catch (error) {
        this.logger.error(
          `Failed to optimize URL for category ${categoryId}:`,
          error
        );
      }
    }

    this.logger.log(
      `Completed URL optimization for ${categoryIds.length} categories`
    );
  }

  /**
   * Computes and stores optimized query string for a specific category
   */
  private async computeAndStoreOptimizedQuery(
    categoryId: string
  ): Promise<void> {
    this.logger.debug(
      `Starting optimization computation for category ${categoryId}`
    );

    const siteSource = await this.getSiteSourceForCategory(categoryId);
    if (!siteSource) {
      this.logger.warn(`Could not determine site source for category ${categoryId}`);
      return;
    }

    const siteConfig = SITE_URL_CONFIGS[siteSource];

    const filters = await this.getActiveFiltersForCategory(categoryId);
    this.logger.debug(
      `Found ${filters.length} active filters for category ${categoryId} (site: ${siteSource})`
    );

    if (filters.length === 0) {
      const universalQuery = new URLSearchParams(siteConfig.universalParams).toString();
      await this.updateScheduledJobOptimization(categoryId, universalQuery);
      this.logger.log(
        `Generated optimized query for category ${categoryId}: ${universalQuery} (no filters, universal params only)`
      );
      return;
    }

    const optimizedQuery = this.buildOptimizedQuery(filters, siteSource, siteConfig);
    await this.updateScheduledJobOptimization(categoryId, optimizedQuery);

    this.logger.log(
      `Generated optimized query for category ${categoryId}: ${optimizedQuery}`
    );
  }

  /**
   * Builds optimized query string from filters using site-specific field definitions
   */
  buildOptimizedQuery(
    filters: Filter[],
    siteSource: SiteSource,
    siteConfig = SITE_URL_CONFIGS[siteSource]
  ): string {
    const activeFilters = filters.filter((f) => f.active);
    if (activeFilters.length === 0) {
      return new URLSearchParams(siteConfig.universalParams).toString();
    }

    // Collect all params keyed by param name, with range consolidation
    const rangeCollector = new Map<string, { urlParam: UrlParamConfig; entries: RangeEntry[] }>();
    const directParams = new Map<string, string>();

    for (const filter of activeFilters) {
      try {
        const conditions = this.extractConditionsFromFilter(filter);
        for (const condition of conditions) {
          // Skip conditions that are site-specific and don't match this category's site
          if (condition.siteSpecific && condition.siteSpecific !== siteSource) {
            this.logger.debug(
              `Skipping condition for field "${condition.field}" (siteSpecific: ${condition.siteSpecific}, category site: ${siteSource})`
            );
            continue;
          }

          const urlParam = this.resolveUrlParam(condition.field, siteSource, siteConfig);
          if (!urlParam) {
            this.logger.debug(
              `No URL param mapping for field "${condition.field}" on site ${siteSource}`
            );
            continue;
          }

          this.applyConditionToParams(
            condition,
            urlParam,
            rangeCollector,
            directParams
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to process filter ${filter.name}:`, error);
      }
    }

    // Consolidate range constraints and build final params
    const params = new URLSearchParams();

    for (const [, { urlParam, entries }] of rangeCollector) {
      const consolidated = this.consolidateRangeEntries(entries);
      this.applyConsolidatedRange(urlParam, consolidated, params);
    }

    for (const [key, value] of directParams) {
      params.set(key, value);
    }

    // Append universal params
    for (const [key, value] of Object.entries(siteConfig.universalParams)) {
      params.set(key, value);
    }

    return params.toString();
  }

  /**
   * Resolves the UrlParamConfig for a field on a given site.
   * Checks the field's own urlParam first (site-specific fields),
   * then falls back to the site's universal field mappings.
   */
  private resolveUrlParam(
    fieldName: string,
    siteSource: SiteSource,
    siteConfig = SITE_URL_CONFIGS[siteSource]
  ): UrlParamConfig | null {
    const canonicalKey = resolveFieldAlias(fieldName);
    const fieldDef = getFieldDefinition(canonicalKey);

    // Check if the field definition itself has a urlParam (site-specific fields)
    if (fieldDef?.urlParam) {
      // Verify this field belongs to the current site
      if (
        fieldDef.sites === 'universal' ||
        (Array.isArray(fieldDef.sites) && fieldDef.sites.includes(siteSource))
      ) {
        return fieldDef.urlParam;
      }
    }

    // Check the site's universal field mappings
    const universalMapping = siteConfig.universalFieldMappings.find(
      (m) => m.fieldKey === canonicalKey
    );
    if (universalMapping) {
      return universalMapping.urlParam;
    }

    return null;
  }

  /**
   * Applies a single condition to the param collectors based on URL param type
   */
  private applyConditionToParams(
    condition: FilterCondition,
    urlParam: UrlParamConfig,
    rangeCollector: Map<string, { urlParam: UrlParamConfig; entries: RangeEntry[] }>,
    directParams: Map<string, string>
  ): void {
    const { operator, value } = condition;

    switch (urlParam.type) {
      case 'range':
      case 'custom_range': {
        const rangeKey = urlParam.type === 'range'
          ? `${urlParam.min}|${urlParam.max}`
          : `${urlParam.param}`;
        if (!rangeCollector.has(rangeKey)) {
          rangeCollector.set(rangeKey, { urlParam, entries: [] });
        }
        const entry = this.extractRangeEntry(operator, value);
        if (entry) {
          rangeCollector.get(rangeKey)!.entries.push(entry);
        }
        break;
      }

      case 'text': {
        if (!urlParam.param) break;
        if (
          (operator === 'CONTAINS' || operator === 'INCLUDES' ||
           operator === 'EQUALS' || operator === '==' || operator === '=') &&
          typeof value === 'string' && value.length > 0
        ) {
          directParams.set(urlParam.param, value);
        }
        break;
      }

      case 'boolean_map': {
        if (!urlParam.param) break;
        const isTrueOp = operator === 'IS_TRUE' ||
          ((operator === '==' || operator === '=' || operator === 'EQUALS') && value === true);
        const isFalseOp = operator === 'IS_FALSE' ||
          ((operator === '==' || operator === '=' || operator === 'EQUALS') && value === false);

        if (isTrueOp && urlParam.trueValue) {
          directParams.set(urlParam.param, urlParam.trueValue);
        } else if (isFalseOp && urlParam.falseValue) {
          directParams.set(urlParam.param, urlParam.falseValue);
        }
        break;
      }

      case 'set': {
        if (!urlParam.param) break;
        const values: string[] = [];

        if ((operator === '==' || operator === '=' || operator === 'EQUALS') && value != null) {
          values.push(String(value));
        } else if (operator === 'IN' && Array.isArray(value)) {
          values.push(...value.filter((v): v is string => typeof v === 'string'));
        }

        if (values.length > 0) {
          const mapped = urlParam.idMap
            ? values
                .map((v) => urlParam.idMap![v.toLowerCase()] ?? urlParam.idMap![v])
                .filter((id): id is string => id !== undefined)
            : values;

          if (mapped.length > 0) {
            directParams.set(urlParam.param, mapped.join(','));
          }
        }
        break;
      }
    }
  }

  /**
   * Extracts a range entry (min/max) from an operator and value
   */
  private extractRangeEntry(
    operator: string,
    value: FilterCondition['value']
  ): RangeEntry | null {
    // BETWEEN operator
    if (operator === 'BETWEEN' && Array.isArray(value) && value.length === 2) {
      const minNum = typeof value[0] === 'number' ? value[0] : Number(value[0]);
      const maxNum = typeof value[1] === 'number' ? value[1] : Number(value[1]);
      if (!isNaN(minNum) && !isNaN(maxNum)) {
        return { min: minNum, max: maxNum };
      }
      return null;
    }

    // IN operator: use min/max of array
    if (operator === 'IN' && Array.isArray(value) && value.length > 0) {
      const nums = value
        .map((v) => (typeof v === 'number' ? v : Number(v)))
        .filter((n) => !isNaN(n) && Number.isFinite(n));
      if (nums.length > 0) {
        return { min: Math.min(...nums), max: Math.max(...nums) };
      }
      return null;
    }

    // Single value operators
    if (value === null || value === undefined) return null;
    const numValue = typeof value === 'number' ? value : Number(value);
    if (isNaN(numValue)) return null;

    if (operator === '>=' || operator === '>') {
      return { min: operator === '>' ? numValue + 1 : numValue };
    }
    if (operator === '<=' || operator === '<') {
      return { max: operator === '<' ? numValue - 1 : numValue };
    }
    if (operator === '==' || operator === '=' || operator === 'EQUALS') {
      return { min: numValue, max: numValue };
    }

    // NOT_EQUALS and others can't be optimized
    return null;
  }

  /**
   * Consolidates multiple range entries into a single broadest range
   */
  private consolidateRangeEntries(
    entries: RangeEntry[]
  ): { min: number | null; max: number | null } {
    if (entries.length === 0) {
      return { min: null, max: null };
    }

    const mins = entries
      .map((e) => e.min)
      .filter((m): m is number => m !== undefined && Number.isFinite(m));
    const maxs = entries
      .map((e) => e.max)
      .filter((m): m is number => m !== undefined && Number.isFinite(m));

    return {
      min: mins.length > 0 ? Math.min(...mins) : null,
      max: maxs.length > 0 ? Math.max(...maxs) : null,
    };
  }

  /**
   * Applies a consolidated range to URLSearchParams based on the URL param type
   */
  private applyConsolidatedRange(
    urlParam: UrlParamConfig,
    range: { min: number | null; max: number | null },
    params: URLSearchParams
  ): void {
    const buffer = urlParam.buffer ?? 0;

    if (urlParam.type === 'range') {
      if (range.min !== null && urlParam.min) {
        const buffered = Math.max(0, range.min - buffer);
        params.set(urlParam.min, buffered.toString());
      }
      if (range.max !== null && urlParam.max) {
        const buffered = range.max + buffer;
        params.set(urlParam.max, buffered.toString());
      }
    } else if (urlParam.type === 'custom_range' && urlParam.param) {
      const minStr = range.min !== null
        ? Math.max(0, range.min - buffer).toString()
        : (urlParam.minLiteral ?? 'min');
      const maxStr = range.max !== null
        ? (range.max + buffer).toString()
        : (urlParam.maxLiteral ?? 'max');

      // Only set the param if at least one bound is a real number
      if (range.min !== null || range.max !== null) {
        params.set(urlParam.param, `${minStr}-${maxStr}`);
      }
    }
  }

  /**
   * Gets the SiteSource for a category
   */
  private async getSiteSourceForCategory(
    categoryId: string
  ): Promise<SiteSource | null> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { site: true },
    });

    if (!category) {
      this.logger.warn(`Category ${categoryId} not found`);
      return null;
    }

    const siteId = category.siteId as SiteSource;
    if (!Object.values(SiteSource).includes(siteId)) {
      this.logger.warn(`Unknown site source "${category.siteId}" for category ${categoryId}`);
      return null;
    }

    return siteId;
  }

  /**
   * Retrieves all active filters for a specific category
   */
  private async getActiveFiltersForCategory(
    categoryId: string
  ): Promise<Filter[]> {
    return this.prisma.filter.findMany({
      where: {
        active: true,
        categories: {
          some: {
            categoryId: categoryId,
          },
        },
      },
      include: {
        categories: true,
      },
    });
  }

  /**
   * Updates the ScheduledJob table with optimized query string
   */
  private async updateScheduledJobOptimization(
    categoryId: string,
    optimizedQuery: string
  ): Promise<void> {
    await this.prisma.scheduledJob.upsert({
      where: { categoryId },
      update: {
        optimizedQuery,
        optimizationUpdatedAt: new Date(),
      },
      create: {
        categoryId,
        optimizedQuery,
        optimizationUpdatedAt: new Date(),
        isActive: true,
      },
    });
  }

  /**
   * Type guard to validate a rule/condition object
   */
  private isValidCondition(obj: {
    field?: string;
    operator?: string;
    value?: unknown;
    siteSpecific?: string;
  }): obj is {
    field: string;
    operator: string;
    value: string | number | boolean | string[] | number[] | null | undefined;
    siteSpecific?: string;
  } {
    return (
      typeof obj.field === 'string' &&
      typeof obj.operator === 'string' &&
      obj.value !== undefined &&
      (typeof obj.value === 'string' ||
        typeof obj.value === 'number' ||
        typeof obj.value === 'boolean' ||
        obj.value === null ||
        (Array.isArray(obj.value) &&
          (obj.value.every((v) => typeof v === 'string') ||
            obj.value.every((v) => typeof v === 'number'))))
    );
  }

  /**
   * Extracts individual conditions from a filter's expression tree.
   * Supports both old format (conditions) and new format (rules).
   */
  private extractConditionsFromFilter(filter: Filter): FilterCondition[] {
    const conditions: FilterCondition[] = [];

    try {
      if (!isFilterExpressionLike(filter.filterExpression)) {
        this.logger.warn(
          `Filter "${filter.name}" has invalid expression structure`
        );
        return conditions;
      }

      const expression = filter.filterExpression;

      // Handle new format with "rules" array (current system)
      if (expression.rules && Array.isArray(expression.rules)) {
        for (const rule of expression.rules) {
          if (this.isValidCondition(rule)) {
            conditions.push({
              field: rule.field,
              operator: rule.operator,
              value: rule.value,
              siteSpecific: rule.siteSpecific,
            });
          }
        }
      }
      // Handle old format with "conditions" array (legacy)
      else if (expression.conditions && Array.isArray(expression.conditions)) {
        for (const condition of expression.conditions) {
          if (this.isValidCondition(condition)) {
            conditions.push({
              field: condition.field,
              operator: condition.operator,
              value: condition.value,
              siteSpecific: condition.siteSpecific,
            });
          }
        }
      }
      // Handle single condition
      else if (this.isValidCondition(expression)) {
        conditions.push({
          field: expression.field,
          operator: expression.operator,
          value: expression.value,
          siteSpecific: expression.siteSpecific,
        });
      }

      this.logger.debug(
        `Extracted ${conditions.length} conditions from filter "${filter.name}"`
      );
    } catch (error) {
      this.logger.warn(
        `Failed to parse filter expression for ${filter.name}:`,
        error
      );
    }

    return conditions;
  }
}
