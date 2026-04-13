/**
 * NavigationMenu component styles using Vanilla Extract
 * Comprehensive styling for the navigation menu with user profile dropdown
 * Based on the DealsScrapper design system
 */
import { style, keyframes, styleVariants } from '@vanilla-extract/css';

// Animation keyframes
const slideInFromTop = keyframes({
  from: {
    opacity: '0',
    transform: 'translateY(-8px) scale(0.95)',
  },
  to: {
    opacity: '1',
    transform: 'translateY(0) scale(1)',
  },
});

// Unused but kept for future use
// const slideOutToTop = keyframes({
//   from: {
//     opacity: '1',
//     transform: 'translateY(0) scale(1)'
//   },
//   to: {
//     opacity: '0',
//     transform: 'translateY(-8px) scale(0.95)'
//   }
// });

const fadeIn = keyframes({
  from: { opacity: '0' },
  to: { opacity: '1' },
});

const bounceIn = keyframes({
  '0%': { transform: 'scale(0.9)', opacity: '0' },
  '50%': { transform: 'scale(1.05)', opacity: '0.8' },
  '100%': { transform: 'scale(1)', opacity: '1' },
});

// Main navigation menu container
export const navigationMenu = style({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: 'white',
  borderRight: '1px solid #E5E7EB',
  padding: '1rem 0',
  minWidth: '280px',
  position: 'relative',
});

// Navigation list
export const navList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  listStyle: 'none',
  margin: 0,
  padding: '0 1rem',
  flex: 1,
  overflow: 'auto',
});

// Navigation item
export const navItem = style({
  position: 'relative',
});

// Base navigation link styles
const baseNavLink = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '0.75rem 1rem',
  borderRadius: '0.5rem',
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: '500',
  textDecoration: 'none',
  textAlign: 'left',
  transition: 'all 0.2s ease-in-out',
  color: '#6B7280',

  ':hover': {
    backgroundColor: '#F3F4F6',
    color: '#374151',
    transform: 'translateX(2px)',
  },

  ':focus': {
    outline: '2px solid #0F62FE',
    outlineOffset: '2px',
  },

  ':active': {
    transform: 'translateX(1px)',
  },
});

// Navigation link variants
export const navLink = style([baseNavLink]);

export const navLinkActive = style([
  baseNavLink,
  {
    backgroundColor: '#EBF4FF',
    color: '#0F62FE',
    fontWeight: '600',
    transform: 'translateX(2px)',

    ':hover': {
      backgroundColor: '#DBEAFE',
      color: '#0D5CE8',
      transform: 'translateX(2px)',
    },

    ':before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: '50%',
      transform: 'translateY(-50%)',
      width: '3px',
      height: '60%',
      backgroundColor: '#0F62FE',
      borderRadius: '0 2px 2px 0',
    },
  },
]);

// Navigation link content container
export const navLinkContent = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  flex: 1,
  minWidth: 0,
});

// Navigation label
export const navLabel = style({
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

// Navigation icon
export const navIcon = style({
  width: '1.25rem',
  height: '1.25rem',
  flexShrink: 0,
  strokeWidth: 2,
});

// Navigation badge
export const navBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '1.25rem',
  height: '1.25rem',
  padding: '0 0.375rem',
  backgroundColor: '#EF4444',
  color: 'white',
  fontSize: '0.75rem',
  fontWeight: '600',
  borderRadius: '9999px',
  animation: `${bounceIn} 0.3s ease-out`,

  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

// Chevron icons for collapsible groups
export const chevronCollapsed = style({
  width: '1rem',
  height: '1rem',
  transform: 'rotate(0deg)',
  transition: 'transform 0.2s ease-in-out',
  color: 'currentColor',
});

export const chevronExpanded = style({
  width: '1rem',
  height: '1rem',
  transform: 'rotate(90deg)',
  transition: 'transform 0.2s ease-in-out',
  color: 'currentColor',
});

// Sub-navigation list for nested items
export const navSubList = style({
  listStyle: 'none',
  margin: '0.25rem 0 0 0',
  padding: '0 0 0 2.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',

  // Nested items styling
  selectors: {
    [`${navItem} &`]: {
      borderLeft: '2px solid #F3F4F6',
      marginLeft: '1.25rem',
      paddingLeft: '1rem',
    },
  },
});

// User profile section
export const userProfileSection = style({
  marginTop: 'auto',
  padding: '1rem',
  borderTop: '1px solid #E5E7EB',
  position: 'relative',
});

// User profile button
export const userProfileButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  width: '100%',
  padding: '0.75rem',
  borderRadius: '0.5rem',
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  textAlign: 'left',

  ':hover': {
    backgroundColor: '#F3F4F6',
  },

  ':focus': {
    outline: '2px solid #0F62FE',
    outlineOffset: '2px',
  },
});

// User avatar
export const userAvatar = style({
  width: '2.5rem',
  height: '2.5rem',
  backgroundColor: '#10B981',
  borderRadius: '9999px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  overflow: 'hidden',
});

export const userAvatarImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
});

export const userAvatarText = style({
  color: 'white',
  fontSize: '1rem',
  fontWeight: '600',
});

// User info
export const userInfo = style({
  flex: 1,
  minWidth: 0,
});

export const userName = style({
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#111827',
  lineHeight: '1.25rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const userEmail = style({
  fontSize: '0.75rem',
  color: '#6B7280',
  lineHeight: '1rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const userRole = style({
  fontSize: '0.75rem',
  color: '#059669',
  fontWeight: '500',
  lineHeight: '1rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

// Chevron icon for user profile
export const chevronIcon = style({
  width: '1rem',
  height: '1rem',
  color: '#6B7280',
  flexShrink: 0,
  transform: 'rotate(0deg)',
  transition: 'transform 0.2s ease-in-out',

  selectors: {
    [`${userProfileButton}:hover &`]: {
      transform: 'rotate(-180deg)',
    },
  },
});

// Profile dropdown
export const profileDropdown = style({
  position: 'absolute',
  bottom: '100%',
  left: '1rem',
  right: '1rem',
  marginBottom: '0.5rem',
  backgroundColor: 'white',
  borderRadius: '0.5rem',
  boxShadow:
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  border: '1px solid #E5E7EB',
  zIndex: 50,
  animation: `${slideInFromTop} 0.2s ease-out`,

  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

// Profile dropdown header
export const profileDropdownHeader = style({
  padding: '1rem',
});

export const profileInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
});

export const profileName = style({
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#111827',
});

export const profileEmail = style({
  fontSize: '0.75rem',
  color: '#6B7280',
});

// Profile dropdown divider
export const profileDropdownDivider = style({
  height: '1px',
  backgroundColor: '#E5E7EB',
  margin: '0',
});

// Profile dropdown actions
export const profileDropdownActions = style({
  padding: '0.5rem',
});

// Base profile dropdown action
const baseProfileAction = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  width: '100%',
  padding: '0.75rem',
  borderRadius: '0.375rem',
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: '500',
  textDecoration: 'none',
  textAlign: 'left',
  transition: 'all 0.2s ease-in-out',
});

export const profileDropdownAction = style([
  baseProfileAction,
  {
    color: '#374151',

    ':hover': {
      backgroundColor: '#F3F4F6',
      color: '#111827',
    },

    ':focus': {
      outline: '2px solid #0F62FE',
      outlineOffset: '2px',
    },
  },
]);

export const profileDropdownActionDanger = style([
  baseProfileAction,
  {
    color: '#EF4444',

    ':hover': {
      backgroundColor: '#FEF2F2',
      color: '#DC2626',
    },

    ':focus': {
      outline: '2px solid #EF4444',
      outlineOffset: '2px',
    },
  },
]);

// Action icon
export const actionIcon = style({
  width: '1.125rem',
  height: '1.125rem',
  flexShrink: 0,
});

// Logout confirmation modal
export const logoutModal = style({
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  animation: `${fadeIn} 0.2s ease-out`,

  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const logoutModalContent = style({
  backgroundColor: 'white',
  borderRadius: '0.5rem',
  padding: '1.5rem',
  maxWidth: '24rem',
  width: '90%',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  animation: `${slideInFromTop} 0.2s ease-out`,

  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

export const logoutModalTitle = style({
  fontSize: '1.125rem',
  fontWeight: '600',
  color: '#111827',
  margin: '0 0 0.5rem 0',
});

export const logoutModalMessage = style({
  fontSize: '0.875rem',
  color: '#6B7280',
  margin: '0 0 1.5rem 0',
  lineHeight: '1.5',
});

export const logoutModalActions = style({
  display: 'flex',
  gap: '0.75rem',
  justifyContent: 'flex-end',
});

// Logout modal buttons
const baseLogoutButton = style({
  padding: '0.625rem 1.25rem',
  borderRadius: '0.375rem',
  border: 'none',
  fontSize: '0.875rem',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',

  ':focus': {
    outline: '2px solid transparent',
    outlineOffset: '2px',
  },
});

export const logoutConfirmButton = style([
  baseLogoutButton,
  {
    backgroundColor: '#EF4444',
    color: 'white',

    ':hover': {
      backgroundColor: '#DC2626',
    },

    ':focus': {
      boxShadow: '0 0 0 2px #FEE2E2, 0 0 0 4px #EF4444',
    },
  },
]);

export const logoutCancelButton = style([
  baseLogoutButton,
  {
    backgroundColor: '#F3F4F6',
    color: '#374151',

    ':hover': {
      backgroundColor: '#E5E7EB',
    },

    ':focus': {
      boxShadow: '0 0 0 2px #F3F4F6, 0 0 0 4px #6B7280',
    },
  },
]);

// Responsive adjustments
export const responsiveNavigation = styleVariants({
  mobile: {
    '@media': {
      'screen and (max-width: 767px)': {
        minWidth: '100%',
        padding: '0.5rem 0',
      },
    },
  },

  desktop: {
    '@media': {
      'screen and (min-width: 768px)': {
        minWidth: '280px',
        maxWidth: '320px',
      },
    },
  },
});
