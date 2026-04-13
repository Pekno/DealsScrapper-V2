/**
 * SearchInput - Enhanced search input component with autocomplete functionality
 * Extends the base Input component with search-specific features
 * Supports suggestions, debouncing, keyboard navigation, and accessibility
 */
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useMemo,
} from 'react';
import Input, { InputProps } from '../ui/Input';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import * as styles from './SearchInput.css';
import { dataCy } from '@/shared/lib/test-utils';

// Search icon component
const SearchIcon: React.FC<{ className?: string }> = ({
  className = 'w-5 h-5',
}) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

// Clear icon component
const ClearIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

// Loading spinner component (wrapper for consistent sizing)
const SearchLoadingSpinner: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <div className={className}>
    <LoadingSpinner size="small" variant="primary" />
  </div>
);

export interface SearchInputProps
  extends Omit<InputProps, 'icon' | 'rightIcon' | 'onChange'> {
  /** Current search value */
  value: string;
  /** Callback when search value changes */
  onChange: (value: string) => void;
  /** Array of suggestions to display */
  suggestions?: string[];
  /** Whether suggestions are being loaded */
  loading?: boolean;
  /** Callback when a suggestion is selected */
  onSuggestionSelect?: (suggestion: string) => void;
  /** Callback when search is executed (Enter key or search button) */
  onSearch?: (query: string) => void;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Maximum number of suggestions to display */
  maxSuggestions?: number;
  /** Whether to show recent searches */
  showRecentSearches?: boolean;
  /** Array of recent searches */
  recentSearches?: string[];
  /** Custom function to filter suggestions */
  filterSuggestions?: (suggestions: string[], query: string) => string[];
  /** Custom function to highlight matching text in suggestions */
  highlightMatch?: (suggestion: string, query: string) => React.ReactNode;
  /** Whether to clear input after selection */
  clearOnSelect?: boolean;
  /** Whether to show clear button */
  showClearButton?: boolean;
  /** Whether to auto-focus on mount */
  autoFocus?: boolean;
  /** Minimum characters required before showing suggestions */
  minQueryLength?: number;
  /** Custom empty state message */
  emptyStateMessage?: string;
  /** Custom loading message */
  loadingMessage?: string;
}

/**
 * Default function to filter suggestions based on query
 */
const defaultFilterSuggestions = (
  suggestions: string[],
  query: string
): string[] => {
  if (!query || query.trim().length === 0) return suggestions;

  const lowercaseQuery = query.toLowerCase().trim();
  return suggestions.filter((suggestion) =>
    suggestion.toLowerCase().includes(lowercaseQuery)
  );
};

/**
 * Default function to highlight matching text in suggestions
 */
const defaultHighlightMatch = (
  suggestion: string,
  query: string
): React.ReactNode => {
  if (!query || query.trim().length === 0) return suggestion;

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
    'gi'
  );
  const parts = suggestion.split(regex);

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === query.toLowerCase();
    return isMatch ? (
      <mark key={index} className={styles.searchInput.highlight}>
        {part}
      </mark>
    ) : (
      part
    );
  });
};

/**
 * Custom hook for debouncing values
 */
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      suggestions = [],
      loading = false,
      onSuggestionSelect,
      onSearch,
      debounceMs = 300,
      maxSuggestions = 10,
      showRecentSearches = false,
      recentSearches = [],
      filterSuggestions = defaultFilterSuggestions,
      highlightMatch = defaultHighlightMatch,
      clearOnSelect = false,
      showClearButton = true,
      autoFocus = false,
      minQueryLength = 1,
      emptyStateMessage = 'No suggestions found',
      loadingMessage = 'Searching...',
      placeholder = 'Search...',
      disabled = false,
      className = '',
      ...inputProps
    },
    ref
  ) => {
    // State management
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [internalValue, setInternalValue] = useState(value);

    // Refs
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Forward ref
    useEffect(() => {
      if (ref && inputRef.current) {
        if (typeof ref === 'function') {
          ref(inputRef.current);
        } else {
          ref.current = inputRef.current;
        }
      }
    }, [ref]);

    // Sync external value changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    // Debounced value for search (kept for future use)
    // const debouncedValue = useDebounce(internalValue, debounceMs);

    // Process suggestions
    const processedSuggestions = useMemo(() => {
      let allSuggestions: string[] = [];

      // Add recent searches if enabled and no current query
      if (
        showRecentSearches &&
        (!internalValue || internalValue.trim().length === 0)
      ) {
        allSuggestions = [...recentSearches];
      }

      // Add regular suggestions
      if (
        suggestions.length > 0 &&
        internalValue.trim().length >= minQueryLength
      ) {
        const filtered = filterSuggestions(suggestions, internalValue);
        allSuggestions = [...allSuggestions, ...filtered];
      }

      // Remove duplicates and limit results
      const unique = Array.from(new Set(allSuggestions));
      return unique.slice(0, maxSuggestions);
    }, [
      suggestions,
      internalValue,
      showRecentSearches,
      recentSearches,
      maxSuggestions,
      minQueryLength,
      filterSuggestions,
    ]);

    // Handle input changes
    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInternalValue(newValue);
        onChange(newValue);
        setIsOpen(true);
        setFocusedIndex(-1);
      },
      [onChange]
    );

    // Handle input focus
    const handleInputFocus = useCallback(() => {
      setIsOpen(true);
      setFocusedIndex(-1);
    }, []);

    // Handle suggestion selection
    const handleSuggestionSelect = useCallback(
      (suggestion: string) => {
        const newValue = clearOnSelect ? '' : suggestion;
        setInternalValue(newValue);
        onChange(newValue);
        onSuggestionSelect?.(suggestion);
        setIsOpen(false);
        setFocusedIndex(-1);
        inputRef.current?.focus();
      },
      [onChange, onSuggestionSelect, clearOnSelect]
    );

    // Handle search execution
    const handleSearch = useCallback(() => {
      onSearch?.(internalValue);
      setIsOpen(false);
      setFocusedIndex(-1);
    }, [onSearch, internalValue]);

    // Handle clear button
    const handleClear = useCallback(() => {
      setInternalValue('');
      onChange('');
      setIsOpen(false);
      setFocusedIndex(-1);
      inputRef.current?.focus();
    }, [onChange]);

    // Keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
          if (e.key === 'ArrowDown' && processedSuggestions.length > 0) {
            e.preventDefault();
            setIsOpen(true);
            setFocusedIndex(0);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
          }
          return;
        }

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setFocusedIndex((prev) => {
              const nextIndex =
                prev < processedSuggestions.length - 1 ? prev + 1 : prev;
              // Scroll into view
              if (optionRefs.current[nextIndex]) {
                optionRefs.current[nextIndex]?.scrollIntoView({
                  block: 'nearest',
                  behavior: 'smooth',
                });
              }
              return nextIndex;
            });
            break;

          case 'ArrowUp':
            e.preventDefault();
            setFocusedIndex((prev) => {
              const nextIndex = prev > 0 ? prev - 1 : prev;
              // Scroll into view
              if (optionRefs.current[nextIndex]) {
                optionRefs.current[nextIndex]?.scrollIntoView({
                  block: 'nearest',
                  behavior: 'smooth',
                });
              }
              return nextIndex;
            });
            break;

          case 'Enter':
            e.preventDefault();
            if (
              focusedIndex >= 0 &&
              focusedIndex < processedSuggestions.length
            ) {
              handleSuggestionSelect(processedSuggestions[focusedIndex]);
            } else {
              handleSearch();
            }
            break;

          case 'Escape':
            e.preventDefault();
            setIsOpen(false);
            setFocusedIndex(-1);
            inputRef.current?.blur();
            break;

          case 'Tab':
            // Allow default tab behavior to move focus
            setIsOpen(false);
            setFocusedIndex(-1);
            break;
        }
      },
      [
        isOpen,
        processedSuggestions,
        focusedIndex,
        handleSuggestionSelect,
        handleSearch,
      ]
    );

    // Click outside to close dropdown
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node) &&
          !inputRef.current?.contains(event.target as Node)
        ) {
          setIsOpen(false);
          setFocusedIndex(-1);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto focus on mount
    useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
      }
    }, [autoFocus]);

    // Determine what to show in dropdown
    const showSuggestions =
      isOpen &&
      !disabled &&
      (processedSuggestions.length > 0 ||
        loading ||
        internalValue.trim().length >= minQueryLength);

    // Create icons
    const searchIcon = <SearchIcon />;
    const rightIcon = loading ? (
      <SearchLoadingSpinner />
    ) : showClearButton && internalValue ? (
      <button
        type="button"
        onClick={handleClear}
        className={styles.searchInput.clearButton}
        tabIndex={-1}
        aria-label="Clear search"
      >
        <ClearIcon />
      </button>
    ) : null;

    return (
      <div className={styles.searchInput.container}>
        <Input
          {...inputProps}
          ref={inputRef}
          value={internalValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          icon={searchIcon}
          rightIcon={rightIcon}
          className={className}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-describedby={showSuggestions ? 'search-suggestions' : undefined}
          {...dataCy('filter-search-input')}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && (
          <div
            ref={dropdownRef}
            className={styles.searchInput.dropdown}
            role="listbox"
            id="search-suggestions"
            aria-label="Search suggestions"
          >
            {loading && (
              <div className={styles.searchInput.loadingItem}>
                <SearchLoadingSpinner className="w-4 h-4" />
                <span>{loadingMessage}</span>
              </div>
            )}

            {!loading &&
              processedSuggestions.length === 0 &&
              internalValue.trim().length >= minQueryLength && (
                <div
                  className={styles.searchInput.emptyItem}
                  role="option"
                  aria-selected="false"
                >
                  {emptyStateMessage}
                </div>
              )}

            {!loading &&
              internalValue.trim().length < minQueryLength &&
              !showRecentSearches && (
                <div
                  className={styles.searchInput.emptyItem}
                  role="option"
                  aria-selected="false"
                >
                  Type at least {minQueryLength} character
                  {minQueryLength !== 1 ? 's' : ''} to search
                </div>
              )}

            {!loading &&
              processedSuggestions.map((suggestion, index) => {
                const isRecent =
                  showRecentSearches &&
                  recentSearches.includes(suggestion) &&
                  (!internalValue || internalValue.trim().length === 0);

                return (
                  <div
                    key={`${suggestion}-${index}`}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    className={`${styles.searchInput.suggestionItem} ${
                      index === focusedIndex
                        ? styles.searchInput.focusedItem
                        : ''
                    }`}
                    role="option"
                    aria-selected={index === focusedIndex}
                    onClick={() => handleSuggestionSelect(suggestion)}
                    onMouseEnter={() => setFocusedIndex(index)}
                  >
                    <div className={styles.searchInput.suggestionContent}>
                      <span className={styles.searchInput.suggestionText}>
                        {highlightMatch(suggestion, internalValue)}
                      </span>
                      {isRecent && (
                        <span className={styles.searchInput.recentBadge}>
                          Recent
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
