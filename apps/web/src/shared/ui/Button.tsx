/**
 * Button - Reusable button component with multiple variants
 * Follows the design system from the create filter mockup
 */
import React from 'react';
import * as styles from './Button.css';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /** Button visual style variant */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Icon to display before the text */
  icon?: React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Button content */
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  children,
  className = '',
  type = 'button',
  ...props
}) => {
  const baseClass = styles.button.base;
  const variantClass = styles.button.variants[variant];
  const sizeClass = styles.button.sizes[size];
  const stateClass = disabled || loading ? styles.button.disabled : '';
  const widthClass = fullWidth ? styles.button.fullWidth : '';

  const buttonClassName =
    `${baseClass} ${variantClass} ${sizeClass} ${stateClass} ${widthClass} ${className}`.trim();

  return (
    <button
      type={type}
      className={buttonClassName}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className={styles.button.spinner} fill="none" viewBox="0 0 24 24">
          <circle
            className={styles.button.spinnerCircle}
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className={styles.button.spinnerPath}
            fill="currentColor"
            d="m12 2a10 10 0 0 1 10 10h-4a6 6 0 0 0-6-6v-4z"
          />
        </svg>
      )}
      {!loading && icon && <span className={styles.button.icon}>{icon}</span>}
      <span
        className={`${styles.button.text} ${loading ? styles.button.loadingText : ''}`.trim()}
      >
        {children}
      </span>
    </button>
  );
};

export default Button;
