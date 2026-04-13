/**
 * Filterable Field Decorator
 * Decorator for marking class properties as filterable fields
 */
import 'reflect-metadata';
import type { SiteFilterableFieldOptions, SiteFieldDefinition } from './field-definition.types.js';

const FILTERABLE_METADATA_KEY = Symbol('filterable');

/**
 * Decorator to mark a property as a filterable field
 * @param options Configuration options for the filterable field
 */
export function SiteFilterableField(options: SiteFilterableFieldOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const existingFields: SiteFieldDefinition[] =
      Reflect.getMetadata(FILTERABLE_METADATA_KEY, target.constructor) || [];
    existingFields.push({ key: String(propertyKey), ...options });
    Reflect.defineMetadata(FILTERABLE_METADATA_KEY, existingFields, target.constructor);
  };
}

/**
 * Retrieves all filterable field definitions from a decorated class
 * @param target The class constructor to get fields from
 * @returns Array of field definitions
 */
export function getSiteFilterableFields(target: Function): SiteFieldDefinition[] {
  return Reflect.getMetadata(FILTERABLE_METADATA_KEY, target) || [];
}
