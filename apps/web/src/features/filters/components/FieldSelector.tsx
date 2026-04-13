/**
 * FieldSelector Component
 * Allows users to select a filterable field from available options
 * Shows colored site indicators for site-specific fields
 * Uses shared-types field definitions for consistency with backend
 */
import React from 'react';
import type {
  FilterableField,
  FilterFieldDefinition,
} from '@/features/filters/types/filter.types';
import { Dropdown } from '@/shared/ui/Dropdown';
import type { DropdownOption } from '@/shared/ui/Dropdown';
import { getFieldIcon } from './RuleIcons';
import { dataCy } from '@/shared/lib/test-utils';
import * as styles from './RuleBuilder.css';
import { useSiteRegistry } from '@/shared/hooks/useSiteRegistry';
import { SiteSource, getFieldDefinition } from '@dealscrapper/shared-types';

export interface FieldSelectorProps {
  value: FilterableField;
  onChange: (field: FilterableField) => void;
  availableFields: FilterFieldDefinition[];
  disabled?: boolean;
  ruleIdentifier?: string; // For semantic data-cy attributes (e.g., "rule-0", "group-1-rule-2")
}

/**
 * Site data attached to dropdown options
 */
interface FieldSiteData extends Record<string, unknown> {
  siteColor?: string;
  siteName?: string;
}

/**
 * Extended dropdown option with site color information
 */
interface FieldDropdownOption extends DropdownOption {
  data?: FieldSiteData;
}

/**
 * Site indicator component - shows a colored circle for site-specific fields
 */
interface SiteIndicatorProps {
  color: string;
  siteName: string;
}

const SiteIndicator: React.FC<SiteIndicatorProps> = ({ color, siteName }) => (
  <span
    className={styles.siteIndicator}
    style={{ backgroundColor: color }}
    aria-label={`${siteName} field`}
    title={`${siteName} specific field`}
  />
);

export const FieldSelector: React.FC<FieldSelectorProps> = ({
  value,
  onChange,
  availableFields,
  disabled = false,
  ruleIdentifier,
}) => {
  // Get site registry for color lookup
  const { getSiteById, getSiteColor } = useSiteRegistry();

  // Convert fields to dropdown options with site color information
  const options: FieldDropdownOption[] = availableFields.map(
    (field: FilterFieldDefinition): FieldDropdownOption => {
      // Look up field definition from shared-types to get site information
      const sharedFieldDef = getFieldDefinition(field.key);

      // Determine if this is a universal field or site-specific
      const isUniversal = sharedFieldDef?.sites === 'universal';
      const fieldSites = sharedFieldDef?.sites;

      // Get the first site's color if this is a site-specific field
      let siteColor: string | undefined;
      let siteName: string | undefined;

      if (!isUniversal && Array.isArray(fieldSites) && fieldSites.length > 0) {
        // For fields that belong to a single site, show that site's color
        // For fields shared between sites (like 'condition'), show the first site's color
        const firstSite = fieldSites[0];
        const siteInfo = getSiteById(firstSite as SiteSource);
        if (siteInfo) {
          siteColor = siteInfo.color;
          siteName = siteInfo.displayName;
        } else {
          // Fall back to getSiteColor if getSiteById returns undefined
          siteColor = getSiteColor(firstSite);
          siteName = firstSite;
        }
      }

      return {
        value: field.key,
        label: field.label,
        description: field.description,
        icon: getFieldIcon(field.type),
        data: {
          siteColor,
          siteName,
        },
      };
    }
  );

  const handleChange = (selectedValue: string | string[]): void => {
    onChange(selectedValue as FilterableField);
  };

  // Custom option renderer with site indicator
  const renderOption = (
    option: DropdownOption,
    isSelected: boolean,
    _isHighlighted: boolean
  ): React.ReactNode => {
    const fieldOption = option as FieldDropdownOption;
    const siteData = fieldOption.data as FieldSiteData | undefined;
    const siteColor = siteData?.siteColor;
    const siteName = siteData?.siteName;

    return (
      <div className={styles.fieldOptionContent}>
        {option.icon && <span>{option.icon}</span>}
        <div className={styles.fieldOptionText}>
          <div className={styles.fieldOptionLabel}>
            {siteColor && siteName && (
              <SiteIndicator color={siteColor} siteName={siteName} />
            )}
            <span>{option.label}</span>
          </div>
          {option.description && (
            <div className={styles.fieldOptionDescription}>
              {option.description}
            </div>
          )}
        </div>
        {isSelected && (
          <svg
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ flexShrink: 0 }}
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

  // Custom trigger renderer to show site indicator on selected field
  const renderTrigger = ({
    selectedOptions,
    placeholder,
  }: {
    isOpen: boolean;
    selectedOptions: DropdownOption[];
    placeholder: string;
    disabled: boolean;
  }): React.ReactNode => {
    if (selectedOptions.length === 0) {
      return <span style={{ color: '#6B7280' }}>{placeholder}</span>;
    }

    const selectedOption = selectedOptions[0] as FieldDropdownOption;
    const siteData = selectedOption?.data as FieldSiteData | undefined;
    const siteColor = siteData?.siteColor;
    const siteName = siteData?.siteName;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {selectedOption.icon && <span>{selectedOption.icon}</span>}
        {siteColor && siteName && (
          <SiteIndicator color={siteColor} siteName={siteName} />
        )}
        <span>{selectedOption.label}</span>
      </div>
    );
  };

  // Generate semantic data-cy attribute
  const dataCyValue = ruleIdentifier
    ? `rule-field-select-${ruleIdentifier}`
    : 'rule-field-select';

  // Generate aria-label with current field context
  const currentField = availableFields.find(
    (f: FilterFieldDefinition) => f.key === value
  );
  const ariaLabel = currentField
    ? `Filter field: ${currentField.label} selected. Choose a different field.`
    : 'Select filter field';

  return (
    <Dropdown
      options={options}
      value={value || ''}
      onChange={handleChange}
      placeholder="Select field..."
      disabled={disabled}
      searchable={options.length > 5}
      searchPlaceholder="Search fields..."
      className={disabled ? styles.disabledState : ''}
      aria-label={ariaLabel}
      optionDataCyPrefix="field-option"
      renderOption={renderOption}
      renderTrigger={renderTrigger}
      {...dataCy(dataCyValue)}
    />
  );
};
