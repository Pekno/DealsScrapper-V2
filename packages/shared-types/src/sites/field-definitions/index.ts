/**
 * Field Definitions Registry
 * Aggregates all field definitions and provides utility functions
 */
import { UniversalFilterSchema } from './universal.fields.js';
import { SharedFilterSchema } from './shared.fields.js';
import { DealabsFilterSchema } from './dealabs.fields.js';
import { VintedFilterSchema } from './vinted.fields.js';
import { LeBonCoinFilterSchema } from './leboncoin.fields.js';
import { getSiteFilterableFields } from './base/filterable-field.decorator.js';
import type { SiteFieldDefinition } from './base/field-definition.types.js';

/**
 * Registry of all filter schema classes
 */
export const SITE_FILTER_SCHEMA_REGISTRY = [
  UniversalFilterSchema,
  SharedFilterSchema,
  DealabsFilterSchema,
  VintedFilterSchema,
  LeBonCoinFilterSchema,
] as const;

/**
 * Pre-computed field definitions from all schemas
 */
export const ALL_SITE_FIELD_DEFINITIONS: SiteFieldDefinition[] = SITE_FILTER_SCHEMA_REGISTRY.flatMap(
  (schema) => getSiteFilterableFields(schema)
);

/**
 * Map of field key/alias to field definition for quick lookups
 */
export const SITE_FIELD_DEFINITION_MAP: Map<string, SiteFieldDefinition> = new Map();

// Populate the map with primary keys and aliases
ALL_SITE_FIELD_DEFINITIONS.forEach((field) => {
  SITE_FIELD_DEFINITION_MAP.set(field.key, field);
  if (field.aliases) {
    field.aliases.forEach((alias) => {
      SITE_FIELD_DEFINITION_MAP.set(alias, field);
    });
  }
});

/**
 * Get field definitions for specific site IDs
 * @param siteIds Array of site IDs to get fields for
 * @returns Array of field definitions available for the given sites
 */
export function getFieldsForSites(siteIds: string[]): SiteFieldDefinition[] {
  return ALL_SITE_FIELD_DEFINITIONS.filter(
    (field) =>
      field.sites === 'universal' ||
      (Array.isArray(field.sites) && field.sites.some((s) => siteIds.includes(s)))
  );
}

/**
 * Get a field definition by key or alias
 * @param fieldKeyOrAlias The field key or alias
 * @returns The field definition or undefined
 */
export function getFieldDefinition(fieldKeyOrAlias: string): SiteFieldDefinition | undefined {
  return SITE_FIELD_DEFINITION_MAP.get(fieldKeyOrAlias);
}

/**
 * Resolve a field alias to its canonical key
 * @param fieldKeyOrAlias The field key or alias
 * @returns The canonical field key or the input if not found
 */
export function resolveFieldAlias(fieldKeyOrAlias: string): string {
  const field = SITE_FIELD_DEFINITION_MAP.get(fieldKeyOrAlias);
  return field ? field.key : fieldKeyOrAlias;
}

// Re-export types and schemas
export * from './base/field-definition.types.js';
export * from './base/filterable-field.decorator.js';
export {
  UniversalFilterSchema,
  SharedFilterSchema,
  DealabsFilterSchema,
  VintedFilterSchema,
  LeBonCoinFilterSchema,
};
