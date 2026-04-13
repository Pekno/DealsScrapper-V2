import { Injectable, Logger } from '@nestjs/common';
import type { CheerioAPI, Cheerio } from 'cheerio';
import type { Element } from 'domhandler';
import { sanitizeText, validatePrice } from '../utils/security.utils.js';
import type {
  FieldMappingConfig,
  FieldMapping,
  ExtractionContext,
  ValidatorConfig,
  TransformFunction,
  ParserType,
} from './field-mapping-config.interface.js';

@Injectable()
export class FieldExtractorService {
  private readonly logger = new Logger(FieldExtractorService.name);
  private readonly builtInTransforms = new Map<string, TransformFunction>();
  private readonly builtInParsers = new Map<ParserType, TransformFunction>();

  constructor() {
    this.registerBuiltInTransforms();
    this.registerBuiltInParsers();
  }

  /**
   * Extracts all fields from HTML element using config.
   */
  extract(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    config: FieldMappingConfig,
    context: Partial<ExtractionContext>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    const fullContext: ExtractionContext = {
      $element,
      ...context,
    } as ExtractionContext;

    for (const [fieldName, mapping] of Object.entries(config)) {
      try {
        const value = this.extractField($, $element, mapping, fullContext);

        if (value !== null && value !== undefined) {
          result[fieldName] = value;
        } else if (mapping.default !== undefined) {
          result[fieldName] = mapping.default;
        } else if (mapping.required) {
          throw new Error(`Required field "${fieldName}" extraction failed`);
        }
      } catch (error) {
        if (mapping.required) {
          throw new Error(
            `Failed to extract required field "${fieldName}": ${(error as Error).message}`,
          );
        }
        const errorMsg = (error as Error).message || 'Unknown error';
        this.logger.debug(
          `Failed to extract optional field "${fieldName}": ${errorMsg} ` +
          `(selectors: ${mapping.selectors.join(', ')})`,
        );
      }
    }

    return result;
  }

  /**
   * Extracts a single field using selector chain and strategy.
   */
  private extractField(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    mapping: FieldMapping,
    context: ExtractionContext,
  ): unknown {
    // Step 1: Try each selector in chain
    let rawValue: unknown = null;
    let $foundElement: Cheerio<Element> | null = null;

    for (const selector of mapping.selectors) {
      $foundElement = $element.find(selector);
      if ($foundElement.length > 0) {
        rawValue = this.extractByStrategy($, $foundElement, mapping);
        if (rawValue) break; // Found it!
      }
    }

    if (!rawValue) {
      return mapping.default ?? null;
    }

    // Step 2: Apply transformations
    let value: unknown = rawValue;

    // Built-in transforms (by name)
    if (mapping.transform) {
      for (const transform of mapping.transform) {
        if (typeof transform === 'string') {
          const fn = this.builtInTransforms.get(transform);
          if (fn) {
            value = fn(value, context);
          }
        } else {
          value = transform(value, context);
        }
      }
    }

    // Step 3: Apply parser
    if (mapping.parser) {
      const parserFn = this.builtInParsers.get(mapping.parser);
      if (parserFn) {
        value = parserFn(value, context);
      }
    }

    // Step 4: Apply validation
    if (mapping.validator) {
      value = this.validate(value, mapping.validator);
    }

    return value;
  }

  /**
   * Extracts value using specified strategy.
   */
  private extractByStrategy(
    $: CheerioAPI,
    $element: Cheerio<Element>,
    mapping: FieldMapping,
  ): unknown {
    switch (mapping.strategy) {
      case 'text':
        return $element.text().trim();

      case 'attribute':
        if (!mapping.attribute) {
          throw new Error('Attribute name required for "attribute" strategy');
        }
        return $element.attr(mapping.attribute) ?? null;

      case 'html':
        return $element.html() ?? null;

      case 'regex':
        if (!mapping.regex) {
          throw new Error('Regex pattern required for "regex" strategy');
        }
        const text = $element.text();
        const regex =
          typeof mapping.regex === 'string'
            ? new RegExp(mapping.regex)
            : mapping.regex;
        const match = text.match(regex);
        if (!match) return null;
        return match[mapping.regexGroup ?? 1] ?? match[0];

      case 'custom':
        throw new Error('Custom strategy must be handled by adapter');

      default:
        throw new Error(`Unknown extraction strategy: ${mapping.strategy}`);
    }
  }

  /**
   * Validates extracted value.
   */
  private validate(value: unknown, validator: ValidatorConfig): unknown {
    if (typeof value === 'number') {
      if (validator.min !== undefined && value < validator.min) {
        throw new Error(`Value ${value} below minimum ${validator.min}`);
      }
      if (validator.max !== undefined && value > validator.max) {
        throw new Error(`Value ${value} above maximum ${validator.max}`);
      }
    }

    if (typeof value === 'string') {
      if (
        validator.minLength !== undefined &&
        value.length < validator.minLength
      ) {
        throw new Error(
          `String length ${value.length} below minimum ${validator.minLength}`,
        );
      }
      if (
        validator.maxLength !== undefined &&
        value.length > validator.maxLength
      ) {
        throw new Error(
          `String length ${value.length} above maximum ${validator.maxLength}`,
        );
      }
      if (validator.pattern && !validator.pattern.test(value)) {
        throw new Error(
          `String "${value}" does not match pattern ${validator.pattern}`,
        );
      }
    }

    if (validator.enum && !validator.enum.includes(value)) {
      throw new Error(
        `Value "${value}" not in allowed enum: [${validator.enum.join(', ')}]`,
      );
    }

    return value;
  }

  /**
   * Register built-in transforms (sanitize, trim, lowercase, etc.).
   */
  private registerBuiltInTransforms(): void {
    this.builtInTransforms.set('sanitize', (value: unknown) =>
      sanitizeText(value),
    );
    this.builtInTransforms.set('trim', (value: unknown) =>
      typeof value === 'string' ? value.trim() : value,
    );
    this.builtInTransforms.set('lowercase', (value: unknown) =>
      typeof value === 'string' ? value.toLowerCase() : value,
    );
    this.builtInTransforms.set('uppercase', (value: unknown) =>
      typeof value === 'string' ? value.toUpperCase() : value,
    );
  }

  /**
   * Register built-in parsers (integer, price, date, etc.).
   */
  private registerBuiltInParsers(): void {
    this.builtInParsers.set('integer', (value: unknown) => {
      if (typeof value !== 'string') return null;
      const num = parseInt(value.replace(/[^\d-]/g, ''), 10);
      return isNaN(num) ? null : num;
    });

    this.builtInParsers.set('float', (value: unknown) => {
      if (typeof value !== 'string') return null;
      const num = parseFloat(
        value.replace(/[^\d.,-]/g, '').replace(',', '.'),
      );
      return isNaN(num) ? null : num;
    });

    this.builtInParsers.set('price', (value: unknown) => {
      if (typeof value !== 'string') return null;
      return validatePrice(value) ?? null;
    });

    this.builtInParsers.set('boolean', (value: unknown) => {
      if (typeof value === 'boolean') return value;
      if (typeof value !== 'string') return false;
      return ['true', '1', 'yes', 'oui'].includes(value.toLowerCase());
    });

    this.builtInParsers.set('date', (value: unknown) => {
      if (typeof value !== 'string') return null;
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    });

    this.builtInParsers.set('url', (value: unknown, context: ExtractionContext) => {
      if (typeof value !== 'string') return null;
      if (value.startsWith('http')) return value;
      if (value.startsWith('/')) return `${context.siteBaseUrl}${value}`;
      return value;
    });

    // relativeDate parser will be implemented per-site (Dealabs-specific)
    this.builtInParsers.set('relativeDate', (value: unknown) => {
      // Default: return null, site-specific transformers will override
      return null;
    });
  }
}
