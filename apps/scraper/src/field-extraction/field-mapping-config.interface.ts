import type { Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import type { SiteSource } from '@dealscrapper/shared-types';

/**
 * Declarative field mapping configuration.
 * Defines how to extract each field from HTML.
 */
export interface FieldMappingConfig {
  [fieldName: string]: FieldMapping;
}

export interface FieldMapping {
  /**
   * CSS selector chain (fallback priority order).
   * First matching selector wins.
   */
  selectors: string[];

  /**
   * Extraction strategy.
   */
  strategy: ExtractionStrategy;

  /**
   * Attribute name (for 'attribute' strategy).
   */
  attribute?: string;

  /**
   * Regex pattern (for 'regex' strategy).
   */
  regex?: string | RegExp;

  /**
   * Regex group to extract (for 'regex' strategy).
   */
  regexGroup?: number;

  /**
   * Is this field required?
   * If true and extraction fails, listing is discarded.
   */
  required?: boolean;

  /**
   * Default value if extraction fails.
   */
  default?: unknown;

  /**
   * Transformation pipeline.
   * Executed in order: sanitize → parse → validate → custom transforms.
   */
  transform?: TransformPipeline;

  /**
   * Parser function name (built-in parsers).
   */
  parser?: ParserType;

  /**
   * Validator configuration.
   */
  validator?: ValidatorConfig;
}

/**
 * Extraction strategies.
 */
export type ExtractionStrategy =
  | 'text' // Extract element.text()
  | 'attribute' // Extract element.attr(name)
  | 'html' // Extract element.html()
  | 'regex' // Extract with regex from text
  | 'custom'; // Custom extraction function

/**
 * Built-in parser types.
 */
export type ParserType =
  | 'integer'
  | 'float'
  | 'price'
  | 'date'
  | 'relativeDate'
  | 'boolean'
  | 'url';

/**
 * Transform pipeline (string names or functions).
 */
export type TransformPipeline = Array<TransformFunction | string>;

export type TransformFunction = (
  value: unknown,
  context: ExtractionContext,
) => unknown;

/**
 * Extraction context (passed to transforms).
 */
export interface ExtractionContext {
  siteId: SiteSource;
  siteBaseUrl: string;
  $element: Cheerio<Element>;
  sourceUrl: string;
}

/**
 * Validator configuration.
 */
export interface ValidatorConfig {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: unknown[];
}
