/**
 * NumberInput - Custom number input with styled increment/decrement buttons
 * Replaces ugly browser default number input arrows with beautiful custom SVG buttons
 * Follows the design system from the create filter mockup
 */
import React, { useCallback, useRef, useState, useEffect } from 'react';
import * as styles from './NumberInput.css';

export interface NumberInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'type' | 'onChange' | 'value' | 'size'
  > {
  /** Current numeric value */
  value?: number | string;
  /** Callback when value changes */
  onChange?: (value: number | string) => void;
  /** Input label */
  label?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Input size */
  size?: 'sm' | 'md' | 'lg';
  /** Full width input */
  fullWidth?: boolean;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Step increment for buttons */
  step?: number;
  /** Number of decimal places */
  precision?: number;
  /** Custom increment icon */
  incrementIcon?: React.ReactNode;
  /** Custom decrement icon */
  decrementIcon?: React.ReactNode;
  /** Disable increment/decrement buttons */
  disableButtons?: boolean;
  /** Show buttons on hover only */
  showButtonsOnHover?: boolean;
}

/**
 * Default increment icon (chevron up)
 */
const DefaultIncrementIcon: React.FC = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 15l7-7 7 7"
    />
  </svg>
);

/**
 * Default decrement icon (chevron down)
 */
const DefaultDecrementIcon: React.FC = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

/**
 * Format number as integer (no decimals)
 */
const formatNumber = (value: number): string => {
  return Math.round(value).toString();
};

/**
 * Parse string to number with validation
 */
const parseNumber = (value: string): number | null => {
  if (value === '' || value === '-') return null;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? null : parsed;
};

export const NumberInput: React.FC<NumberInputProps> = ({
  value = '',
  onChange,
  label,
  required = false,
  error,
  size = 'md',
  fullWidth = false,
  min = -Infinity,
  max = Infinity,
  step = 1,
  precision,
  incrementIcon,
  decrementIcon,
  disableButtons = false,
  showButtonsOnHover = false,
  className = '',
  disabled = false,
  placeholder = '',
  id,
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const inputId =
    id || `number-input-${Math.random().toString(36).substr(2, 9)}`;
  const hasError = !!error;

  // Convert value to string for input
  const stringValue =
    typeof value === 'number'
      ? formatNumber(value)
      : value.toString();

  /**
   * Handle input change with validation
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty string and minus sign for negative numbers
      if (inputValue === '' || inputValue === '-') {
        onChange?.(inputValue);
        return;
      }

      const numericValue = parseNumber(inputValue);
      if (numericValue !== null) {
        // Clamp to min/max and round to integer
        const clampedValue = Math.max(min, Math.min(max, numericValue));
        const finalValue = Math.round(clampedValue);

        onChange?.(finalValue);
      } else {
        // Invalid input, revert to previous value or empty
        onChange?.(stringValue);
      }
    },
    [onChange, min, max, stringValue]
  );

  /**
   * Handle increment button click
   */
  const handleIncrement = useCallback(() => {
    if (disabled || disableButtons) return;

    const currentValue =
      typeof value === 'number' ? value : parseNumber(stringValue) || 0;
    const newValue = Math.min(max, currentValue + step);
    const finalValue = Math.round(newValue);

    onChange?.(finalValue);
    inputRef.current?.focus();
  }, [
    value,
    stringValue,
    step,
    max,
    onChange,
    disabled,
    disableButtons,
  ]);

  /**
   * Handle decrement button click
   */
  const handleDecrement = useCallback(() => {
    if (disabled || disableButtons) return;

    const currentValue =
      typeof value === 'number' ? value : parseNumber(stringValue) || 0;
    const newValue = Math.max(min, currentValue - step);
    const finalValue = Math.round(newValue);

    onChange?.(finalValue);
    inputRef.current?.focus();
  }, [
    value,
    stringValue,
    step,
    min,
    onChange,
    disabled,
    disableButtons,
  ]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          handleIncrement();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleDecrement();
          break;
        default:
          break;
      }

      // Call original onKeyDown if provided
      props.onKeyDown?.(e);
    },
    [handleIncrement, handleDecrement, disabled, props.onKeyDown]
  );

  // Determine if buttons should be visible
  const showButtons =
    !disableButtons && (!showButtonsOnHover || hovered || focused);
  const canIncrement =
    !disabled &&
    !disableButtons &&
    (typeof value === 'number'
      ? value < max
      : parseNumber(stringValue) !== null && parseNumber(stringValue)! < max);
  const canDecrement =
    !disabled &&
    !disableButtons &&
    (typeof value === 'number'
      ? value > min
      : parseNumber(stringValue) !== null && parseNumber(stringValue)! > min);

  // Build CSS classes
  const containerClass = [
    styles.numberInput.container,
    fullWidth && styles.numberInput.fullWidth,
    hasError && styles.numberInput.errorContainer,
  ]
    .filter(Boolean)
    .join(' ');

  const wrapperClass = [
    styles.numberInput.wrapper,
    styles.numberInput.sizes[size],
    hasError && styles.numberInput.error,
    disabled && styles.numberInput.disabled,
    focused && styles.numberInput.focused,
    showButtons && styles.numberInput.withButtons,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClass}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label && (
        <label htmlFor={inputId} className={styles.numberInput.label}>
          {label}
          {required && (
            <span className={styles.numberInput.required} aria-label="required">
              *
            </span>
          )}
        </label>
      )}

      <div className={wrapperClass}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          pattern="^-?[0-9]+$"
          step={step}
          min={min !== -Infinity ? min : undefined}
          max={max !== Infinity ? max : undefined}
          value={stringValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={styles.numberInput.input}
          aria-invalid={hasError}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />

        {showButtons && (
          <div className={styles.numberInput.buttonGroup}>
            <button
              type="button"
              className={`${styles.numberInput.button} ${canIncrement ? styles.numberInput.buttonEnabled : styles.numberInput.buttonDisabled}`}
              onClick={handleIncrement}
              disabled={!canIncrement}
              aria-label="Increase value"
              tabIndex={-1}
            >
              {incrementIcon || <DefaultIncrementIcon />}
            </button>

            <button
              type="button"
              className={`${styles.numberInput.button} ${canDecrement ? styles.numberInput.buttonEnabled : styles.numberInput.buttonDisabled}`}
              onClick={handleDecrement}
              disabled={!canDecrement}
              aria-label="Decrease value"
              tabIndex={-1}
            >
              {decrementIcon || <DefaultDecrementIcon />}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          id={`${inputId}-error`}
          className={styles.numberInput.errorText}
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default NumberInput;
