/**
 * CreateFilterForm - Complete form for creating/editing filters
 * Integrates all form sections with validation and submission handling
 */
import React from 'react';
import { Controller } from 'react-hook-form';
import Button from '@/shared/ui/Button';
import Input from '@/shared/ui/Input';
import { Section } from '@/shared/ui/Section';
import FormField from '@/shared/ui/FormField';
import CategorySelector from '@/features/filters/components/CategorySelector';
import SiteSelector from '@/features/filters/components/SiteSelector';
import NotificationSettingsComponent from '@/features/notifications/components/NotificationSettings';
import RuleBuilder from '@/features/filters/components/RuleBuilder';
import {
  FilterRule,
  FilterRuleGroup,
  OPERATOR_DEFINITIONS,
  CreateFilterRequest as ApiCreateFilterRequest,
  UpdateFilterRequest,
  getAvailableFieldDefinitions,
} from '@/features/filters/types/filter.types';
import * as styles from './CreateFilterForm.css';
import { dataCy } from '@/shared/lib/test-utils';
import {
  useFilterForm,
  CreateFilterFormData,
} from '@/features/filters/hooks/useFilterForm';
import { SiteSource } from '@dealscrapper/shared-types';
import { useMemo, useRef, useEffect } from 'react';

export interface CreateFilterFormProps {
  /** Callback when form is submitted (create mode) */
  onSubmit?: (filterData: ApiCreateFilterRequest) => void;
  /** Callback when form is updated (edit mode) */
  onUpdate?: (filterId: string, filterData: UpdateFilterRequest) => void;
  /** Initial form data for editing */
  initialData?: Partial<CreateFilterFormData>;
  /** Filter ID when in edit mode */
  filterId?: string;
  /** Whether this is edit mode */
  isEditMode?: boolean;
  /** Whether the form is loading/submitting */
  loading?: boolean;
  /** Form submission error message */
  error?: string;
}

// Icons
const SettingsIcon = () => (
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
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const FilterIcon = () => (
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
      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
    />
  </svg>
);

const BellIcon = () => (
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
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

export const CreateFilterForm: React.FC<CreateFilterFormProps> = ({
  onSubmit,
  onUpdate,
  initialData = {},
  filterId,
  isEditMode = false,
  loading = false,
  error,
}) => {
  // Use custom hook for all form logic
  const {
    form,
    categorySearch,
    setCategorySearch,
    currentCategories,
    currentRules,
    currentEnabledSites,
    isFormLoading,
    handleFormSubmit,
    handleCategoryAdd,
    handleCategoryRemove,
    handleRulesChange,
    handleSitesChange,
  } = useFilterForm({
    onSubmit,
    onUpdate,
    initialData,
    filterId,
    isEditMode,
    loading,
  });

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  // Get available field definitions based on enabled sites
  const availableFields = useMemo(() => {
    if (currentEnabledSites.length === 0) {
      // If no sites selected, show all fields
      return getAvailableFieldDefinitions(['dealabs', 'vinted', 'leboncoin']);
    }
    return getAvailableFieldDefinitions(currentEnabledSites);
  }, [currentEnabledSites]);

  const validationErrorsRef = useRef<HTMLDivElement>(null);
  const errorCount = Object.keys(errors).length;

  useEffect(() => {
    if (errorCount > 0 && validationErrorsRef.current) {
      validationErrorsRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [errorCount]);

  return (
    <div className={styles.createFilterForm.container}>
      {error && (
        <div
          className={styles.createFilterForm.errorAlert}
          role="alert"
          {...dataCy(
            isEditMode ? 'filter-update-error' : 'filter-creation-error'
          )}
        >
          <div className={styles.createFilterForm.errorTitle}>
            Error {isEditMode ? 'updating' : 'creating'} filter
          </div>
          <div className={styles.createFilterForm.errorMessage}>{error}</div>
        </div>
      )}

      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className={styles.createFilterForm.form}
        {...dataCy('filter-form')}
      >
        {/* Form Validation Errors (top of form for visibility) */}
        {Object.keys(errors).length > 0 && (
          <div
            ref={validationErrorsRef}
            className={styles.createFilterForm.errorAlert}
            role="alert"
            data-cy="form-validation-errors"
          >
            <div className={styles.createFilterForm.errorTitle}>
              Please fix the following errors:
            </div>
            <ul className="mt-2 space-y-1">
              {Object.entries(errors).map(([field, error]) => {
                let errorMessage = '';

                // Check for direct message
                if (error?.message) {
                  errorMessage = error.message;
                }
                // Check for nested error structures (Zod validation errors)
                else if (error?.type) {
                  switch (error.type) {
                    case 'too_small':
                      errorMessage =
                        error.message || 'At least one item must be selected';
                      break;
                    case 'invalid_type':
                      errorMessage = error.message || 'Invalid data format';
                      break;
                    default:
                      errorMessage = error.message || 'Invalid value';
                  }
                }
                // Check for array of errors (multiple validation issues)
                else if (Array.isArray(error)) {
                  const messages = error
                    .map((e) => e?.message || 'Invalid value')
                    .filter(Boolean);
                  errorMessage =
                    messages.length > 0
                      ? messages.join(', ')
                      : 'Multiple validation errors';
                }
                // Check if it's a nested error object with a root property
                else if (error?.root?.message) {
                  errorMessage = error.root.message;
                }
                // Special handling for categories field
                else if (field === 'categories') {
                  errorMessage = 'At least one category must be selected';
                }
                // Special handling for rules field
                else if (field === 'rules') {
                  errorMessage = 'At least one rule must be configured';
                } else {
                  // Last resort - try to extract any message we can find
                  const errorStr = JSON.stringify(error);
                  if (errorStr.includes('message')) {
                    try {
                      const parsed = JSON.parse(errorStr);
                      errorMessage = parsed.message || 'Validation error';
                    } catch {
                      errorMessage = 'Please check this field';
                    }
                  } else {
                    errorMessage = 'Please check this field';
                  }
                }

                return (
                  <li
                    key={field}
                    className="text-sm text-red-700"
                    data-cy={`error-${field}`}
                  >
                    <strong>{field}:</strong> {errorMessage}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* General Information Section */}
        <Section icon={<SettingsIcon />} title="General">
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <FormField label="Name" required error={errors.name?.message}>
                <Input
                  {...field}
                  placeholder="e.g., 'Gaming Laptops under $1500'"
                  disabled={isFormLoading}
                  error={errors.name?.message}
                  {...dataCy('filter-name-input')}
                />
                {errors.name && (
                  <div
                    className={styles.createFilterForm.fieldError}
                    {...dataCy('filter-name-error')}
                  >
                    {errors.name.message}
                  </div>
                )}
              </FormField>
            )}
          />

          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <FormField
                label="Description"
                error={errors.description?.message}
                description="A brief description of what this filter is for"
              >
                <textarea
                  {...field}
                  placeholder="A short description of what this filter is for"
                  rows={3}
                  disabled={isFormLoading}
                  className={styles.createFilterForm.textarea}
                  {...dataCy('filter-description-input')}
                />
              </FormField>
            )}
          />

          <Controller
            name="enabledSites"
            control={control}
            render={({ field }) => (
              <SiteSelector
                value={field.value.map((site) => site as SiteSource)}
                onChange={(sites) => {
                  field.onChange(sites);
                  handleSitesChange(sites);
                }}
                disabled={isFormLoading}
                error={errors.enabledSites?.message}
                required
              />
            )}
          />

          <FormField
            label="Categories"
            required
            error={errors.categories?.message}
            description={
              currentEnabledSites.length === 0
                ? 'Select at least one site above to search categories'
                : undefined
            }
          >
            <CategorySelector
              selectedCategories={currentCategories}
              onCategoryAdd={handleCategoryAdd}
              onCategoryRemove={handleCategoryRemove}
              searchValue={categorySearch}
              onSearchChange={setCategorySearch}
              enabledSites={currentEnabledSites}
              disabled={isFormLoading || currentEnabledSites.length === 0}
              maxSelections={10}
              placeholder={
                currentEnabledSites.length === 0
                  ? 'Select sites first...'
                  : 'Search for categories...'
              }
            />
          </FormField>
        </Section>

        {/* Rules Section */}
        <Section icon={<FilterIcon />} title="Rules">
          <div {...dataCy('rule-builder')}>
            <RuleBuilder
              rules={currentRules as (FilterRule | FilterRuleGroup)[]}
              onRulesChange={handleRulesChange}
              availableFields={availableFields}
              operators={OPERATOR_DEFINITIONS}
              disabled={isFormLoading}
            />
          </div>
          {errors.rules && (
            <div
              className={styles.createFilterForm.fieldError}
              {...dataCy('filter-rules-error')}
            >
              At least one rule must be configured
            </div>
          )}
        </Section>

        {/* Notifications Section */}
        <Section icon={<BellIcon />} title="Notifications">
          <Controller
            name="notifications"
            control={control}
            render={({ field }) => (
              <div {...dataCy('notification-settings')}>
                <NotificationSettingsComponent
                  settings={field.value}
                  onSettingsChange={field.onChange}
                  disabled={isFormLoading}
                />
              </div>
            )}
          />
        </Section>

        {/* Form Actions */}
        <div className={styles.createFilterForm.actions}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isFormLoading}
            disabled={isFormLoading}
            onClick={() => {}}
            {...dataCy(
              isEditMode ? 'update-filter-submit' : 'create-filter-submit'
            )}
          >
            {isEditMode ? 'Update Filter' : 'Create Filter'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateFilterForm;
