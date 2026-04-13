/**
 * DropdownMenu - Menu container component for dropdown
 * Handles rendering of search input, options list, mobile header, and loading/empty states
 */
import React from 'react';
import { clsx } from 'clsx';
import type { DropdownMenuProps } from './DropdownTypes';
import { DropdownOption } from './DropdownOption';
import * as styles from './Dropdown.css';

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  isOpen,
  isMobileView,
  placeholder,
  searchable,
  searchPlaceholder,
  searchQuery,
  loading,
  multiple,
  filteredOptions,
  filteredFlatOptions,
  highlightedIndex,
  value,
  optionDataCyPrefix,
  menuClassName,
  menuRef,
  searchInputRef,
  onSearchChange,
  onOptionSelect,
  onClose,
  renderOption,
}) => {
  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className={clsx(
        styles.dropdownMenu,
        { [styles.mobileMenu]: isMobileView },
        menuClassName
      )}
      role="listbox"
      aria-multiselectable={multiple}
    >
      {/* Mobile Header */}
      {isMobileView && (
        <div className={styles.mobileHeader}>
          <span className={styles.mobileTitle}>
            {placeholder || 'Select Option'}
          </span>
          <button
            className={styles.mobileCloseButton}
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Search Input */}
      {searchable && (
        <div className={styles.searchContainer}>
          <input
            ref={searchInputRef}
            type="text"
            className={styles.searchInput}
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={onSearchChange}
            autoComplete="off"
            aria-label="Search options"
          />
        </div>
      )}

      {/* Options */}
      <div className={styles.menuOptions}>
        {loading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner} />
            Loading options...
          </div>
        ) : filteredOptions.length === 0 ? (
          <div className={styles.emptyState}>
            {searchQuery ? 'No options found' : 'No options available'}
          </div>
        ) : (
          filteredOptions.map((group) => (
            <div key={group.id}>
              {/* Group Header */}
              {group.label && group.id !== 'default' && (
                <div className={styles.dropdownOption.group}>
                  {group.label}
                </div>
              )}

              {/* Group Options */}
              {group.options.map((option) => {
                const flatIndex = filteredFlatOptions.findIndex(
                  (opt) => opt.value === option.value
                );
                const isSelected = Array.isArray(value)
                  ? value.includes(option.value)
                  : value === option.value;
                const isHighlighted = flatIndex === highlightedIndex;

                return (
                  <DropdownOption
                    key={option.value}
                    option={option}
                    isSelected={isSelected}
                    isHighlighted={isHighlighted}
                    optionDataCyPrefix={optionDataCyPrefix}
                    onSelect={onOptionSelect}
                    renderOption={renderOption}
                  />
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

DropdownMenu.displayName = 'DropdownMenu';

export default DropdownMenu;
