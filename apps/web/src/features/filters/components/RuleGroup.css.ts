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
  successGreen: '#10B981',
  successGreenLight: '#F0FDF4',
};

// Enhanced rule group container with visual hierarchy
export const ruleGroupContainer = styleVariants({
  level0: {
    position: 'relative',
    padding: '20px',
    borderLeft: `3px solid ${colors.primary}`,
    background: colors.secondary,
    borderRadius: '12px',
    marginBottom: '16px',
    boxShadow: '0 2px 4px 0 rgba(0, 0, 0, 0.05)',

    // Enhanced visual separation
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: '-3px',
      width: '3px',
      height: '100%',
      background: `linear-gradient(180deg, ${colors.primary} 0%, ${colors.accentBlue} 100%)`,
      borderRadius: '0 2px 2px 0',
    },
  },
  level1: {
    position: 'relative',
    padding: '16px',
    borderLeft: `2px dashed ${colors.borderGray}`,
    background: `${colors.secondary}CC`, // 80% opacity
    borderRadius: '8px',
    marginLeft: '24px',
    marginBottom: '12px',

    // Subtle inner shadow for depth
    boxShadow: 'inset 0 1px 3px 0 rgba(0, 0, 0, 0.1)',

    // Visual nesting indication
    '::before': {
      content: '""',
      position: 'absolute',
      top: 16,
      left: -14,
      width: 12,
      height: 2,
      background: colors.borderGray,
      borderRadius: '1px',
    },
  },
  level2: {
    position: 'relative',
    padding: '12px',
    borderLeft: `1px dashed ${colors.borderGray}`,
    background: `${colors.lightGray}E6`, // 90% opacity
    borderRadius: '6px',
    marginLeft: '36px',
    marginBottom: '8px',

    '::before': {
      content: '""',
      position: 'absolute',
      top: 12,
      left: -8,
      width: 6,
      height: 1,
      background: colors.borderGray,
      borderRadius: '0.5px',
    },
  },
});

// Individual rule item styling with enhanced visual design
export const ruleItem = style({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 2fr auto',
  gap: '12px',
  alignItems: 'center',
  padding: '16px',
  background: colors.background,
  border: `1px solid ${colors.borderGray}`,
  borderRadius: '8px',
  marginBottom: '8px',
  transition: 'all 0.3s ease-in-out',
  position: 'relative',

  // Enhanced hover effect
  ':hover': {
    borderColor: colors.primary,
    boxShadow:
      '0 4px 12px -2px rgba(15, 98, 254, 0.15), 0 2px 6px -1px rgba(15, 98, 254, 0.1)',
    transform: 'translateY(-1px)',
  },

  // Focus-within for keyboard navigation
  ':focus-within': {
    borderColor: colors.primary,
    boxShadow: `0 0 0 3px ${colors.accentBlue}`,
  },

  '@media': {
    '(max-width: 768px)': {
      gridTemplateColumns: '1fr',
      gap: '12px',
      padding: '12px',
    },
  },
});

// NOT rule wrapper with distinctive styling
export const notRuleWrapper = style({
  position: 'relative',
  padding: '12px',
  background: colors.dangerRedLight,
  border: `1px solid ${colors.dangerRed}40`, // 25% opacity
  borderRadius: '8px',
  marginBottom: '8px',

  '::before': {
    content: '"NOT"',
    position: 'absolute',
    top: '-8px',
    left: '12px',
    padding: '2px 8px',
    background: colors.dangerRed,
    color: colors.background,
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderRadius: '4px',
  },
});

// Regular rule wrapper
export const ruleWrapper = style({
  position: 'relative',
});

// Logical connector between rules
export const logicalConnector = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: '8px',
  marginBottom: '8px',
  position: 'relative',

  '::before': {
    content: '""',
    position: 'absolute',
    width: '100%',
    height: '1px',
    background: `linear-gradient(90deg, transparent 0%, ${colors.borderGray} 50%, transparent 100%)`,
    zIndex: 1,
  },
});

export const logicalConnectorText = style({
  padding: '4px 12px',
  background: colors.background,
  border: `1px solid ${colors.borderGray}`,
  borderRadius: '12px',
  fontSize: '11px',
  fontWeight: '600',
  color: colors.secondaryText,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  zIndex: 2,
  position: 'relative',
});

// Group header styling
export const ruleGroupHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '16px',
  paddingBottom: '12px',
  borderBottom: `1px solid ${colors.borderGray}20`, // 12.5% opacity
});

// Nesting level indicator
export const nestingIndicator = style({
  padding: '2px 8px',
  background: colors.accentBlue,
  border: `1px solid ${colors.primary}30`, // 18.75% opacity
  borderRadius: '6px',
  fontSize: '10px',
  fontWeight: '600',
  color: colors.primary,
});

// NOT group specific styling
export const notGroupInfo = style({
  padding: '8px 12px',
  background: colors.dangerRedLight,
  border: `1px solid ${colors.dangerRed}30`, // 18.75% opacity
  borderRadius: '6px',
  marginBottom: '12px',
});

export const notIndicator = style({
  padding: '2px 6px',
  background: colors.dangerRed,
  color: colors.background,
  fontSize: '10px',
  fontWeight: '700',
  textTransform: 'uppercase',
  borderRadius: '4px',
  letterSpacing: '0.05em',
});

// Validation errors display
export const validationErrors = style({
  padding: '12px',
  background: colors.dangerRedLight,
  border: `1px solid ${colors.dangerRed}50`, // 31.25% opacity
  borderRadius: '8px',
  marginBottom: '12px',
});

// Action buttons section
export const ruleGroupActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  paddingTop: '16px',
  borderTop: `1px solid ${colors.borderGray}30`, // 18.75% opacity
  marginTop: '16px',
});

// Validate button
export const validateButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 14px',
  background: colors.successGreenLight,
  border: `1px solid ${colors.successGreen}60`, // 37.5% opacity
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: '500',
  color: colors.successGreen,
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',

  ':hover': {
    background: colors.successGreen,
    color: colors.background,
    borderColor: colors.successGreen,
  },

  ':disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
    pointerEvents: 'none',
  },
});

// Debug information styling
export const debugInfo = style({
  marginTop: '16px',
  padding: '12px',
  background: colors.lightGray,
  border: `1px solid ${colors.borderGray}`,
  borderRadius: '6px',
  fontSize: '12px',
});

// Enhanced animations
const fadeIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateY(-8px) scale(0.98)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
  },
});

const slideIn = keyframes({
  '0%': {
    opacity: 0,
    transform: 'translateX(-12px)',
    filter: 'blur(2px)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateX(0)',
    filter: 'blur(0)',
  },
});

const pulse = keyframes({
  '0%, 100%': {
    opacity: 1,
    transform: 'scale(1)',
  },
  '50%': {
    opacity: 0.8,
    transform: 'scale(1.02)',
  },
});

// Animation classes
export const fadeInAnimation = style({
  animation: `${fadeIn} 0.4s cubic-bezier(0.4, 0, 0.2, 1)`,
});

export const slideInAnimation = style({
  animation: `${slideIn} 0.5s cubic-bezier(0.4, 0, 0.2, 1)`,
});

export const pulseAnimation = style({
  animation: `${pulse} 1.5s ease-in-out infinite`,
});

// State styles
export const errorState = style({
  border: `2px solid ${colors.dangerRed}`,
  background: colors.dangerRedLight,

  ':hover': {
    borderColor: colors.dangerRed,
    boxShadow: `0 4px 12px -2px ${colors.dangerRed}30, 0 2px 6px -1px ${colors.dangerRed}20`,
  },
});

export const disabledState = style({
  opacity: 0.6,
  cursor: 'not-allowed',
  pointerEvents: 'none',
  filter: 'grayscale(20%)',
});

// Drag and drop enhancements
export const draggableRule = style({
  cursor: 'move',
  transition: 'all 0.2s ease-in-out',

  ':hover': {
    cursor: 'grab',
    transform: 'scale(1.01)',
  },

  ':active': {
    cursor: 'grabbing',
    transform: 'scale(1.02)',
    zIndex: 1000,
  },
});

export const dragPreview = style({
  opacity: 0.9,
  transform: 'rotate(2deg) scale(1.05)',
  boxShadow:
    '0 20px 40px -8px rgba(0, 0, 0, 0.25), 0 8px 16px -4px rgba(0, 0, 0, 0.1)',
  filter: 'saturate(1.2)',
});

export const dropZone = style({
  position: 'relative',
  transition: 'all 0.3s ease-in-out',

  '::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.accentBlue} 100%)`,
    borderRadius: '2px',
    opacity: 0,
    transform: 'scaleX(0)',
    transformOrigin: 'center',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
});

export const dropZoneActive = style({
  background: `${colors.accentBlue}40`, // 25% opacity

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

// Responsive utilities for enhanced mobile experience
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

// Enhanced mobile styles
export const mobileOptimized = style({
  '@media': {
    '(max-width: 768px)': {
      padding: '12px',
      fontSize: '14px',
    },
  },
});

// Mobile button optimization
export const mobileButton = style({
  '@media': {
    '(max-width: 768px)': {
      minHeight: '44px',
      minWidth: '44px',
    },
  },
});

// Accessibility enhancements
export const accessibilityEnhanced = style({
  // High contrast support
  '@media': {
    '(prefers-contrast: high)': {
      borderColor: 'currentColor',
      background: 'Canvas',
      color: 'CanvasText',
    },

    // Reduced motion support
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
      animation: 'none',
    },

    // Focus visible enhancement
    '(focus-visible)': {
      outline: `2px solid ${colors.primary}`,
      outlineOffset: '2px',
    },
  },
});
