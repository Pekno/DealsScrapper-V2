/**
 * Input - Form input component with validation states and icons
 * Follows the design system from the create filter mockup
 */
import React, { forwardRef } from 'react';
import * as styles from './Input.css';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input label */
  label?: string;
  /** Input placeholder text */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Icon to display before the input */
  icon?: React.ReactNode;
  /** Icon to display after the input */
  rightIcon?: React.ReactNode;
  /** Input size */
  size?: 'sm' | 'md' | 'lg';
  /** Full width input */
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      placeholder,
      required = false,
      error,
      icon,
      rightIcon,
      size = 'md',
      fullWidth = false,
      className = '',
      type = 'text',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;

    const containerClass = [
      styles.input.container,
      fullWidth && styles.input.fullWidth,
      hasError && styles.input.errorContainer,
    ]
      .filter(Boolean)
      .join(' ');

    const inputClass = [
      styles.input.base,
      styles.input.sizes[size],
      icon && styles.input.withLeftIcon,
      rightIcon && styles.input.withRightIcon,
      hasError && styles.input.error,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={containerClass}>
        {label && (
          <label htmlFor={inputId} className={styles.input.label}>
            {label}
            {required && (
              <span className={styles.input.required} aria-label="required">
                *
              </span>
            )}
          </label>
        )}

        <div className={styles.input.wrapper}>
          {icon && <div className={styles.input.leftIcon}>{icon}</div>}

          <input
            ref={ref}
            id={inputId}
            type={type}
            placeholder={placeholder}
            className={inputClass}
            aria-invalid={hasError}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />

          {rightIcon && (
            <div className={styles.input.rightIcon}>{rightIcon}</div>
          )}
        </div>

        {error && (
          <div
            id={`${inputId}-error`}
            className={styles.input.errorText}
            role="alert"
          >
            {error}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
