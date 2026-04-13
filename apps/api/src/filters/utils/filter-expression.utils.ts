import { Prisma } from '@dealscrapper/database';
import {
  FilterExpressionInput,
  RuleBasedFilterExpression,
  convertFilterExpressionForDb as sharedConvertForDb,
  convertFilterExpressionFromDb as sharedConvertFromDb,
} from '@dealscrapper/shared-types';

/**
 * Converts FilterExpressionInput (rule-based with Date objects) to Prisma-compatible JSON
 */
export function convertFilterExpressionForDb(
  expression: FilterExpressionInput
): Prisma.JsonObject {
  return sharedConvertForDb(expression) as Prisma.JsonObject;
}

/**
 * Converts Prisma JSON back to FilterExpressionInput (rule-based with Date objects)
 */
export function convertFilterExpressionFromDb(
  expression: unknown
): FilterExpressionInput {
  return sharedConvertFromDb(expression);
}

/**
 * Type-safe parser for filter expressions stored as Prisma Json.
 * Validates the basic structure before returning.
 *
 * @param json - Prisma JsonValue from database (filterExpression field)
 * @returns Parsed RuleBasedFilterExpression or null if invalid
 */
export function parseFilterExpression(
  json: Prisma.JsonValue | null | undefined,
): RuleBasedFilterExpression | null {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return null;
  }

  const obj = json as Record<string, unknown>;

  // Basic structure validation - must have 'rules' array
  if (!('rules' in obj) || !Array.isArray(obj.rules)) {
    return null;
  }

  return json as unknown as RuleBasedFilterExpression;
}
