/**
 * FormField - Wrapper for form inputs with labels and validation
 * Provides consistent styling and layout for all form elements
 */
import React, { useId } from 'react';
import * as styles from './FormField.css';

export interface FormFieldProps {
  /** Field label text */
  label: string;
  /** Form field content (input, select, etc.) */
  children: React.ReactNode;
  /** Whether the field is required */
  required?: boolean;
  /** Error message to display */
  error?: string;
  /** Optional description or help text */
  description?: string;
  /** Additional class name */
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  children,
  required = false,
  error,
  description,
  className = '',
}) => {
  const reactId = useId();
  const fieldId = `field-${reactId}`;
  const hasError = !!error;

  const containerClass = [
    styles.formField.container,
    hasError && styles.formField.errorContainer,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClass}>
      <label htmlFor={fieldId} className={styles.formField.label}>
        {label}
        {required && (
          <span className={styles.formField.required} aria-label="required">
            *
          </span>
        )}
      </label>

      {description && (
        <p className={styles.formField.description}>{description}</p>
      )}

      <div className={styles.formField.inputWrapper}>
        {React.isValidElement(children)
          ? React.cloneElement(children, {
              id: fieldId,
              'aria-invalid': hasError,
              'aria-describedby': error ? `${fieldId}-error` : undefined,
            } as React.HTMLAttributes<HTMLElement>)
          : children}
      </div>

      {error && (
        <div
          id={`${fieldId}-error`}
          className={styles.formField.errorText}
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default FormField;
