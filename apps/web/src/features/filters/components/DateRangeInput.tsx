/**
 * DateRangeInput - Date range picker component
 * Provides two datetime-local inputs for selecting date ranges
 */
import React, { useCallback } from 'react';
import { DateRangeInputProps } from './ValueInputTypes';
import { Input } from '@/shared/ui/Input';
import * as styles from './RuleValueInput.css';

/**
 * DateRangeInput component for selecting date ranges
 * Uses native datetime-local inputs for better accessibility
 */
export const DateRangeInput: React.FC<DateRangeInputProps> = ({
  values,
  onChange,
  disabled,
  labels = ['From', 'To'],
}) => {
  const handleFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange([e.target.value, values[1]]);
    },
    [values, onChange]
  );

  const handleToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange([values[0], e.target.value]);
    },
    [values, onChange]
  );

  return (
    <div className={styles.dateRange.container}>
      <div className={styles.dateRange.field}>
        <Input
          type="datetime-local"
          value={values[0]}
          onChange={handleFromChange}
          disabled={disabled}
          label={labels[0]}
          size="sm"
        />
      </div>
      <div className={styles.dateRange.separator}>to</div>
      <div className={styles.dateRange.field}>
        <Input
          type="datetime-local"
          value={values[1]}
          onChange={handleToChange}
          disabled={disabled}
          label={labels[1]}
          size="sm"
        />
      </div>
    </div>
  );
};

export default DateRangeInput;
