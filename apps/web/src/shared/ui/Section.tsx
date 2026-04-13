/**
 * Section Component - Reusable section with header and content
 * Used across multiple pages to ensure consistent design and styling
 */
import React, { useState } from 'react';
import { clsx } from 'clsx';
import * as styles from './Section.css';
import { dataCy } from '@/shared/lib/test-utils';

export interface SectionProps {
  /** Optional icon to display in the section header */
  icon?: React.ReactNode;
  /** Section title displayed in the header */
  title: string;
  /** Content to display within the section */
  children: React.ReactNode;
  /** Additional CSS classes to apply to the section */
  className?: string;
  /** Whether this section is collapsible */
  collapsible?: boolean;
  /** Default collapsed state (only applies if collapsible is true) */
  defaultCollapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapseChange?: (collapsed: boolean) => void;
  /** Optional test ID for the section header (for Cypress testing) */
  testId?: string;
}

/**
 * Section component that provides a consistent design pattern for content sections
 *
 * Features:
 * - Section header with optional icon and title
 * - Section content area with proper padding
 * - White background, rounded corners, border, shadow
 * - Responsive design for mobile/tablet/desktop
 * - Optional collapsible functionality with smooth animations
 * - Based on the CreateFilterForm section design pattern
 */
export const Section: React.FC<SectionProps> = ({
  icon,
  title,
  children,
  className,
  collapsible = false,
  defaultCollapsed = false,
  onCollapseChange,
  testId,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const handleToggle = () => {
    if (!collapsible) return;

    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    onCollapseChange?.(newCollapsedState);
  };

  // Chevron icon for collapsible sections
  const ChevronIcon = () => (
    <svg
      className={clsx(styles.chevronIcon, {
        [styles.chevronCollapsed]: isCollapsed,
      })}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );

  return (
    <div className={clsx(styles.section, className)}>
      {/* Section Header */}
      <div
        className={clsx(styles.sectionHeader, {
          [styles.sectionHeaderClickable]: collapsible,
        })}
        onClick={handleToggle}
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle();
                }
              }
            : undefined
        }
        aria-expanded={collapsible ? !isCollapsed : undefined}
        aria-label={
          collapsible
            ? `${isCollapsed ? 'Expand' : 'Collapse'} ${title} section`
            : undefined
        }
        {...(testId && dataCy(`${testId}-header`))}
      >
        {icon && <div className={styles.sectionIcon}>{icon}</div>}
        <h3 className={styles.sectionTitle}>{title}</h3>
        {collapsible && <ChevronIcon />}
      </div>

      {/* Section Content */}
      {(!collapsible || !isCollapsed) && (
        <div className={styles.sectionContent}>{children}</div>
      )}
    </div>
  );
};

export default Section;
