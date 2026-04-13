/**
 * Custom hook for managing dropdown state and logic
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  RefObject,
} from 'react';
import type {
  DropdownOption,
  DropdownGroup,
} from '@/shared/ui/DropdownTypes';
import {
  flattenOptions,
  normalizeOptions,
  defaultFilterFunction,
} from '@/shared/ui/DropdownUtils';

export interface UseDropdownParams {
  options: DropdownOption[] | DropdownGroup[];
  value?: string | string[];
  onChange: (
    value: string | string[],
    option?: DropdownOption | DropdownOption[]
  ) => void;
  multiple?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  mobile?: boolean;
  filterFunction?: (option: DropdownOption, query: string) => boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onSearch?: (query: string) => void;
  maxSelections?: number;
}

export interface UseDropdownResult {
  // State
  isOpen: boolean;
  searchQuery: string;
  highlightedIndex: number;
  isMobileView: boolean;

  // Refs
  containerRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;

  // Actions
  openDropdown: () => void;
  closeDropdown: () => void;
  toggleDropdown: () => void;
  setSearchQuery: (query: string) => void;
  handleOptionSelect: (option: DropdownOption) => void;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  handleSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;

  // Computed
  flatOptions: DropdownOption[];
  groupedOptions: DropdownGroup[];
  selectedOptions: DropdownOption[];
  filteredOptions: DropdownGroup[];
  filteredFlatOptions: DropdownOption[];
}

export const useDropdown = ({
  options = [],
  value,
  onChange,
  multiple = false,
  searchable = false,
  disabled = false,
  loading = false,
  mobile = false,
  filterFunction = defaultFilterFunction,
  onOpen,
  onClose,
  onSearch,
  maxSelections,
}: UseDropdownParams): UseDropdownResult => {
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isMobileView, setIsMobileView] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Flatten options for easier processing
  const flatOptions = useMemo(() => flattenOptions(options), [options]);
  const groupedOptions = useMemo(() => normalizeOptions(options), [options]);

  // Get selected options
  const selectedOptions = useMemo(() => {
    if (!value) return [];
    const values = Array.isArray(value) ? value : [value];
    return flatOptions.filter((option) => values.includes(option.value));
  }, [value, flatOptions]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return groupedOptions;

    return groupedOptions
      .map((group) => ({
        ...group,
        options: group.options.filter((option) =>
          filterFunction(option, searchQuery)
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [groupedOptions, searchQuery, filterFunction]);

  // Get all filtered flat options for keyboard navigation
  const filteredFlatOptions = useMemo(() => {
    return filteredOptions
      .flatMap((group) => group.options)
      .filter((option) => !option.disabled);
  }, [filteredOptions]);

  // Detect mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(mobile || window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobile]);

  // Close dropdown
  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
    onClose?.();
  }, [onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, closeDropdown]);

  // Handle body scroll lock on mobile
  useEffect(() => {
    if (isOpen && isMobileView) {
      document.body.classList.add('dropdown-open');
      return () => document.body.classList.remove('dropdown-open');
    }
  }, [isOpen, isMobileView]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDownGlobal = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closeDropdown();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDownGlobal);
    return () => document.removeEventListener('keydown', handleKeyDownGlobal);
  }, [isOpen, closeDropdown]);

  // Open dropdown
  const openDropdown = useCallback(() => {
    if (disabled || loading) return;

    setIsOpen(true);
    setSearchQuery('');
    setHighlightedIndex(-1);
    onOpen?.();

    // Focus search input if searchable
    setTimeout(() => {
      if (searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
  }, [disabled, loading, onOpen, searchable]);

  // Toggle dropdown
  const toggleDropdown = useCallback(() => {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }, [isOpen, openDropdown, closeDropdown]);

  // Handle option selection
  const handleOptionSelect = useCallback(
    (option: DropdownOption) => {
      if (option.disabled) return;

      if (multiple) {
        const currentValues = Array.isArray(value) ? value : [];
        const isSelected = currentValues.includes(option.value);

        let newValues: string[];
        if (isSelected) {
          // Remove from selection
          newValues = currentValues.filter((v) => v !== option.value);
        } else {
          // Add to selection (check max limit)
          if (maxSelections && currentValues.length >= maxSelections) {
            return; // Don't allow more selections
          }
          newValues = [...currentValues, option.value];
        }

        onChange(
          newValues,
          flatOptions.filter((opt) => newValues.includes(opt.value))
        );
      } else {
        onChange(option.value, option);
        closeDropdown();
      }
    },
    [multiple, value, maxSelections, onChange, flatOptions, closeDropdown]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen) {
        if (
          event.key === 'Enter' ||
          event.key === ' ' ||
          event.key === 'ArrowDown'
        ) {
          event.preventDefault();
          openDropdown();
        }
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex((prev) => {
            const next = prev < filteredFlatOptions.length - 1 ? prev + 1 : 0;
            return next;
          });
          break;

        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex((prev) => {
            const next = prev > 0 ? prev - 1 : filteredFlatOptions.length - 1;
            return next;
          });
          break;

        case 'Enter':
          event.preventDefault();
          if (
            highlightedIndex >= 0 &&
            highlightedIndex < filteredFlatOptions.length
          ) {
            handleOptionSelect(filteredFlatOptions[highlightedIndex]);
          }
          break;

        case 'Tab':
          closeDropdown();
          break;
      }
    },
    [
      isOpen,
      openDropdown,
      filteredFlatOptions,
      highlightedIndex,
      handleOptionSelect,
      closeDropdown,
    ]
  );

  // Handle search input change
  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const query = event.target.value;
      setSearchQuery(query);
      setHighlightedIndex(-1);
      onSearch?.(query);
    },
    [onSearch]
  );

  return {
    // State
    isOpen,
    searchQuery,
    highlightedIndex,
    isMobileView,

    // Refs
    containerRef,
    triggerRef,
    menuRef,
    searchInputRef,

    // Actions
    openDropdown,
    closeDropdown,
    toggleDropdown,
    setSearchQuery,
    handleOptionSelect,
    handleKeyDown,
    handleSearchChange,

    // Computed
    flatOptions,
    groupedOptions,
    selectedOptions,
    filteredOptions,
    filteredFlatOptions,
  };
};
