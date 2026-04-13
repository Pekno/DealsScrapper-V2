/**
 * Field Definition Types
 * Core type definitions for filterable fields
 */

/** Field data types that determine which operators are available */
export type SiteFieldDataType = 'string' | 'number' | 'boolean' | 'date' | 'array';

/** URL param mapping strategy types */
export type UrlParamType = 'range' | 'text' | 'boolean_map' | 'set' | 'custom_range';

/** URL param mapping configuration for a filterable field */
export interface UrlParamConfig {
  /** Strategy for converting filter conditions to URL query parameters */
  type: UrlParamType;
  /** For 'range': URL param name for minimum value (e.g. 'temperatureFrom') */
  min?: string;
  /** For 'range': URL param name for maximum value (e.g. 'temperatureTo') */
  max?: string;
  /** For 'text', 'boolean_map', 'set', 'custom_range': URL param name */
  param?: string;
  /** For 'boolean_map': value when condition is true (e.g. 'pro') */
  trueValue?: string;
  /** For 'boolean_map': value when condition is false (e.g. 'private') */
  falseValue?: string;
  /** For 'custom_range': literal string representing "no minimum" (e.g. 'min') */
  minLiteral?: string;
  /** For 'custom_range': literal string representing "no maximum" (e.g. 'max') */
  maxLiteral?: string;
  /** Safety margin for range types (e.g. 5 for temperature) */
  buffer?: number;
  /** For 'set': name-to-ID mapping (e.g. merchant names to retailer IDs) */
  idMap?: Record<string, string>;
}

/** Options for defining a filterable field */
export interface SiteFilterableFieldOptions {
  /** Display label for the field */
  label: string;
  /** Data type of the field */
  type: SiteFieldDataType;
  /** Description of what the field represents */
  description?: string;
  /** Available operators for this field */
  operators: string[];
  /** Sites this field is available for, or 'universal' for all sites */
  sites: string[] | 'universal';
  /** Field aliases (e.g., 'heat' -> 'temperature', 'price' -> 'currentPrice') */
  aliases?: string[];
  /** Minimum value for numeric fields */
  min?: number;
  /** Maximum value for numeric fields */
  max?: number;
  /** Step increment for numeric fields */
  step?: number;
  /** Decimal precision for numeric fields */
  precision?: number;
  /** URL optimization: how this field maps to a URL query parameter on the site */
  urlParam?: UrlParamConfig;
}

/** Complete field definition including the field key */
export interface SiteFieldDefinition extends SiteFilterableFieldOptions {
  /** The field key/name */
  key: string;
}
