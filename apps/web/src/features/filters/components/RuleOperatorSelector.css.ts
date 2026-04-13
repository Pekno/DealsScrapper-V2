import { style, styleVariants, keyframes } from '@vanilla-extract/css';

// Color palette consistent with the application design system
const colors = {
  primary: '#0F62FE',
  secondary: '#F0F4F8',
  background: '#FFFFFF',
  primaryText: '#1F2937',
  secondaryText: '#6B7280',
  accentBlue: '#E0E7FF',
  borderGray: '#D1D5DB',
  lightGray: '#F9FAFB',
  dangerRed: '#EF4444',
  dangerRedLight: '#FEF2F2',
  warningOrange: '#F59E0B',
  successGreen: '#10B981',
  infoBlue: '#3B82F6',
  purpleAccent: '#8B5CF6',

  // Operator group colors
  comparisonColor: '#0F62FE',
  textColor: '#10B981',
  logicColor: '#8B5CF6',
  arrayColor: '#F59E0B',
  dateColor: '#EF4444',
};

// Main container for the operator selector
export const operatorSelectorContainer = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

// Base operator select styling
export const operatorSelect = style({
  width: '100%',
  minWidth: '160px',
  padding: '10px 36px 10px 12px',
  background: `${colors.background} url("data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>')}")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 8px center',
  backgroundSize: '20px 20px',
  border: `2px solid ${colors.borderGray}`,
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: '500',
  color: colors.primaryText,
  outline: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',

  ':focus': {
    borderColor: colors.primary,
    boxShadow: `0 0 0 3px ${colors.accentBlue}`,
    backgroundColor: colors.lightGray,
  },

  selectors: {
    '&:hover:not(:disabled)': {
      borderColor: colors.primary,
      backgroundColor: colors.lightGray,
      transform: 'translateY(-1px)',
      boxShadow: '0 4px 12px -4px rgba(15, 98, 254, 0.15)',
    },
  },
});

// Compact variant for smaller spaces
export const compact = style({
  minWidth: '100px',
  padding: '6px 28px 6px 8px',
  fontSize: '12px',
  backgroundSize: '16px 16px',
  backgroundPosition: 'right 6px center',
});

// Operator option styling
export const operatorOption = style({
  padding: '8px 12px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '14px',
  lineHeight: '1.4',

  ':hover': {
    backgroundColor: colors.accentBlue,
    color: colors.primary,
  },

  selectors: {
    '&:selected': {
      backgroundColor: colors.primary,
      color: colors.background,
      fontWeight: '600',
    },
  },
});

// Separator option for grouping
export const separatorOption = style({
  padding: '4px 12px',
  fontSize: '10px',
  color: colors.secondaryText,
  backgroundColor: colors.lightGray,
  fontWeight: '300',
  textAlign: 'center',
  borderTop: `1px solid ${colors.borderGray}`,
  borderBottom: `1px solid ${colors.borderGray}`,
});

// Field type hint
export const fieldTypeHint = style({
  fontSize: '12px',
  color: colors.secondaryText,
  fontWeight: '400',
  fontStyle: 'italic',
  marginTop: '2px',
  paddingLeft: '4px',
  display: 'block',

  '@media': {
    '(max-width: 768px)': {
      display: 'none',
    },
  },
});

// Operator description tooltip
export const operatorDescription = style({
  position: 'absolute',
  top: '100%',
  left: '0',
  right: '0',
  marginTop: '4px',
  padding: '8px 12px',
  backgroundColor: colors.primaryText,
  color: colors.background,
  fontSize: '12px',
  borderRadius: '6px',
  boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.15)',
  zIndex: 10,
  opacity: 0,
  transform: 'translateY(-8px)',
  transition: 'all 0.2s ease-in-out',
  pointerEvents: 'none',

  '::after': {
    content: '""',
    position: 'absolute',
    bottom: '100%',
    left: '12px',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderBottom: `6px solid ${colors.primaryText}`,
  },

  selectors: {
    [`${operatorSelectorContainer}:hover &, ${operatorSelectorContainer}:focus-within &`]: {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
});

// State variants
export const disabledState = style({
  opacity: 0.6,
  cursor: 'not-allowed',
  backgroundColor: colors.lightGray,
  color: colors.secondaryText,

  ':hover': {
    transform: 'none',
    boxShadow: 'none',
    borderColor: colors.borderGray,
    backgroundColor: colors.lightGray,
  },
});

export const errorState = style({
  borderColor: colors.dangerRed,
  backgroundColor: colors.dangerRedLight,
  color: colors.dangerRed,

  ':focus': {
    borderColor: colors.dangerRed,
    boxShadow: `0 0 0 3px rgba(239, 68, 68, 0.1)`,
  },

  selectors: {
    '&:hover:not(:disabled)': {
      borderColor: colors.dangerRed,
      backgroundColor: colors.dangerRedLight,
    },
  },
});

// Loading animation for dynamic operator loading
const pulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.5 },
});

export const loadingState = style({
  animation: `${pulse} 1.5s ease-in-out infinite`,
  backgroundColor: colors.lightGray,
  cursor: 'wait',
});

// Enhanced select with operator group colors
export const operatorSelectVariants = styleVariants({
  default: [operatorSelect],
  comparison: [
    operatorSelect,
    {
      borderLeftColor: colors.comparisonColor,
      borderLeftWidth: '4px',
    },
  ],
  text: [
    operatorSelect,
    {
      borderLeftColor: colors.textColor,
      borderLeftWidth: '4px',
    },
  ],
  logic: [
    operatorSelect,
    {
      borderLeftColor: colors.logicColor,
      borderLeftWidth: '4px',
    },
  ],
  array: [
    operatorSelect,
    {
      borderLeftColor: colors.arrayColor,
      borderLeftWidth: '4px',
    },
  ],
  date: [
    operatorSelect,
    {
      borderLeftColor: colors.dateColor,
      borderLeftWidth: '4px',
    },
  ],
});

// Icon variants for different operator types
export const operatorIcon = styleVariants({
  comparison: {
    color: colors.comparisonColor,
    fontWeight: 'bold',
    marginRight: '8px',
  },
  text: {
    color: colors.textColor,
    fontWeight: 'bold',
    marginRight: '8px',
  },
  logic: {
    color: colors.logicColor,
    fontWeight: 'bold',
    marginRight: '8px',
  },
  array: {
    color: colors.arrayColor,
    fontWeight: 'bold',
    marginRight: '8px',
  },
  date: {
    color: colors.dateColor,
    fontWeight: 'bold',
    marginRight: '8px',
  },
});

// Responsive behavior
export const mobileOperatorSelect = style([
  operatorSelect,
  {
    '@media': {
      '(max-width: 768px)': {
        fontSize: '16px', // Prevent zoom on iOS
        minWidth: '120px',
        padding: '12px 32px 12px 10px',
      },
    },
  },
]);

// Focus ring enhancement for accessibility
export const accessibleFocus = style({
  ':focus-visible': {
    outline: `2px solid ${colors.primary}`,
    outlineOffset: '2px',
    borderColor: colors.primary,
  },
});

// High contrast mode support
export const highContrast = style({
  '@media': {
    '(prefers-contrast: high)': {
      border: `2px solid ${colors.primaryText}`,
      backgroundColor: colors.background,
      color: colors.primaryText,

      ':focus': {
        outline: `3px solid ${colors.primary}`,
        outlineOffset: '1px',
      },
    },
  },
});

// Animation for smooth transitions
const slideDown = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(-4px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

export const animatedEntry = style({
  animation: `${slideDown} 0.2s ease-out`,
});

// Enhanced option group styling (for future use with optgroup)
export const optionGroup = style({
  fontWeight: '600',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: colors.secondaryText,
  backgroundColor: colors.lightGray,
  padding: '6px 12px 4px 12px',
  borderTop: `1px solid ${colors.borderGray}`,
});

// Utility classes for different contexts
export const formIntegration = style({
  marginBottom: '0',

  selectors: {
    '&[aria-invalid="true"]': {
      borderColor: colors.dangerRed,
      backgroundColor: colors.dangerRedLight,
    },
  },
});

export const inlineOperatorSelect = style([
  operatorSelect,
  {
    display: 'inline-block',
    width: 'auto',
    minWidth: '140px',
    marginRight: '8px',
    marginBottom: '0',
  },
]);

// Dark mode support (for future implementation)
export const darkMode = style({
  '@media': {
    '(prefers-color-scheme: dark)': {
      backgroundColor: '#1F2937',
      borderColor: '#4B5563',
      color: '#F9FAFB',

      ':focus': {
        backgroundColor: '#374151',
        borderColor: '#60A5FA',
      },

      selectors: {
        '&:hover:not(:disabled)': {
          backgroundColor: '#374151',
          borderColor: '#60A5FA',
        },
      },
    },
  },
});
