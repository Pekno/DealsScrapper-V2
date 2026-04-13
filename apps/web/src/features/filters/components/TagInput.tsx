/**
 * TagInput - Multi-value tag input component
 * Allows adding multiple values with validation and formatting
 */
import React, { useState, useRef, useCallback } from 'react';
import { TagInputProps } from './ValueInputTypes';
import * as styles from './RuleValueInput.css';

/**
 * TagInput component for entering multiple values
 * Supports comma/enter separation, validation, and value formatting
 */
export const TagInput: React.FC<TagInputProps> = ({
  values,
  onChange,
  placeholder,
  disabled,
  validation,
  validationMessage,
  formatValue,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addValue = useCallback(
    (value: string) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) return;

      // Check for duplicates
      if (values.includes(trimmedValue)) {
        setError('This value has already been added');
        return;
      }

      // Validate value if validation function provided
      if (validation && !validation(trimmedValue)) {
        setError(validationMessage || 'Please enter a valid value');
        return;
      }

      const formattedValue = formatValue
        ? formatValue(trimmedValue)
        : trimmedValue;
      onChange([...values, formattedValue]);
      setInputValue('');
      setError('');
    },
    [values, onChange, validation, validationMessage, formatValue]
  );

  const removeValue = useCallback(
    (index: number) => {
      const newValues = values.filter((_, i) => i !== index);
      onChange(newValues);
    },
    [values, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addValue(inputValue);
      } else if (e.key === 'Backspace' && !inputValue && values.length > 0) {
        removeValue(values.length - 1);
      }
    },
    [inputValue, addValue, removeValue, values]
  );

  const handleBlur = useCallback(() => {
    if (inputValue.trim()) {
      addValue(inputValue);
    }
  }, [inputValue, addValue]);

  return (
    <div className={styles.tagInput.container}>
      <div className={`${styles.tagInput.wrapper}${error ? ` ${styles.states.error}` : ''}`}>
        {values.map((value, index) => (
          <div key={`${value}-${index}`} className={styles.tagInput.tag}>
            <span className={styles.tagInput.tagText}>{value}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeValue(index)}
                className={styles.tagInput.tagRemove}
                aria-label={`Remove ${value}`}
              >
                ×
              </button>
            )}
          </div>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError('');
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={values.length === 0 ? placeholder : ''}
          disabled={disabled}
          className={styles.tagInput.input}
          aria-label="Add new value"
        />
      </div>

      {error && (
        <div className={styles.tagInput.error} role="alert">
          {error}
        </div>
      )}

      <div className={styles.tagInput.hint}>
        Press Enter or comma to add values
      </div>
    </div>
  );
};

export default TagInput;
