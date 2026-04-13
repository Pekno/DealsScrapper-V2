/**
 * CategorySelector - Category search and multi-select component
 * Allows users to search for and select multiple categories with pills display
 */
import React, { useState, useRef, useEffect } from 'react';
import Badge from '@/shared/ui/Badge';
import type { Category } from '@/features/filters/types/filter.types';
import { getCategoryColorById } from '@/features/filters/components/CategoryTags';
import * as styles from './CategorySelector.css';
import { dataCy } from '@/shared/lib/test-utils';
import { useCategorySearch } from '@/features/filters/hooks/useCategorySearch';
import { useSiteRegistry } from '@/shared/hooks/useSiteRegistry';
import type { SiteSource } from '@dealscrapper/shared-types';

export interface CategorySelectorProps {
  /** Currently selected categories */
  selectedCategories: Category[];
  /** Callback when a category is added */
  onCategoryAdd: (category: Category) => void;
  /** Callback when a category is removed */
  onCategoryRemove: (categoryId: string) => void;
  /** Current search value */
  searchValue: string;
  /** Callback when search value changes */
  onSearchChange: (value: string) => void;
  /** Enabled site sources to filter categories by */
  enabledSites: string[];
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Maximum number of categories that can be selected */
  maxSelections?: number;
}

// Search icon component
const SearchIcon: React.FC = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

// Site color indicator component
interface SiteIndicatorProps {
  siteId: SiteSource | string;
  getSiteById: (id: SiteSource) => { color: string } | undefined;
}

const SiteIndicator: React.FC<SiteIndicatorProps> = ({
  siteId,
  getSiteById,
}) => {
  const siteInfo = getSiteById(siteId as SiteSource);
  const color = siteInfo?.color ?? '#9CA3AF'; // Default gray if site not found

  return (
    <span
      className={styles.categorySelector.siteIndicator}
      style={{ backgroundColor: color }}
      aria-label={`Site: ${siteId}`}
    />
  );
};

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategories = [],
  onCategoryAdd,
  onCategoryRemove,
  searchValue,
  onSearchChange,
  enabledSites,
  disabled = false,
  placeholder = 'Search for categories...',
  maxSelections,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownItemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Get site registry for color lookup
  const { getSiteById } = useSiteRegistry();

  // Use custom hook for category search - filtered by enabled sites
  const {
    data: searchResults,
    loading,
    error: searchError,
  } = useCategorySearch(searchValue, enabledSites);

  // Filter out already selected categories and non-selectable categories (Level 0)
  const filteredResults = searchResults.filter(
    (category) =>
      category.isSelectable &&
      !selectedCategories.some((selected) => selected.id === category.id)
  );

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll focused item into view when focusedIndex changes
  useEffect(() => {
    if (focusedIndex >= 0 && dropdownItemsRef.current[focusedIndex]) {
      dropdownItemsRef.current[focusedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [focusedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle ArrowDown when dropdown is closed - open dropdown and set first item focused
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
        setFocusedIndex(0);
        e.preventDefault();
      }
      return;
    }

    // Handle keyboard navigation when dropdown is open
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) =>
          prev < filteredResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredResults.length) {
          handleCategorySelect(filteredResults[focusedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleCategorySelect = (category: Category) => {
    // Close dropdown immediately to prevent additional clicks
    setIsOpen(false);
    setFocusedIndex(-1);

    if (maxSelections && selectedCategories.length >= maxSelections) {
      return; // Don't add if max selections reached
    }

    // Check if category is already selected to prevent duplicates
    const isAlreadySelected = selectedCategories.some(
      (selected) => selected.id === category.id
    );

    if (isAlreadySelected) {
      return; // Don't add if already selected
    }

    onCategoryAdd(category);
    onSearchChange('');
    inputRef.current?.focus();
  };

  const handleSearchFocus = () => {
    setIsOpen(true);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
    setIsOpen(true);
    setFocusedIndex(-1);
  };

  const isMaxSelectionsReached =
    maxSelections && selectedCategories.length >= maxSelections;

  return (
    <div className={styles.categorySelector.container} ref={dropdownRef}>
      {/* Selected categories pills */}
      {selectedCategories.length > 0 && (
        <div className={styles.categorySelector.selectedCategories}>
          {selectedCategories.map((category) => {
            const [bgColor, textColor] = getCategoryColorById(category.id);

            return (
              <Badge
                key={category.id}
                variant="accent"
                size="md"
                removable={!disabled}
                onRemove={disabled ? undefined : () => onCategoryRemove(category.id)}
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                  border: `1px solid ${bgColor}`,
                }}
                {...dataCy(`selected-category-${category.id}`)}
              >
                <span
                  className={styles.categorySelector.categoryNameWithIndicator}
                >
                  {category.siteId && (
                    <SiteIndicator
                      siteId={category.siteId}
                      getSiteById={getSiteById}
                    />
                  )}
                  {category.displayPath || category.name}
                </span>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Search input — hidden in readonly/disabled mode */}
      {!disabled && <div className={styles.categorySelector.searchWrapper}>
        <div className={styles.categorySelector.searchInputContainer}>
          <input
            ref={inputRef}
            type="text"
            className={styles.categorySelector.searchInput}
            value={searchValue}
            onChange={handleSearchChange}
            onFocus={handleSearchFocus}
            onKeyDown={handleKeyDown}
            placeholder={
              isMaxSelectionsReached
                ? 'Maximum categories selected'
                : placeholder
            }
            disabled={disabled || Boolean(isMaxSelectionsReached)}
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            {...dataCy('category-search-input')}
            role="combobox"
            aria-label="Search categories"
          />
          <div className={styles.categorySelector.searchIcon}>
            <SearchIcon />
          </div>
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && !Boolean(isMaxSelectionsReached) && (
          <div
            className={styles.categorySelector.dropdown}
            role="listbox"
            {...dataCy('category-search-dropdown')}
          >
            {loading && (
              <div className={styles.categorySelector.loadingItem}>
                <div className={styles.categorySelector.spinner} />
                <span>Loading categories...</span>
              </div>
            )}

            {!loading && searchError && (
              <div className={styles.categorySelector.errorItem}>
                {searchError}
              </div>
            )}

            {!loading &&
              !searchError &&
              filteredResults.length === 0 &&
              searchValue && (
                <div className={styles.categorySelector.emptyItem}>
                  {searchValue.trim().length >= 3
                    ? `No available categories found for "${searchValue}"`
                    : `Type at least 3 characters to search`}
                  <div className="text-xs text-gray-500 mt-1">
                    {searchValue.trim().length >= 3
                      ? 'All matching categories may already be selected'
                      : `${searchValue.trim().length}/3 characters entered`}
                  </div>
                </div>
              )}

            {!loading && filteredResults.length === 0 && !searchValue && (
              <div className={styles.categorySelector.emptyItem}>
                Start typing to search categories
              </div>
            )}

            {!loading &&
              !searchError &&
              filteredResults.map((category, index) => (
                <button
                  key={category.id}
                  ref={(el) => {
                    dropdownItemsRef.current[index] = el;
                  }}
                  type="button"
                  className={`${styles.categorySelector.dropdownItem} ${
                    index === focusedIndex
                      ? styles.categorySelector.focusedItem
                      : ''
                  }`}
                  onClick={() => handleCategorySelect(category)}
                  onMouseEnter={() => setFocusedIndex(index)}
                  role="option"
                  aria-selected={index === focusedIndex ? 'true' : 'false'}
                  {...dataCy(`category-option-${category.id}`)}
                >
                  <div className={styles.categorySelector.categoryInfo}>
                    <div className={styles.categorySelector.categoryHeader}>
                      <div
                        className={
                          styles.categorySelector.categoryNameWithIndicator
                        }
                      >
                        {category.siteId && (
                          <SiteIndicator
                            siteId={category.siteId}
                            getSiteById={getSiteById}
                          />
                        )}
                        <span className={styles.categorySelector.categoryName}>
                          {category.displayPath || category.name}
                        </span>
                      </div>
                    </div>
                    {category.description && (
                      <div
                        className={styles.categorySelector.categoryDescription}
                      >
                        {category.description}
                      </div>
                    )}
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>}

      {/* Max selections indicator — hidden in readonly/disabled mode */}
      {!disabled && maxSelections && (
        <div
          className={
            isMaxSelectionsReached
              ? styles.categorySelector.maxIndicatorWarning
              : styles.categorySelector.maxIndicator
          }
        >
          {isMaxSelectionsReached
            ? `Maximum reached (${maxSelections}/${maxSelections}). Remove a category to add more.`
            : `${selectedCategories.length} / ${maxSelections} categories selected`}
        </div>
      )}
    </div>
  );
};

export default CategorySelector;
