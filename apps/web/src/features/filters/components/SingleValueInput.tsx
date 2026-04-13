/**
 * SingleValueInput - Single value input component
 * Adapts to field type (text, number, date) with contextual hints
 */
import React, { useMemo, useCallback } from 'react';
import { SingleValueInputProps } from './ValueInputTypes';
import { FIELD_DEFINITIONS } from '@/features/filters/types/filter.types';
import { Input } from '@/shared/ui/Input';
import * as styles from './RuleValueInput.css';
import { getRightIconForField } from './ValueInputUtils';

/**
 * SingleValueInput component for single value inputs
 * Provides type-specific input fields with contextual hints
 */
export const SingleValueInput: React.FC<SingleValueInputProps> = ({
  value,
  onChange,
  field,
  operator,
  placeholder,
  disabled = false,
  autoFocus = false,
  className = '',
}) => {
  const fieldDefinition = useMemo(() => {
    return FIELD_DEFINITIONS.find((f) => f.key === field);
  }, [field]);

  // Calculate input props based on field type
  const inputProps = useMemo(() => {
    if (!fieldDefinition) return { type: 'text' as const };

    switch (fieldDefinition.type) {
      case 'number':
        const numberProps = {
          type: 'number' as const,
          step: 'any' as const,
          min: undefined as number | undefined,
          max: undefined as number | undefined,
        };

        if (fieldDefinition.key === 'price') {
          return { ...numberProps, step: '0.01' };
        }

        if (fieldDefinition.key === 'discountPercentage') {
          return { ...numberProps, min: 0, max: 100, step: '0.1' };
        }

        if (fieldDefinition.key === 'temperature') {
          return { ...numberProps, step: '1' };
        }

        return numberProps;

      case 'date':
        return { type: 'datetime-local' as const };

      default:
        return { type: 'text' as const };
    }
  }, [fieldDefinition]);

  // Get right icon for the field
  const rightIcon = useMemo(() => {
    return getRightIconForField(field);
  }, [field]);

  // Render contextual hints based on field and operator
  const renderHints = useCallback(() => {
    if (!fieldDefinition || disabled) return null;

    const hints = [];

    if (fieldDefinition.type === 'date' && operator === 'OLDER_THAN') {
      hints.push('Enter number of hours');
    }

    if (fieldDefinition.type === 'date' && operator === 'NEWER_THAN') {
      hints.push('Enter number of hours');
    }

    if (fieldDefinition.key === 'temperature') {
      hints.push('Temperature ranges from -∞ to +∞ (higher = hotter deal)');
    }

    if (fieldDefinition.key === 'price') {
      hints.push('Price in euros (e.g., 29.99)');
    }

    if (hints.length === 0) return null;

    return (
      <div className={styles.hint.container}>
        {hints.map((hint, index) => (
          <div key={index} className={styles.hint.text}>
            {hint}
          </div>
        ))}
      </div>
    );
  }, [fieldDefinition, operator, disabled]);

  return (
    <div className={`${styles.singleInput.container} ${className}`}>
      <Input
        {...inputProps}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        rightIcon={rightIcon}
        aria-label={`Enter value for ${fieldDefinition?.label}`}
      />

      {renderHints()}
    </div>
  );
};

export default SingleValueInput;
