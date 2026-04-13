/**
 * Shared TypeScript interfaces and types for Dropdown component
 */

export interface DropdownOption {
  /** Unique identifier for the option */
  value: string;
  /** Display label for the option */
  label: string;
  /** Optional description shown below the label */
  description?: string;
  /** Optional icon element */
  icon?: React.ReactNode;
  /** Whether this option is disabled */
  disabled?: boolean;
  /** Optional group this option belongs to */
  group?: string;
  /** Additional data attached to the option */
  data?: Record<string, unknown>;
}

export interface DropdownGroup {
  /** Group identifier */
  id: string;
  /** Group label */
  label: string;
  /** Options in this group */
  options: DropdownOption[];
}

export interface DropdownProps {
  /** Array of options or grouped options */
  options: DropdownOption[] | DropdownGroup[];
  /** Selected value(s) */
  value?: string | string[];
  /** Called when selection changes */
  onChange: (
    value: string | string[],
    option?: DropdownOption | DropdownOption[]
  ) => void;
  /** Placeholder text when nothing is selected */
  placeholder?: string;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Whether the dropdown has an error state */
  error?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Loading state */
  loading?: boolean;
  /** Enable search functionality */
  searchable?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Allow multiple selections */
  multiple?: boolean;
  /** Maximum number of selections (only for multiple) */
  maxSelections?: number;
  /** Custom trigger content when multiple items are selected */
  multipleDisplayFormat?: (count: number, options: DropdownOption[]) => string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width dropdown */
  fullWidth?: boolean;
  /** Custom className for the container */
  className?: string;
  /** Custom className for the trigger */
  triggerClassName?: string;
  /** Custom className for the menu */
  menuClassName?: string;
  /** Portal target for the menu (optional) */
  portal?: HTMLElement;
  /** Custom trigger content renderer */
  renderTrigger?: (props: {
    isOpen: boolean;
    selectedOptions: DropdownOption[];
    placeholder: string;
    disabled: boolean;
  }) => React.ReactNode;
  /** Custom option renderer */
  renderOption?: (
    option: DropdownOption,
    isSelected: boolean,
    isHighlighted: boolean
  ) => React.ReactNode;
  /** Called when the dropdown opens */
  onOpen?: () => void;
  /** Called when the dropdown closes */
  onClose?: () => void;
  /** Called when search query changes */
  onSearch?: (query: string) => void;
  /** Custom filter function for search */
  filterFunction?: (option: DropdownOption, query: string) => boolean;
  /** Enable mobile-friendly behavior */
  mobile?: boolean;
  /** ARIA label for accessibility */
  'aria-label'?: string;
  /** ARIA described by for accessibility */
  'aria-describedby'?: string;
  /** Test ID for testing */
  'data-testid'?: string;
  /** Prefix for option data-cy attributes (e.g., 'field-option' or 'operator-option') */
  optionDataCyPrefix?: string;
  /** Additional HTML attributes for the trigger button (including data-cy) */
  [key: `data-${string}`]: string | undefined;
}

export interface DropdownRef {
  /** Open the dropdown */
  open: () => void;
  /** Close the dropdown */
  close: () => void;
  /** Focus the dropdown */
  focus: () => void;
  /** Clear the selection */
  clear: () => void;
  /** Get currently selected options */
  getSelectedOptions: () => DropdownOption[];
}

export interface DropdownTriggerProps {
  isOpen: boolean;
  disabled: boolean;
  loading: boolean;
  error: boolean;
  placeholder: string;
  selectedOptions: DropdownOption[];
  multiple: boolean;
  multipleDisplayFormat: (count: number, options: DropdownOption[]) => string;
  triggerClassName?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  renderTrigger?: DropdownProps['renderTrigger'];
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  restProps?: Record<string, any>;
}

export interface DropdownMenuProps {
  isOpen: boolean;
  isMobileView: boolean;
  placeholder: string;
  searchable: boolean;
  searchPlaceholder: string;
  searchQuery: string;
  loading: boolean;
  multiple: boolean;
  filteredOptions: DropdownGroup[];
  filteredFlatOptions: DropdownOption[];
  highlightedIndex: number;
  value?: string | string[];
  optionDataCyPrefix?: string;
  menuClassName?: string;
  menuRef: React.RefObject<HTMLDivElement | null>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOptionSelect: (option: DropdownOption) => void;
  onClose: () => void;
  renderOption?: DropdownProps['renderOption'];
}

export interface DropdownOptionProps {
  option: DropdownOption;
  isSelected: boolean;
  isHighlighted: boolean;
  optionDataCyPrefix?: string;
  onSelect: (option: DropdownOption) => void;
  renderOption?: (
    option: DropdownOption,
    isSelected: boolean,
    isHighlighted: boolean
  ) => React.ReactNode;
}
