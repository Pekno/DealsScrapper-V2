/**
 * NumberRangeInput - Number range input component
 * Provides two number inputs for selecting numeric ranges
 * Supports different field types (price, percentage, number)
 */
import React, { useCallback } from 'react';
import { NumberRangeInputProps } from './ValueInputTypes';
import { Input } from '@/shared/ui/Input';
import * as styles from './RuleValueInput.css';

/**
 * NumberRangeInput component for selecting numeric ranges
 * Adapts input properties based on field type (price, percentage, number)
 */
export const NumberRangeInput: React.FC<NumberRangeInputProps> = ({
  values,
  onChange,
  disabled,
  labels = ['Min', 'Max'],
  fieldType = 'number',
  min,
  max,
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

  const getInputProps = () => {
    const baseProps = {
      type: 'number' as const,
      step: fieldType === 'percentage' ? '0.01' : '0.01',
      min,
      max,
      disabled,
    };

    if (fieldType === 'price') {
      return { ...baseProps, step: '0.01' };
    }

    if (fieldType === 'percentage') {
      return { ...baseProps, min: 0, max: 100, step: '0.1' };
    }

    return baseProps;
  };

  const getIcon = () => {
    if (fieldType === 'price') return '€';
    if (fieldType === 'percentage') return '%';
    return undefined;
  };

  return (
    <div className={styles.numberRange.container}>
      <div className={styles.numberRange.field}>
        <Input
          {...getInputProps()}
          value={values[0]}
          onChange={handleFromChange}
          label={labels[0]}
          rightIcon={getIcon()}
          size="sm"
        />
      </div>
      <div className={styles.numberRange.separator}>to</div>
      <div className={styles.numberRange.field}>
        <Input
          {...getInputProps()}
          value={values[1]}
          onChange={handleToChange}
          label={labels[1]}
          rightIcon={getIcon()}
          size="sm"
        />
      </div>
    </div>
  );
};

export default NumberRangeInput;
