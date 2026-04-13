/**
 * Utility functions for Dropdown component
 */

import type { DropdownOption, DropdownGroup } from './DropdownTypes';

/**
 * Escapes special characters in a string for use in a regular expression
 */
export const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Converts option values to CSS-safe data-cy identifiers
 * Special characters like <, >, =, ! are replaced with safe alternatives
 */
export const getSafeDataCyValue = (value: string): string => {
  // Map of problematic characters to CSS-safe alternatives
  // IMPORTANT: Multi-character operators MUST be processed before single-character ones
  const charMap: Record<string, string> = {
    // Multi-character operators FIRST (to avoid partial replacements)
    '<=': 'lte',
    '>=': 'gte',
    '!=': 'neq',
    // Single-character operators AFTER
    '<': 'lt',
    '>': 'gt',
    '=': 'eq',
    '!': 'not',
    '&': 'and',
    '|': 'or',
    ' ': '-',
    '(': 'open',
    ')': 'close',
    '[': 'bracket-open',
    ']': 'bracket-close',
    '{': 'brace-open',
    '}': 'brace-close',
    '/': 'slash',
    '\\': 'backslash',
    '%': 'percent',
    '#': 'hash',
    '@': 'at',
    '$': 'dollar',
    '+': 'plus',
    '*': 'star',
    '?': 'question',
    '^': 'caret',
    '~': 'tilde',
    '`': 'backtick',
    '"': 'quote',
    "'": 'apostrophe',
    ':': 'colon',
    ';': 'semicolon',
    ',': 'comma',
    '.': 'dot',
  };

  // Replace problematic characters with safe alternatives
  // Process in order: multi-character first, then single-character
  let safeValue = value;
  for (const [char, replacement] of Object.entries(charMap)) {
    safeValue = safeValue.replace(new RegExp(escapeRegExp(char), 'g'), replacement);
  }

  return safeValue;
};

/**
 * Default filter function for search
 */
export const defaultFilterFunction = (
  option: DropdownOption,
  query: string
): boolean => {
  const searchQuery = query.toLowerCase();
  return (
    option.label.toLowerCase().includes(searchQuery) ||
    (option.description?.toLowerCase().includes(searchQuery) ?? false)
  );
};

/**
 * Default multiple display format
 */
export const defaultMultipleDisplayFormat = (
  count: number,
  options: DropdownOption[]
): string => {
  if (count === 0) return '';
  if (count === 1) return options[0].label;
  return `${count} items selected`;
};

/**
 * Helper function to flatten grouped options
 */
export const flattenOptions = (
  options: DropdownOption[] | DropdownGroup[]
): DropdownOption[] => {
  if (!options.length) return [];

  // Check if first item has 'options' property (indicates grouped options)
  if ('options' in options[0]) {
    return (options as DropdownGroup[]).flatMap((group) => group.options);
  }

  return options as DropdownOption[];
};

/**
 * Helper function to normalize options into grouped format
 */
export const normalizeOptions = (
  options: DropdownOption[] | DropdownGroup[]
): DropdownGroup[] => {
  if (!options.length) return [];

  // Check if already grouped
  if ('options' in options[0]) {
    return options as DropdownGroup[];
  }

  // Group ungrouped options by their group property or put in default group
  const optionsArray = options as DropdownOption[];
  const grouped = optionsArray.reduce(
    (acc, option) => {
      const groupId = option.group || 'default';
      const groupLabel = option.group || '';

      if (!acc[groupId]) {
        acc[groupId] = { id: groupId, label: groupLabel, options: [] };
      }
      acc[groupId].options.push(option);
      return acc;
    },
    {} as Record<string, DropdownGroup>
  );

  return Object.values(grouped);
};
