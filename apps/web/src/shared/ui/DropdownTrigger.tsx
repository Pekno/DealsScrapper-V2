/**
 * DropdownTrigger - Trigger button component for dropdown
 * Displays selected options, loading state, and chevron icon
 */
import React from 'react';
import { clsx } from 'clsx';
import type { DropdownTriggerProps } from './DropdownTypes';
import * as styles from './Dropdown.css';

export const DropdownTrigger: React.FC<DropdownTriggerProps> = ({
  isOpen,
  disabled,
  loading,
  error,
  placeholder,
  selectedOptions,
  multiple,
  multipleDisplayFormat,
  triggerClassName,
  ariaLabel,
  ariaDescribedBy,
  renderTrigger,
  onClick,
  onKeyDown,
  triggerRef,
  restProps = {},
}) => {
  const getTriggerVariant = () => {
    if (disabled) return 'disabled';
    if (error) return 'error';
    if (isOpen) return 'open';
    return 'default';
  };

  const renderTriggerContent = () => {
    if (renderTrigger) {
      return renderTrigger({
        isOpen,
        selectedOptions,
        placeholder,
        disabled,
      });
    }

    if (loading) {
      return (
        <>
          <div className={styles.loadingSpinner} />
          <span className={styles.triggerText}>Loading...</span>
        </>
      );
    }

    if (selectedOptions.length === 0) {
      return (
        <span className={clsx(styles.triggerText, styles.triggerPlaceholder)}>
          {placeholder}
        </span>
      );
    }

    if (multiple) {
      const displayText = multipleDisplayFormat(
        selectedOptions.length,
        selectedOptions
      );
      return (
        <div className={styles.multiSelectContainer}>
          <span className={styles.triggerText}>{displayText}</span>
        </div>
      );
    }

    const selectedOption = selectedOptions[0];
    return (
      <div className={styles.triggerContent}>
        {selectedOption.icon && (
          <span className={styles.triggerIcon}>{selectedOption.icon}</span>
        )}
        <span className={styles.triggerText}>{selectedOption.label}</span>
      </div>
    );
  };

  const ChevronIcon = () => (
    <svg
      className={clsx(styles.chevronIcon, { [styles.chevronOpen]: isOpen })}
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
    <button
      ref={triggerRef}
      type="button"
      className={clsx(
        styles.dropdownTrigger[getTriggerVariant()],
        triggerClassName
      )}
      onClick={onClick}
      onKeyDown={onKeyDown}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      role="combobox"
      {...restProps}
    >
      <div className={styles.triggerContent}>{renderTriggerContent()}</div>
      <ChevronIcon />
    </button>
  );
};

DropdownTrigger.displayName = 'DropdownTrigger';

export default DropdownTrigger;
