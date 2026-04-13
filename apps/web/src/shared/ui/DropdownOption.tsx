/**
 * DropdownOption - Individual option rendering component
 * Handles rendering of single dropdown option with icon, label, description, and selection state
 */
import React from 'react';
import { clsx } from 'clsx';
import type { DropdownOptionProps } from './DropdownTypes';
import { getSafeDataCyValue } from './DropdownUtils';
import * as styles from './Dropdown.css';

export const DropdownOption: React.FC<DropdownOptionProps> = ({
  option,
  isSelected,
  isHighlighted,
  optionDataCyPrefix,
  onSelect,
  renderOption,
}) => {
  const handleClick = () => {
    if (!option.disabled) {
      onSelect(option);
    }
  };

  const renderContent = () => {
    if (renderOption) {
      return renderOption(option, isSelected, isHighlighted);
    }

    return (
      <div className={styles.optionContent}>
        {option.icon && (
          <span className={styles.optionIcon}>{option.icon}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.optionText}>{option.label}</div>
          {option.description && (
            <div className={styles.optionDescription}>
              {option.description}
            </div>
          )}
        </div>
        {isSelected && (
          <svg
            className={styles.checkIcon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </div>
    );
  };

  return (
    <button
      type="button"
      className={clsx(
        styles.dropdownOption[
          option.disabled
            ? 'disabled'
            : isSelected
              ? 'selected'
              : 'default'
        ],
        {
          backgroundColor: isHighlighted ? '#F3F4F6' : undefined,
        }
      )}
      onClick={handleClick}
      disabled={option.disabled}
      role="option"
      aria-selected={isSelected}
      data-highlighted={isHighlighted}
      data-cy={
        optionDataCyPrefix
          ? `${optionDataCyPrefix}-${getSafeDataCyValue(option.value)}`
          : undefined
      }
    >
      {renderContent()}
    </button>
  );
};

DropdownOption.displayName = 'DropdownOption';

export default DropdownOption;
