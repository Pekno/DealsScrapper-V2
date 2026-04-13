/**
 * Operator icon helpers for the RuleBuilder
 * Provides icons and utilities for filter operators
 */
import React from 'react';
import { FilterOperator } from '@/features/filters/types/filter.types';

/**
 * Converts operator keys to CSS-safe data-cy identifiers
 * Special characters like <, >, =, ! are replaced with safe alternatives
 */
export const getOperatorDataCyKey = (operatorKey: FilterOperator): string => {
  // Map of problematic operator keys to CSS-safe alternatives
  const operatorKeyMap: Record<string, string> = {
    '<': 'lt',
    '>': 'gt',
    '<=': 'lte',
    '>=': 'gte',
    '=': 'eq',
    '!=': 'neq',
  };

  return operatorKeyMap[operatorKey] || operatorKey;
};

/**
 * Helper function to get operator icons
 */
export const getOperatorIcon = (operatorKey: FilterOperator): React.ReactNode => {
  switch (operatorKey) {
    case '=':
    case 'EQUALS':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>='</span>;
    case '!=':
    case 'NOT_EQUALS':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>≠</span>;
    case '>':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>&gt;</span>;
    case '>=':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>≥</span>;
    case '<':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>&lt;</span>;
    case '<=':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>≤</span>;
    case 'BETWEEN':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>↔</span>;
    case 'CONTAINS':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>⊃</span>;
    case 'NOT_CONTAINS':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>⊅</span>;
    case 'STARTS_WITH':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>▶</span>;
    case 'ENDS_WITH':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>◀</span>;
    case 'REGEX':
      return <span style={{ fontSize: '12px', fontWeight: 'bold' }}>.*</span>;
    case 'NOT_REGEX':
      return <span style={{ fontSize: '12px', fontWeight: 'bold' }}>!.*</span>;
    case 'IN':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>∈</span>;
    case 'NOT_IN':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>∉</span>;
    case 'INCLUDES_ANY':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>∪</span>;
    case 'INCLUDES_ALL':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>∩</span>;
    case 'IS_TRUE':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>✓</span>;
    case 'IS_FALSE':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>✗</span>;
    case 'BEFORE':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>←</span>;
    case 'AFTER':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>→</span>;
    case 'OLDER_THAN':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>⟵</span>;
    case 'NEWER_THAN':
      return <span style={{ fontSize: '14px', fontWeight: 'bold' }}>⟶</span>;
    default:
      return (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      );
  }
};
