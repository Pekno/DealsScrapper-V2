/**
 * RefreshIcon - Professional spinning refresh/reload icon
 * Beautiful SVG with smooth animation for scraping status
 */
import React from 'react';
import * as styles from './RefreshIcon.css';

export interface RefreshIconProps {
  /** Whether the icon should spin */
  spinning?: boolean;
  /** Icon size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Icon color */
  color?: string;
}

/**
 * Professional refresh icon with spinning animation
 * Uses beautiful circular arrows SVG design
 */
export const RefreshIcon: React.FC<RefreshIconProps> = ({
  spinning = false,
  size = 'md',
  className = '',
  color = 'currentColor',
}) => {
  const iconClasses = [
    styles.refreshIcon.base,
    styles.refreshIcon.sizes[size],
    spinning ? styles.refreshIcon.spinning : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      className={iconClasses}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke={color}
      aria-hidden="true"
    >
      {/* Refresh/reload icon with circular arrows */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
};

export default RefreshIcon;
