/**
 * SiteSelector - Multi-select component for choosing enabled sites
 * Allows users to select which platforms (Dealabs, Vinted, LeBonCoin) a filter should target
 */
import React from 'react';
import { SiteSource } from '@dealscrapper/shared-types';
import { useSiteRegistry } from '@/shared/hooks';
import { dataCy } from '@/shared/lib/test-utils';
import * as styles from './SiteSelector.css';

export interface SiteSelectorProps {
  /** Currently selected site sources */
  value: SiteSource[];
  /** Callback when selection changes */
  onChange: (sites: SiteSource[]) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Error message to display */
  error?: string;
  /** Whether selection is required (shows validation error if empty) */
  required?: boolean;
}

/**
 * SiteSelector Component
 * Multi-select interface with visual brand colors for each site
 */
export const SiteSelector: React.FC<SiteSelectorProps> = ({
  value = [],
  onChange,
  disabled = false,
  error,
  required = true,
}) => {
  const { sites } = useSiteRegistry();

  const handleToggle = (siteId: SiteSource) => {
    if (disabled) return;

    const isSelected = value.includes(siteId);
    if (isSelected) {
      // Deselect - remove from array
      onChange(value.filter((id) => id !== siteId));
    } else {
      // Select - add to array
      onChange([...value, siteId]);
    }
  };

  const showValidationError = required && value.length === 0 && error;

  return (
    <div className={styles.siteSelector.container} {...dataCy('site-selector')}>
      <div className={styles.siteSelector.label}>
        Target Sites
        {required && <span className={styles.siteSelector.required}>*</span>}
      </div>
      <div className={styles.siteSelector.description}>
        Select which platforms this filter should search
      </div>

      <div className={styles.siteSelector.grid} role="group" aria-label="Site selection">
        {sites.map((site) => {
          const isSelected = value.includes(site.id);

          return (
            <button
              key={site.id}
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              onClick={() => handleToggle(site.id)}
              disabled={disabled}
              className={`${styles.siteSelector.siteButton} ${
                isSelected ? styles.siteSelector.siteButtonSelected : ''
              } ${disabled ? styles.siteSelector.siteButtonDisabled : ''}`}
              style={{
                borderColor: isSelected ? site.color : undefined,
                backgroundColor: isSelected ? `${site.color}15` : undefined,
              }}
              {...dataCy(`site-selector-${site.name}`)}
            >
              <div className={styles.siteSelector.siteContent}>
                <div
                  className={styles.siteSelector.colorIndicator}
                  style={{ backgroundColor: site.color }}
                  aria-hidden="true"
                />
                <div className={styles.siteSelector.siteName}>{site.displayName}</div>
                {isSelected && (
                  <div className={styles.siteSelector.checkmark} aria-hidden="true">
                    ✓
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {showValidationError && (
        <div
          className={styles.siteSelector.errorMessage}
          role="alert"
          {...dataCy('site-selector-error')}
        >
          {error}
        </div>
      )}

      {value.length > 0 && (
        <div
          className={styles.siteSelector.selectedCount}
          aria-live="polite"
          {...dataCy('site-selector-count')}
        >
          {value.length} {value.length === 1 ? 'site' : 'sites'} selected
        </div>
      )}
    </div>
  );
};

export default SiteSelector;
