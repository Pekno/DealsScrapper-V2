/**
 * IconButton component styles using Vanilla Extract
 * Following the design system from the create filter mockup
 * Optimized for icon-only buttons with notification indicators
 */
import { style, styleVariants, keyframes } from '@vanilla-extract/css';

// Base button styles
const baseIconButton = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '0.5rem', // Slightly less rounded than regular buttons
  fontWeight: '500',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  fontFamily: 'inherit',
  textDecoration: 'none',
  outline: 'none',
  flexShrink: 0, // Prevent button from shrinking

  // Ensure minimum touch target size for accessibility
  minWidth: '2.75rem', // 44px minimum
  minHeight: '2.75rem', // 44px minimum

  ':focus-visible': {
    outline: '2px solid #0F62FE',
    outlineOffset: '2px',
  },

  ':disabled': {
    cursor: 'not-allowed',
    opacity: 0.6,
    transform: 'none !important',
  },

  // Smooth hover animations
  selectors: {
    '&:hover:not(:disabled)': {
      transform: 'translateY(-1px)',
    },

    '&:active:not(:disabled)': {
      transform: 'translateY(0px)',
    },
  },
});

// Button variant styles
const iconButtonVariants = styleVariants({
  default: [
    baseIconButton,
    {
      backgroundColor: '#0F62FE',
      color: 'white',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',

      selectors: {
        '&:hover:not(:disabled)': {
          backgroundColor: '#0D5CE8',
          boxShadow:
            '0 4px 8px -2px rgba(15, 98, 254, 0.2), 0 2px 4px -1px rgba(15, 98, 254, 0.1)',
          transform: 'translateY(-1px)',
        },

        '&:active:not(:disabled)': {
          backgroundColor: '#0B52D1',
          transform: 'translateY(0px)',
        },
      },
    },
  ],

  ghost: [
    baseIconButton,
    {
      backgroundColor: 'transparent',
      color: '#6B7280',
      border: '1px solid transparent',

      selectors: {
        '&:hover:not(:disabled)': {
          backgroundColor: '#F9FAFB',
          color: '#374151',
          borderColor: '#E5E7EB',
          transform: 'translateY(-1px)',
        },

        '&:active:not(:disabled)': {
          backgroundColor: '#F3F4F6',
          transform: 'translateY(0px)',
        },
      },
    },
  ],

  outline: [
    baseIconButton,
    {
      backgroundColor: 'transparent',
      color: '#0F62FE',
      border: '1px solid #D1D5DB',

      selectors: {
        '&:hover:not(:disabled)': {
          backgroundColor: '#F0F4F8',
          borderColor: '#0F62FE',
          boxShadow: '0 2px 4px -1px rgba(15, 98, 254, 0.1)',
          transform: 'translateY(-1px)',
        },

        '&:active:not(:disabled)': {
          backgroundColor: '#E0E7FF',
          transform: 'translateY(0px)',
        },
      },
    },
  ],

  danger: [
    baseIconButton,
    {
      backgroundColor: 'transparent',
      color: '#EF4444',
      border: '1px solid transparent',

      selectors: {
        '&:hover:not(:disabled)': {
          backgroundColor: '#FEF2F2',
          borderColor: '#FECACA',
          transform: 'translateY(-1px)',
        },

        '&:active:not(:disabled)': {
          backgroundColor: '#FEE2E2',
          transform: 'translateY(0px)',
        },
      },
    },
  ],
});

// Button size variants
const iconButtonSizes = styleVariants({
  sm: {
    width: '2rem', // 32px
    height: '2rem',
    fontSize: '0.875rem', // Icon sizing reference
    padding: '0.375rem', // 6px
  },

  md: {
    width: '2.5rem', // 40px
    height: '2.5rem',
    fontSize: '1rem', // Icon sizing reference
    padding: '0.5rem', // 8px
  },

  lg: {
    width: '3rem', // 48px
    height: '3rem',
    fontSize: '1.25rem', // Icon sizing reference
    padding: '0.625rem', // 10px
  },
});

// Disabled state
const disabledState = style({
  opacity: 0.6,
  cursor: 'not-allowed',
  transform: 'none !important',

  selectors: {
    '&:hover': {
      transform: 'none !important',
    },
  },
});

// Icon container
const iconContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
});

// Spinner animation
const spinAnimation = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

const spinnerBase = style({
  animation: `${spinAnimation} 1s linear infinite`,
});

const spinnerSizes = styleVariants({
  sm: [
    spinnerBase,
    {
      width: '1rem', // 16px
      height: '1rem',
    },
  ],
  md: [
    spinnerBase,
    {
      width: '1.25rem', // 20px
      height: '1.25rem',
    },
  ],
  lg: [
    spinnerBase,
    {
      width: '1.5rem', // 24px
      height: '1.5rem',
    },
  ],
});

const spinnerCircle = style({
  opacity: 0.25,
});

const spinnerPath = style({
  opacity: 0.75,
});

// Notification badge styles
const notificationBadgeBase = style({
  position: 'absolute',
  top: '-0.25rem',
  right: '-0.25rem',
  backgroundColor: '#EF4444', // Red
  color: 'white',
  borderRadius: '9999px', // Fully rounded
  fontSize: '0.75rem',
  fontWeight: '600',
  lineHeight: '1',
  border: '2px solid white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '1.25rem', // Minimum size for single digits
  pointerEvents: 'none', // Don't interfere with button clicks
});

const notificationBadgeSizes = styleVariants({
  sm: [
    notificationBadgeBase,
    {
      top: '-0.125rem',
      right: '-0.125rem',
      fontSize: '0.625rem',
      padding: '0.125rem 0.25rem',
      minWidth: '1rem',
      height: '1rem',
    },
  ],
  md: [
    notificationBadgeBase,
    {
      top: '-0.25rem',
      right: '-0.25rem',
      fontSize: '0.75rem',
      padding: '0.125rem 0.375rem',
      minWidth: '1.25rem',
      height: '1.25rem',
    },
  ],
  lg: [
    notificationBadgeBase,
    {
      top: '-0.375rem',
      right: '-0.375rem',
      fontSize: '0.75rem',
      padding: '0.25rem 0.5rem',
      minWidth: '1.5rem',
      height: '1.5rem',
    },
  ],
});

// Notification dot styles (for boolean notifications)
const notificationDotBase = style({
  position: 'absolute',
  backgroundColor: '#EF4444', // Red
  borderRadius: '50%',
  border: '2px solid white',
  pointerEvents: 'none', // Don't interfere with button clicks
});

const notificationDotSizes = styleVariants({
  sm: [
    notificationDotBase,
    {
      top: '-0.125rem',
      right: '-0.125rem',
      width: '0.5rem', // 8px
      height: '0.5rem',
    },
  ],
  md: [
    notificationDotBase,
    {
      top: '-0.25rem',
      right: '-0.25rem',
      width: '0.625rem', // 10px
      height: '0.625rem',
    },
  ],
  lg: [
    notificationDotBase,
    {
      top: '-0.375rem',
      right: '-0.375rem',
      width: '0.75rem', // 12px
      height: '0.75rem',
    },
  ],
});

export const iconButton = {
  base: baseIconButton,
  variants: iconButtonVariants,
  sizes: iconButtonSizes,
  disabled: disabledState,
  iconContainer,
  spinner: spinnerSizes,
  spinnerCircle,
  spinnerPath,
  notificationBadge: {
    base: notificationBadgeBase,
    sizes: notificationBadgeSizes,
  },
  notificationDot: {
    base: notificationDotBase,
    sizes: notificationDotSizes,
  },
};
