/**
 * LogicalOperatorToggle Component
 * Toggle between AND/OR logical operators for rule groups
 */
import React from 'react';
import { LogicalOperator } from '@/features/filters/types/filter.types';
import * as styles from './RuleBuilder.css';

export interface LogicalOperatorToggleProps {
  value: LogicalOperator;
  onChange: (value: LogicalOperator) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const LogicalOperatorToggle: React.FC<LogicalOperatorToggleProps> = ({
  value,
  onChange,
  disabled = false,
  size = 'md',
}) => {
  if (value === 'NOT') {
    return (
      <div className={styles.logicalOperatorToggle}>
        <button
          type="button"
          className={styles.logicalOperatorButton.not}
          disabled={disabled}
        >
          NOT
        </button>
      </div>
    );
  }

  return (
    <div className={styles.logicalOperatorToggle}>
      <button
        type="button"
        className={
          value === 'AND'
            ? styles.logicalOperatorButton.active
            : styles.logicalOperatorButton.inactive
        }
        onClick={() => onChange('AND')}
        disabled={disabled}
      >
        AND
      </button>
      <button
        type="button"
        className={
          value === 'OR'
            ? styles.logicalOperatorButton.active
            : styles.logicalOperatorButton.inactive
        }
        onClick={() => onChange('OR')}
        disabled={disabled}
      >
        OR
      </button>
    </div>
  );
};
