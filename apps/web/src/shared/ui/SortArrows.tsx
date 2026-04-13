/**
 * SortArrows - SVG arrow components for table sorting
 * Based on the chevron icons used in NumberInput and Dropdown components
 */
import React from 'react';
import * as tableStyles from '@/features/filters/components/MatchesTable.css';

/**
 * Arrow Up SVG icon for ascending sort
 */
export const ArrowUpIcon: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    className={className}
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
 * Arrow Down SVG icon for descending sort
 */
export const ArrowDownIcon: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    className={className}
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
 * Combined sort arrows component showing both up and down arrows
 */
export interface SortArrowsProps {
  /** Current sort field */
  field: string;
  /** Active sort field */
  activeField: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

export const SortArrows: React.FC<SortArrowsProps> = ({
  field,
  activeField,
  direction,
}) => {
  const isActive = activeField === field;
  const isAsc = isActive && direction === 'asc';
  const isDesc = isActive && direction === 'desc';

  return (
    <span className={tableStyles.sortIndicator}>
      <span className={tableStyles.sortIconNeutral}>
        <ArrowUpIcon
          className={`${tableStyles.sortArrowUp} ${
            isAsc ? tableStyles.sortArrowActive : ''
          }`}
        />
        <ArrowDownIcon
          className={`${tableStyles.sortArrowDown} ${
            isDesc ? tableStyles.sortArrowActive : ''
          }`}
        />
      </span>
    </span>
  );
};

export default SortArrows;
