/**
 * Dropdown - Custom dropdown component to replace native select elements
 * Features: search, multi-select, accessibility, loading states, responsive design
 */
import React, { forwardRef, useImperativeHandle } from 'react';
import { clsx } from 'clsx';
import * as styles from './Dropdown.css';
import { useDropdown } from '@/shared/hooks/useDropdown';
import { DropdownTrigger } from './DropdownTrigger';
import { DropdownMenu } from './DropdownMenu';
import type { DropdownProps, DropdownRef } from './DropdownTypes';
import { defaultMultipleDisplayFormat } from './DropdownUtils';

// Re-export types for backward compatibility
export type {
  DropdownOption,
  DropdownGroup,
  DropdownProps,
  DropdownRef,
} from './DropdownTypes';

export const Dropdown = forwardRef<DropdownRef, DropdownProps>(
  (
    {
      options = [],
      value,
      onChange,
      placeholder = 'Select an option...',
      disabled = false,
      error = false,
      errorMessage,
      loading = false,
      searchable = false,
      searchPlaceholder = 'Search options...',
      multiple = false,
      maxSelections,
      multipleDisplayFormat = defaultMultipleDisplayFormat,
      size = 'md',
      fullWidth = false,
      className,
      triggerClassName,
      menuClassName,
      portal,
      renderTrigger,
      renderOption,
      onOpen,
      onClose,
      onSearch,
      filterFunction,
      mobile = false,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedBy,
      'data-testid': dataTestId,
      optionDataCyPrefix,
      ...restProps
    },
    ref
  ) => {
    // Use custom hook for all dropdown logic
    const {
      isOpen,
      searchQuery,
      highlightedIndex,
      isMobileView,
      containerRef,
      triggerRef,
      menuRef,
      searchInputRef,
      openDropdown,
      closeDropdown,
      toggleDropdown,
      handleOptionSelect,
      handleKeyDown,
      handleSearchChange,
      selectedOptions,
      filteredOptions,
      filteredFlatOptions,
    } = useDropdown({
      options,
      value,
      onChange,
      multiple,
      searchable,
      disabled,
      loading,
      mobile,
      filterFunction,
      onOpen,
      onClose,
      onSearch,
      maxSelections,
    });

    // Expose methods via ref
    useImperativeHandle(
      ref,
      () => ({
        open: openDropdown,
        close: closeDropdown,
        focus: () => triggerRef.current?.focus(),
        clear: () => onChange(multiple ? [] : '', multiple ? [] : undefined),
        getSelectedOptions: () => selectedOptions,
      }),
      [openDropdown, closeDropdown, onChange, multiple, selectedOptions]
    );

    return (
      <div
        ref={containerRef}
        className={clsx(
          styles.dropdownContainer,
          { [styles.sizeVariants[size]]: size !== 'md' },
          { width: '100%' },
          className
        )}
        data-testid={dataTestId}
      >
        {/* Trigger Button */}
        <DropdownTrigger
          isOpen={isOpen}
          disabled={disabled}
          loading={loading}
          error={error}
          placeholder={placeholder}
          selectedOptions={selectedOptions}
          multiple={multiple}
          multipleDisplayFormat={multipleDisplayFormat}
          triggerClassName={triggerClassName}
          ariaLabel={ariaLabel}
          ariaDescribedBy={ariaDescribedBy}
          renderTrigger={renderTrigger}
          onClick={toggleDropdown}
          onKeyDown={handleKeyDown}
          triggerRef={triggerRef}
          restProps={restProps}
        />

        {/* Error Message */}
        {error && errorMessage && (
          <div className={styles.errorMessage}>{errorMessage}</div>
        )}

        {/* Dropdown Menu */}
        <DropdownMenu
          isOpen={isOpen}
          isMobileView={isMobileView}
          placeholder={placeholder}
          searchable={searchable}
          searchPlaceholder={searchPlaceholder}
          searchQuery={searchQuery}
          loading={loading}
          multiple={multiple}
          filteredOptions={filteredOptions}
          filteredFlatOptions={filteredFlatOptions}
          highlightedIndex={highlightedIndex}
          value={value}
          optionDataCyPrefix={optionDataCyPrefix}
          menuClassName={menuClassName}
          menuRef={menuRef}
          searchInputRef={searchInputRef}
          onSearchChange={handleSearchChange}
          onOptionSelect={handleOptionSelect}
          onClose={closeDropdown}
          renderOption={renderOption}
        />
      </div>
    );
  }
);

Dropdown.displayName = 'Dropdown';

export default Dropdown;
