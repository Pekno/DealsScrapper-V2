import { RuleBasedFilterExpression } from '@dealscrapper/shared-types';

// Use the modern rule-based system as the main FilterExpressionInput
export type FilterExpressionInput = RuleBasedFilterExpression;

// Digest frequency for notifications
export type DigestFrequency = 'hourly' | 'daily' | 'weekly' | 'disabled';
