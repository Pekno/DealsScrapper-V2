/**
 * useFilterForm - Custom hook for filter form business logic
 * Handles form state, validation, submission, and data transformation
 */

import { useState, useCallback, useEffect } from 'react';
import { useForm, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FilterRule,
  FilterRuleGroup,
  RuleBasedFilterExpression,
  Category,
  CreateFilterRequest as ApiCreateFilterRequest,
  UpdateFilterRequest,
} from '@/features/filters/types/filter.types';

// Form validation schema using Zod
const createFilterSchema = z.object({
  name: z
    .string()
    .min(1, 'Filter name is required')
    .max(100, 'Filter name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  enabledSites: z
    .array(z.string())
    .min(1, 'At least one site must be selected')
    .default(['dealabs']),
  categories: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        siteId: z.string(), // 'dealabs' | 'vinted' | 'leboncoin'
        sourceUrl: z.string(), // Original category page URL
        parentId: z.string().nullable().optional(),
        level: z.number(),
        description: z.string().nullable().optional(),
        dealCount: z.number(),
        avgTemperature: z.number(),
        popularBrands: z.array(z.string()),
        isActive: z.boolean(),
        userCount: z.number(),
        createdAt: z.union([z.date(), z.string()]).transform((val) => {
          if (typeof val === 'string') {
            const date = new Date(val);
            return isNaN(date.getTime()) ? new Date() : date;
          }
          return val instanceof Date ? val : new Date();
        }),
        updatedAt: z.union([z.date(), z.string()]).transform((val) => {
          if (typeof val === 'string') {
            const date = new Date(val);
            return isNaN(date.getTime()) ? new Date() : date;
          }
          return val instanceof Date ? val : new Date();
        }),
        color: z.string().optional(),
      })
    )
    .min(1, 'At least one category must be selected'),
  rules: z
    .array(
      z.union([
        // FilterRule
        z.object({
          field: z.string(),
          operator: z.string(),
          value: z.union([
            z.string(),
            z.number(),
            z.boolean(),
            z.array(z.string()),
            z.array(z.number()),
          ]),
          weight: z.number().optional(),
          caseSensitive: z.boolean().optional(),
          siteSpecific: z.string().optional(),
        }),
        // FilterRuleGroup
        z.object({
          logic: z.enum(['AND', 'OR', 'NOT']),
          rules: z.array(z.unknown()),
          weight: z.number().optional(),
        }),
      ])
    )
    .min(1, 'At least one rule must be configured')
    .refine(
      (rules) => {
        // Validate each rule
        for (const rule of rules) {
          // Skip rule groups (they have logic property)
          if ('logic' in rule) continue;

          // Validate regular rules
          if (!rule.field || rule.field.trim() === '') {
            return false;
          }
          if (!rule.operator || rule.operator.trim() === '') {
            return false;
          }
          if (rule.value === undefined || rule.value === null) {
            return false;
          }
          // Check for empty string values
          if (typeof rule.value === 'string' && rule.value.trim() === '') {
            return false;
          }
        }
        return true;
      },
      {
        message:
          'All rules must have valid field, operator, and non-empty value',
      }
    ),
  notifications: z.object({
    immediate: z.boolean(),
    dailyDigest: z.boolean(),
    weeklyDigest: z.boolean(),
    monthlyDigest: z.boolean(),
  }),
});

export type CreateFilterFormData = z.infer<typeof createFilterSchema>;

export interface UseFilterFormParams {
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
}

export interface UseFilterFormResult {
  // Form state
  form: UseFormReturn<CreateFilterFormData>;

  // Category search state
  categorySearch: string;
  setCategorySearch: (value: string) => void;

  // Watched values
  currentCategories: Category[];
  currentRules: (FilterRule | FilterRuleGroup)[];
  currentEnabledSites: string[];

  // Submission state
  isFormLoading: boolean;

  // Actions
  handleFormSubmit: (data: CreateFilterFormData) => void;
  handleCategoryAdd: (category: Category) => void;
  handleCategoryRemove: (categoryId: string) => void;
  handleRulesChange: (newRules: (FilterRule | FilterRuleGroup)[]) => void;
  handleSitesChange: (newSites: string[]) => void;
}

/**
 * Custom hook for managing filter form state and logic
 */
export function useFilterForm(
  params: UseFilterFormParams
): UseFilterFormResult {
  const {
    onSubmit,
    onUpdate,
    initialData = {},
    filterId,
    isEditMode = false,
    loading = false,
  } = params;

  const [categorySearch, setCategorySearch] = useState('');

  // Initialize form with react-hook-form
  const form = useForm<CreateFilterFormData>({
    resolver: zodResolver(createFilterSchema),
    defaultValues: {
      name: '',
      description: '',
      enabledSites: ['dealabs'],
      categories: [],
      rules: [{ field: 'price', operator: '<=', value: 100, weight: 1.0 }],
      notifications: {
        immediate: true,
        dailyDigest: false,
        weeklyDigest: false,
        monthlyDigest: false,
      },
    },
  });

  const {
    formState: { isSubmitting },
    watch,
    setValue,
    trigger,
    reset,
  } = form;

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      reset({
        name: initialData.name || '',
        description: initialData.description || '',
        enabledSites: initialData.enabledSites || ['dealabs'],
        categories: initialData.categories || [],
        rules: initialData.rules || [
          { field: 'price', operator: '<=', value: 100, weight: 1.0 },
        ],
        notifications: initialData.notifications || {
          immediate: true,
          dailyDigest: false,
          weeklyDigest: false,
          monthlyDigest: false,
        },
      });
    }
  }, [initialData, reset]);

  const currentCategories = watch('categories') as Category[];
  // Cast rules to FilterRule | FilterRuleGroup array - Zod schema is more permissive for validation
  const currentRules = watch('rules') as (FilterRule | FilterRuleGroup)[];
  const currentEnabledSites = watch('enabledSites') as string[];

  // Handle form submission
  const handleFormSubmit = useCallback(
    (data: CreateFilterFormData) => {
      // Transform rules array into RuleBasedFilterExpression
      // Preserve both FilterRule and FilterRuleGroup structures
      const filterExpression: RuleBasedFilterExpression = {
        rules: data.rules.map((rule): FilterRule | FilterRuleGroup => {
          // Type guard: Check if this is a FilterRuleGroup (has 'logic' property)
          if ('logic' in rule) {
            return {
              logic: rule.logic,
              rules: rule.rules as FilterRuleGroup['rules'],
              weight: rule.weight || 1.0,
            };
          } else {
            // This is a FilterRule
            const filterRule: FilterRule = {
              field: rule.field as FilterRule['field'],
              operator: rule.operator as FilterRule['operator'],
              value: rule.value as FilterRule['value'],
              weight: rule.weight || 1.0,
              caseSensitive: rule.caseSensitive || false,
            };
            // Include siteSpecific if set (required for site-specific fields)
            if (rule.siteSpecific) {
              filterRule.siteSpecific = rule.siteSpecific;
            }
            return filterRule;
          }
        }),
        matchLogic: 'AND',
        minScore: 0,
        scoreMode: 'weighted',
      };

      if (isEditMode && onUpdate && filterId) {
        const updateData: UpdateFilterRequest = {
          name: data.name,
          description: data.description,
          categoryIds: data.categories.map((cat) => cat.id),
          // enabledSites derived from categories by backend - not sent in request
          filterExpression,
          active: true,
          immediateNotifications: data.notifications.immediate,
          digestFrequency: data.notifications.dailyDigest
            ? 'daily'
            : data.notifications.weeklyDigest
              ? 'weekly'
              : 'disabled',
          maxNotificationsPerDay: 50,
        };

        onUpdate(filterId, updateData);
      } else if (onSubmit) {
        const submitData: ApiCreateFilterRequest = {
          name: data.name,
          description: data.description,
          categoryIds: data.categories.map((cat) => cat.id),
          // enabledSites derived from categories by backend - not sent in request
          filterExpression,
          active: true,
          immediateNotifications: data.notifications.immediate,
          digestFrequency: data.notifications.dailyDigest
            ? 'daily'
            : data.notifications.weeklyDigest
              ? 'weekly'
              : 'disabled',
          maxNotificationsPerDay: 50,
        };

        onSubmit(submitData);
      }
    },
    [onSubmit, onUpdate, isEditMode, filterId]
  );

  // Handle category changes
  const handleCategoryAdd = useCallback(
    (category: Category) => {
      const updatedCategories = [...currentCategories, category];
      setValue('categories', updatedCategories);
      trigger('categories');
    },
    [currentCategories, setValue, trigger]
  );

  const handleCategoryRemove = useCallback(
    (categoryId: string) => {
      const updatedCategories = currentCategories.filter(
        (cat) => cat.id !== categoryId
      );
      setValue('categories', updatedCategories);
      trigger('categories');
    },
    [currentCategories, setValue, trigger]
  );

  // Handle rules changes
  const handleRulesChange = useCallback(
    (newRules: (FilterRule | FilterRuleGroup)[]) => {
      setValue('rules', newRules);
      trigger('rules');
    },
    [setValue, trigger]
  );

  // Handle site changes - remove categories from deselected sites
  const handleSitesChange = useCallback(
    (newSites: string[]) => {
      // Filter out categories that don't belong to the new enabled sites
      const filteredCategories = currentCategories.filter((cat) =>
        newSites.includes(cat.siteId)
      );
      if (filteredCategories.length !== currentCategories.length) {
        setValue('categories', filteredCategories);
        trigger('categories');
      }
    },
    [currentCategories, setValue, trigger]
  );

  const isFormLoading = loading || isSubmitting;

  return {
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
  };
}
