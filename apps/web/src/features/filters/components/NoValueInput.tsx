/**
 * NoValueInput - Display component for operators that don't need values
 * Shows a message indicating no value input is required
 */
import React from 'react';
import { NoValueInputProps } from './ValueInputTypes';
import * as styles from './RuleValueInput.css';

/**
 * NoValueInput component for operators that don't require values
 * (e.g., IS_EMPTY, IS_NOT_EMPTY)
 */
export const NoValueInput: React.FC<NoValueInputProps> = ({
  operatorLabel,
  className = '',
}) => {
  return (
    <div className={`${styles.noInput.container} ${className}`}>
      <div className={styles.noInput.message}>
        No additional value needed for &ldquo;{operatorLabel}&rdquo;
      </div>
    </div>
  );
};

export default NoValueInput;
