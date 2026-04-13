import { style, styleVariants, keyframes } from '@vanilla-extract/css';

// Color palette from the mockup documentation
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
};

// Base container styles - minimal styling, designed to be styled by parent
export const ruleBuilderContainer = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
});

// Rule group container with visual hierarchy
export const ruleGroupContainer = styleVariants({
  level0: {
    position: 'relative',
    padding: '16px',
    borderLeft: `2px solid ${colors.primary}`,
    background: colors.secondary,
    borderRadius: '8px',
    marginBottom: '12px',
  },
  level1: {
    position: 'relative',
    padding: '12px',
    borderLeft: `2px dashed ${colors.borderGray}`,
    background: `${colors.secondary}80`, // 50% opacity
    borderRadius: '6px',
    marginLeft: '16px',
    marginBottom: '8px',
  },
  level2: {
    position: 'relative',
    padding: '8px',
    borderLeft: `1px dashed ${colors.borderGray}`,
    background: `${colors.lightGray}90`,
    borderRadius: '4px',
    marginLeft: '32px',
    marginBottom: '6px',
  },
});

// Individual rule item styling
export const ruleItem = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 2fr auto',
  gap: '12px',
  alignItems: 'center',
  padding: '12px',
  background: colors.background,
  border: `1px solid ${colors.borderGray}`,
  borderRadius: '8px',
  marginBottom: '8px',
  transition: 'all 0.2s ease-in-out',

  ':hover': {
    borderColor: colors.primary,
    boxShadow:
      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },

  '@media': {
    '(max-width: 768px)': {
      gridTemplateColumns: '1fr',
      gap: '8px',
    },
  },
});

// NOT rule variant
export const notRuleItem = style([
  ruleItem,
  {
    borderColor: colors.dangerRed,
    background: colors.dangerRedLight,

    ':hover': {
      borderColor: colors.dangerRed,
      boxShadow:
        '0 4px 6px -1px rgba(239, 68, 68, 0.1), 0 2px 4px -1px rgba(239, 68, 68, 0.06)',
    },
  },
]);

// Logical operator toggle buttons
export const logicalOperatorToggle = style({
  display: 'flex',
  background: colors.lightGray,
  borderRadius: '6px',
  padding: '4px',
  marginBottom: '12px',
});

export const logicalOperatorButton = styleVariants({
  inactive: {
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    fontWeight: '500',
    color: colors.secondaryText,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',

    ':hover': {
      background: colors.secondary,
      color: colors.primaryText,
    },
  },
  active: {
    padding: '8px 16px',
    background: colors.primary,
    border: 'none',
    borderRadius: '4px',
    fontWeight: '600',
    color: colors.background,
    cursor: 'pointer',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  not: {
    padding: '6px 12px',
    background: colors.dangerRed,
    border: 'none',
    borderRadius: '20px',
    fontWeight: '600',
    fontSize: '12px',
    color: colors.background,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
});

// Form field styles
export const fieldSelect = style({
  width: '100%',
  padding: '8px 12px',
  background: colors.background,
  border: `1px solid ${colors.borderGray}`,
  borderRadius: '6px',
  fontSize: '14px',
  color: colors.primaryText,
  outline: 'none',
  transition: 'all 0.2s ease-in-out',

  ':focus': {
    borderColor: colors.primary,
    boxShadow: `0 0 0 2px ${colors.accentBlue}`,
  },
});

export const operatorSelect = style([
  fieldSelect,
  {
    minWidth: '140px',
  },
]);

export const valueInput = style([
  fieldSelect,
  {
    flex: 1,
  },
]);

export const valueInputDouble = style({
  display: 'flex',
  gap: '8px',
  alignItems: 'center',

  '::before': {
    content: '"and"',
    fontSize: '12px',
    color: colors.secondaryText,
    fontWeight: '500',
  },
});

// Action buttons
export const actionButton = styleVariants({
  add: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: colors.secondary,
    border: `1px solid ${colors.borderGray}`,
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: colors.primaryText,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',

    ':hover': {
      background: colors.accentBlue,
      borderColor: colors.primary,
      color: colors.primary,
    },
  },
  addGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    background: colors.accentBlue,
    border: `1px solid ${colors.primary}`,
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: colors.primary,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',

    ':hover': {
      background: colors.primary,
      color: colors.background,
      boxShadow: '0 2px 4px 0 rgba(15, 98, 254, 0.2)',
    },
  },
  remove: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    background: 'transparent',
    border: `1px solid ${colors.borderGray}`,
    borderRadius: '6px',
    color: colors.secondaryText,
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',

    ':hover': {
      background: colors.dangerRedLight,
      borderColor: colors.dangerRed,
      color: colors.dangerRed,
    },
  },
});

// Control sections
export const ruleGroupHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '12px',
});

export const ruleGroupActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  paddingTop: '12px',
  borderTop: `1px solid ${colors.borderGray}`,
  marginTop: '12px',
});

// Animation keyframes
const fadeIn = keyframes({
  '0%': { opacity: 0, transform: 'translateY(-4px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

const slideIn = keyframes({
  '0%': { opacity: 0, transform: 'translateX(-8px)' },
  '100%': { opacity: 1, transform: 'translateX(0)' },
});

// Animation classes
export const fadeInAnimation = style({
  animation: `${fadeIn} 0.2s ease-out`,
});

export const slideInAnimation = style({
  animation: `${slideIn} 0.3s ease-out`,
});

// Drag and drop styles
export const draggableRule = style({
  cursor: 'move',

  ':hover': {
    cursor: 'grab',
  },

  ':active': {
    cursor: 'grabbing',
  },
});

export const dragPreview = style({
  opacity: 0.8,
  transform: 'rotate(2deg)',
  boxShadow:
    '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
});

export const dropZone = style({
  position: 'relative',

  '::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: colors.primary,
    borderRadius: '1px',
    opacity: 0,
    transform: 'scaleX(0)',
    transition: 'all 0.2s ease-in-out',
  },
});

export const dropZoneActive = style({
  '::after': {
    opacity: 1,
    transform: 'scaleX(1)',
  },
});

// Loading states
export const loadingSpinner = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

export const loadingState = style({
  display: 'inline-block',
  width: '16px',
  height: '16px',
  border: `2px solid ${colors.borderGray}`,
  borderTop: `2px solid ${colors.primary}`,
  borderRadius: '50%',
  animation: `${loadingSpinner} 1s linear infinite`,
});

// Error states
export const errorState = style({
  border: `1px solid ${colors.dangerRed}`,
  background: colors.dangerRedLight,
  color: colors.dangerRed,
});

export const errorText = style({
  fontSize: '12px',
  color: colors.dangerRed,
  marginTop: '4px',
  fontWeight: '500',
});

// Disabled states
export const disabledState = style({
  opacity: 0.6,
  cursor: 'not-allowed',
  pointerEvents: 'none',
});

// Responsive utilities
export const responsiveHide = styleVariants({
  mobile: {
    '@media': {
      '(max-width: 768px)': {
        display: 'none',
      },
    },
  },
  desktop: {
    '@media': {
      '(min-width: 769px)': {
        display: 'none',
      },
    },
  },
});

// Site indicator for site-specific fields
export const siteIndicator = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  flexShrink: 0,
  display: 'inline-block',
});

// Field option with site indicator container
export const fieldOptionContent = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flex: 1,
  overflow: 'hidden',
});

export const fieldOptionText = style({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
});

export const fieldOptionLabel = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const fieldOptionDescription = style({
  fontSize: '0.75rem',
  color: colors.secondaryText,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
