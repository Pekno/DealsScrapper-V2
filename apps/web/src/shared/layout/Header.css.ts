/**
 * Header component styles using Vanilla Extract
 * Based on the design system from the create_filter.png and view_filters.png mockups
 */
import { style } from '@vanilla-extract/css';

/**
 * Main header container
 * Positioned at the top of the main content area
 */
export const headerContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '2rem 2rem 1rem 2rem',
  backgroundColor: '#F9FAFB', // Matches the main content background
  borderBottom: 'none', // Clean separation without visible border
  minHeight: '80px',
  gap: '1rem',

  '@media': {
    'screen and (max-width: 767px)': {
      padding: '1.5rem 1rem 1rem 1rem',
      minHeight: '64px',
      gap: '0.75rem',
    },
  },
});

/**
 * Left section containing the title
 */
export const headerLeft = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  flex: 1,
  minWidth: 0, // Allow text truncation
});

/**
 * Main page title styling
 * Follows the typography from the mockups
 */
export const headerTitle = style({
  fontSize: '1.875rem', // 30px - matches mockup
  fontWeight: '700',
  color: '#111827',
  lineHeight: '2.25rem',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',

  '@media': {
    'screen and (max-width: 767px)': {
      fontSize: '1.5rem', // 24px on mobile
      lineHeight: '2rem',
    },
  },
});

/**
 * Optional subtitle styling
 */
export const headerSubtitle = style({
  fontSize: '1rem',
  fontWeight: '400',
  color: '#6B7280',
  lineHeight: '1.5rem',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',

  '@media': {
    'screen and (max-width: 767px)': {
      fontSize: '0.875rem',
      lineHeight: '1.25rem',
    },
  },
});

/**
 * Right section containing actions and notifications
 */
export const headerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  flexShrink: 0,

  '@media': {
    'screen and (max-width: 767px)': {
      gap: '0.75rem',
    },
  },
});

/**
 * Actions wrapper to handle responsive behavior
 */
export const headerActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',

  '@media': {
    'screen and (max-width: 767px)': {
      gap: '0.5rem',
    },
  },
});

/**
 * Notification bell button placeholder
 * Styled similarly to the mobile menu button from AppLayout
 */
export const notificationButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '2.5rem',
  height: '2.5rem',
  borderRadius: '0.5rem',
  backgroundColor: 'transparent',
  border: 'none',
  color: '#6B7280',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  position: 'relative',

  ':hover': {
    backgroundColor: '#F3F4F6',
    color: '#374151',
  },

  ':focus': {
    outline: '2px solid #0F62FE',
    outlineOffset: '2px',
  },

  ':active': {
    backgroundColor: '#E5E7EB',
  },
});

/**
 * Icon styling for the notification bell
 */
export const notificationIcon = style({
  width: '1.25rem',
  height: '1.25rem',
  flexShrink: 0,
});

/**
 * Notification badge for unread count
 */
export const notificationBadge = style({
  position: 'absolute',
  top: '0.25rem',
  right: '0.25rem',
  backgroundColor: '#EF4444', // Red color for notifications
  color: 'white',
  borderRadius: '9999px',
  width: '1rem',
  height: '1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  fontWeight: '600',
  lineHeight: '1',
  border: '2px solid #F9FAFB', // Matches background
  minWidth: '1rem',

  // Hide if count is 0
  selectors: {
    '&[data-count="0"]': {
      display: 'none',
    },
  },
});

/**
 * Responsive utility classes
 */
export const hiddenOnMobile = style({
  '@media': {
    'screen and (max-width: 767px)': {
      display: 'none',
    },
  },
});

export const visibleOnMobile = style({
  display: 'none',

  '@media': {
    'screen and (max-width: 767px)': {
      display: 'flex',
    },
  },
});

/**
 * Header variants for different layouts
 */
export const headerVariants = {
  default: headerContainer,
  compact: style([
    headerContainer,
    {
      padding: '1rem 2rem',
      minHeight: '60px',

      '@media': {
        'screen and (max-width: 767px)': {
          padding: '0.75rem 1rem',
          minHeight: '48px',
        },
      },
    },
  ]),
};
