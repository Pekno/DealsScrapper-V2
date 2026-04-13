/**
 * SiteFilter - Dropdown filter for filtering articles by site source
 * Used on article lists and filter detail pages
 */
import React from 'react';
import { SiteSource } from '@dealscrapper/shared-types';
import { useSiteRegistry } from '@/shared/hooks';
import { dataCy } from '@/shared/lib/test-utils';
import * as styles from './SiteFilter.css';

export interface SiteFilterProps {
  /** Currently selected sites (empty array = all sites) */
  selectedSites: SiteSource[];
  /** Callback when selection changes */
  onChange: (sites: SiteSource[]) => void;
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Label for the filter */
  label?: string;
}

/**
 * SiteFilter Component
 * Multi-select filter with "All Sites" option and individual site toggles
 */
export const SiteFilter: React.FC<SiteFilterProps> = ({
  selectedSites = [],
  onChange,
  disabled = false,
  label = 'Filter by Site',
}) => {
  const { sites } = useSiteRegistry();

  const handleToggleSite = (siteId: SiteSource) => {
    if (disabled) return;

    const isSelected = selectedSites.includes(siteId);
    if (isSelected) {
      // Deselect
      onChange(selectedSites.filter((id) => id !== siteId));
    } else {
      // Select
      onChange([...selectedSites, siteId]);
    }
  };

  const handleToggleAll = () => {
    if (disabled) return;

    if (selectedSites.length === sites.length) {
      // All selected -> deselect all
      onChange([]);
    } else {
      // Some/none selected -> select all
      onChange(sites.map((site) => site.id));
    }
  };

  const isAllSelected = selectedSites.length === sites.length;
  const isNoneSelected = selectedSites.length === 0;
  const showAsAll = isAllSelected || isNoneSelected;

  return (
    <div className={styles.siteFilter.container} {...dataCy('site-filter')}>
      <div className={styles.siteFilter.label}>{label}</div>

      <div className={styles.siteFilter.buttonGroup}>
        {/* All Sites Button */}
        <button
          type="button"
          onClick={handleToggleAll}
          disabled={disabled}
          className={`${styles.siteFilter.filterButton} ${
            showAsAll ? styles.siteFilter.filterButtonActive : ''
          }`}
          {...dataCy('site-filter-all')}
        >
          All Sites
          {showAsAll && <span className={styles.siteFilter.checkmark}>✓</span>}
        </button>

        {/* Individual Site Buttons */}
        {sites.map((site) => {
          const isSelected = selectedSites.includes(site.id);

          return (
            <button
              key={site.id}
              type="button"
              onClick={() => handleToggleSite(site.id)}
              disabled={disabled}
              className={`${styles.siteFilter.filterButton} ${
                isSelected && !showAsAll ? styles.siteFilter.filterButtonActive : ''
              }`}
              style={{
                borderColor: isSelected && !showAsAll ? site.color : undefined,
                color: isSelected && !showAsAll ? site.color : undefined,
              }}
              {...dataCy(`site-filter-${site.name}`)}
            >
              {site.displayName}
              {isSelected && !showAsAll && (
                <span className={styles.siteFilter.checkmark}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {!isNoneSelected && !isAllSelected && (
        <div className={styles.siteFilter.count} {...dataCy('site-filter-count')}>
          {selectedSites.length} of {sites.length} sites selected
        </div>
      )}
    </div>
  );
};

export default SiteFilter;
