/**
 * Dropdown component styles using Vanilla Extract
 * Following the design system from Button and Section components
 */
import {
  style,
  styleVariants,
  keyframes,
  globalStyle,
} from '@vanilla-extract/css';

// Color palette consistent with the design system
const colors = {
  primary: '#0F62FE',
  primaryHover: '#0D5CE8',
  primaryActive: '#0B52D1',
  background: '#FFFFFF',
  backgroundSecondary: '#F0F4F8',
  backgroundGray: '#F9FAFB',
  backgroundHover: '#E5E7EB',
  primaryText: '#1F2937',
  secondaryText: '#6B7280',
  accentBlue: '#E0E7FF',
  borderGray: '#D1D5DB',
  borderLight: '#E5E7EB',
  dangerRed: '#EF4444',
  dangerRedLight: '#FEF2F2',
  successGreen: '#10B981',
  warningOrange: '#F59E0B',
};

// Animations - Define keyframes before usage
const fadeIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(-4px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

const slideDown = keyframes({
  '0%': {
    opacity: 0,
    transform: 'scaleY(0.95) translateY(-8px)',
  },
  '100%': {
    opacity: 1,
    transform: 'scaleY(1) translateY(0)',
  },
});

const spinAnimation = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

// Base dropdown container
export const dropdownContainer = style({
  position: 'relative',
  display: 'inline-block',
  width: '100%',
});

// Dropdown trigger button base style
const baseTrigger = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '0.75rem 1rem',
  backgroundColor: colors.background,
  border: `1px solid ${colors.borderGray}`,
  borderRadius: '0.5rem', // rounded-lg
  fontSize: '1rem',
  lineHeight: '1.5rem',
  color: colors.primaryText,
  cursor: 'pointer',
  outline: 'none',
  transition: 'all 0.2s ease-in-out',
  fontFamily: 'inherit',
  textAlign: 'left',
  gap: '0.5rem',

  ':focus': {
    borderColor: colors.primary,
    boxShadow: `0 0 0 2px ${colors.accentBlue}`,
  },

  selectors: {
    '&:hover:not(:disabled)': {
      borderColor: colors.primary,
      backgroundColor: colors.backgroundGray,
    },
  },
});

// Dropdown trigger variants
export const dropdownTrigger = styleVariants({
  default: [baseTrigger],

  open: [
    baseTrigger,
    {
      borderColor: colors.primary,
      backgroundColor: colors.backgroundGray,
      boxShadow: `0 0 0 2px ${colors.accentBlue}`,
    },
  ],

  error: [
    baseTrigger,
    {
      borderColor: colors.dangerRed,
      backgroundColor: colors.dangerRedLight,

      ':focus': {
        borderColor: colors.dangerRed,
        boxShadow: `0 0 0 2px rgba(239, 68, 68, 0.2)`,
      },
    },
  ],

  disabled: [
    baseTrigger,
    {
      opacity: 0.6,
      cursor: 'not-allowed',
      backgroundColor: colors.backgroundSecondary,
    },
  ],
});

// Dropdown trigger content
export const triggerContent = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  overflow: 'hidden',
});

export const triggerText = style({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const triggerPlaceholder = style({
  color: colors.secondaryText,
});

export const triggerIcon = style({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

// Chevron icon for dropdown
export const chevronIcon = style({
  width: '1.25rem',
  height: '1.25rem',
  color: colors.secondaryText,
  transition: 'transform 0.2s ease-in-out',
  flexShrink: 0,
});

export const chevronOpen = style({
  transform: 'rotate(180deg)',
});

// Dropdown menu
export const dropdownMenu = style({
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 50,
  marginTop: '0.25rem',
  backgroundColor: colors.background,
  borderRadius: '0.5rem',
  border: `1px solid ${colors.borderLight}`,
  boxShadow:
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  maxHeight: '20rem', // 320px - increased for better visibility
  overflowY: 'auto',
  animation: `${fadeIn} 0.15s ease-out`,
});

// Search input container
export const searchContainer = style({
  padding: '0.75rem',
  borderBottom: `1px solid ${colors.borderLight}`,
  position: 'sticky',
  top: 0,
  backgroundColor: colors.background,
  zIndex: 1,
});

export const searchInput = style({
  width: '100%',
  padding: '0.5rem 0.75rem',
  backgroundColor: colors.backgroundGray,
  border: `1px solid ${colors.borderGray}`,
  borderRadius: '0.375rem',
  fontSize: '0.875rem',
  color: colors.primaryText,
  outline: 'none',
  transition: 'all 0.2s ease-in-out',

  ':focus': {
    borderColor: colors.primary,
    backgroundColor: colors.background,
    boxShadow: `0 0 0 2px ${colors.accentBlue}`,
  },

  '::placeholder': {
    color: colors.secondaryText,
  },
});

// Menu options container
export const menuOptions = style({
  maxHeight: 'calc(20rem - 4rem)', // Account for search container height
  overflowY: 'auto',
  paddingTop: '0.25rem',
  paddingBottom: '0.25rem',
});

// Individual option styles
const baseOption = style({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '0.75rem 1rem',
  fontSize: '1rem',
  color: colors.primaryText,
  cursor: 'pointer',
  border: 'none',
  background: 'transparent',
  textAlign: 'left',
  gap: '0.5rem',
  transition: 'background-color 0.15s ease-in-out',

  ':hover': {
    backgroundColor: colors.backgroundGray,
  },

  ':focus': {
    outline: 'none',
    backgroundColor: colors.backgroundGray,
  },
});

export const dropdownOption = styleVariants({
  default: [baseOption],

  selected: [
    baseOption,
    {
      backgroundColor: colors.accentBlue,
      color: colors.primary,
      fontWeight: '500',

      ':hover': {
        backgroundColor: colors.accentBlue,
      },
    },
  ],

  disabled: [
    baseOption,
    {
      opacity: 0.5,
      cursor: 'not-allowed',

      ':hover': {
        backgroundColor: 'transparent',
      },
    },
  ],

  group: [
    baseOption,
    {
      fontWeight: '600',
      fontSize: '0.875rem',
      color: colors.secondaryText,
      cursor: 'default',
      textTransform: 'uppercase',
      letterSpacing: '0.025em',
      paddingTop: '0.5rem',
      paddingBottom: '0.5rem',

      ':hover': {
        backgroundColor: 'transparent',
      },
    },
  ],
});

// Option content
export const optionContent = style({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  overflow: 'hidden',
});

export const optionText = style({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const optionDescription = style({
  fontSize: '0.875rem',
  color: colors.secondaryText,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const optionIcon = style({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.25rem',
  height: '1.25rem',
});

// Check mark for selected options
export const checkIcon = style({
  width: '1rem',
  height: '1rem',
  color: colors.primary,
  flexShrink: 0,
});

// Loading state
export const loadingContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  color: colors.secondaryText,
  fontSize: '0.875rem',
});

export const loadingSpinner = style({
  width: '1rem',
  height: '1rem',
  border: `2px solid ${colors.borderGray}`,
  borderTop: `2px solid ${colors.primary}`,
  borderRadius: '50%',
  animation: `${spinAnimation} 1s linear infinite`,
  marginRight: '0.5rem',
});

// Empty state
export const emptyState = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem 1rem',
  color: colors.secondaryText,
  fontSize: '0.875rem',
  fontStyle: 'italic',
  textAlign: 'center',
});

// Multiple selection styles
export const multiSelectContainer = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.25rem',
  minHeight: '1.5rem',
});

export const selectedTag = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.125rem 0.5rem',
  backgroundColor: colors.accentBlue,
  color: colors.primary,
  borderRadius: '9999px',
  fontSize: '0.875rem',
  fontWeight: '500',
});

export const tagRemoveButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1rem',
  height: '1rem',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '50%',
  cursor: 'pointer',
  color: colors.primary,
  transition: 'background-color 0.15s ease-in-out',

  ':hover': {
    backgroundColor: colors.primary,
    color: colors.background,
  },
});

// Error message
export const errorMessage = style({
  marginTop: '0.25rem',
  fontSize: '0.875rem',
  color: colors.dangerRed,
  fontWeight: '500',
});

// Size variants
export const sizeVariants = styleVariants({
  sm: {
    fontSize: '0.875rem',
    padding: '0.5rem 0.75rem',
  },

  md: {
    fontSize: '1rem',
    padding: '0.75rem 1rem',
  },

  lg: {
    fontSize: '1.125rem',
    padding: '1rem 1.25rem',
  },
});

// Prevent body scroll when dropdown is open on mobile
globalStyle('body.dropdown-open', {
  '@media': {
    '(max-width: 768px)': {
      overflow: 'hidden',
    },
  },
});

// Mobile-specific styles
export const mobileMenu = style({
  '@media': {
    '(max-width: 768px)': {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 100,
      backgroundColor: colors.background,
      borderRadius: 0,
      border: 'none',
      boxShadow: 'none',
      maxHeight: 'none',
      animation: `${slideDown} 0.2s ease-out`,
    },
  },
});

export const mobileHeader = style({
  '@media': {
    '(max-width: 768px)': {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '1rem',
      borderBottom: `1px solid ${colors.borderLight}`,
      position: 'sticky',
      top: 0,
      backgroundColor: colors.background,
      zIndex: 2,
    },
  },
});

export const mobileTitle = style({
  fontSize: '1.125rem',
  fontWeight: '600',
  color: colors.primaryText,
});

export const mobileCloseButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '2rem',
  height: '2rem',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  color: colors.secondaryText,
  transition: 'all 0.15s ease-in-out',

  ':hover': {
    backgroundColor: colors.backgroundGray,
    color: colors.primaryText,
  },
});
