/**
 * AppLayout component styles using Vanilla Extract
 * Based on the design system from create_filter.png and view_filters.png mockups
 */
import {
  style,
  styleVariants,
  globalStyle,
  keyframes,
} from '@vanilla-extract/css';

// Animation keyframes
const slideInFromLeft = keyframes({
  from: { transform: 'translateX(-100%)' },
  to: { transform: 'translateX(0)' },
});

// Animation for future use - slide out to left
// const slideOutToLeft = keyframes({
//   from: { transform: 'translateX(0)' },
//   to: { transform: 'translateX(-100%)' }
// });

const fadeIn = keyframes({
  from: { opacity: '0' },
  to: { opacity: '1' },
});

const fadeOut = keyframes({
  from: { opacity: '1' },
  to: { opacity: '0' },
});

// Base layout container
export const layoutContainer = style({
  minHeight: '100vh',
  backgroundColor: '#F9FAFB', // Light gray background as shown in mockups
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
});

// Global header at the top
export const globalHeader = style({
  backgroundColor: 'white',
  borderBottom: '1px solid #E5E7EB',
  padding: '1rem 2rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '64px', // Fixed height to match margin-top
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',

  '@media': {
    'screen and (max-width: 767px)': {
      padding: '1rem',
    },
  },
});

// Content wrapper below header
export const contentWrapper = style({
  display: 'flex',
  flex: 1,
  marginTop: '64px', // Account for fixed header height
});

// Sidebar styles
export const sidebar = style({
  width: '256px', // 16rem - matches mockup sidebar width
  backgroundColor: 'white',
  borderRight: '1px solid #E5E7EB', // Gray border
  display: 'flex',
  flexDirection: 'column',
  position: 'fixed',
  top: '64px', // Below header
  left: 0,
  height: 'calc(100vh - 64px)', // Full height minus header
  zIndex: 900,
  transition: 'transform 0.3s ease-in-out',
  boxShadow: '1px 0 3px 0 rgba(0, 0, 0, 0.05)',
  overflow: 'auto',

  '@media': {
    'screen and (max-width: 767px)': {
      transform: 'translateX(-100%)',
      zIndex: 950,
    },
  },
});

// Sidebar variants for mobile behavior
export const sidebarVariants = styleVariants({
  desktop: [sidebar],
  mobileHidden: [
    sidebar,
    {
      '@media': {
        'screen and (max-width: 767px)': {
          transform: 'translateX(-100%)',
        },
      },
    },
  ],
  mobileVisible: [
    sidebar,
    {
      '@media': {
        'screen and (max-width: 767px)': {
          transform: 'translateX(0)',
          animation: `${slideInFromLeft} 0.3s ease-out`,
        },
      },
    },
  ],
});

// Mobile backdrop overlay
export const mobileBackdrop = style({
  position: 'fixed',
  top: '64px', // Below header
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 35,
  animation: `${fadeIn} 0.3s ease-out`,

  '@media': {
    'screen and (min-width: 768px)': {
      display: 'none',
    },
  },
});

export const mobileBackdropHidden = style({
  animation: `${fadeOut} 0.3s ease-out`,
});

// Main content area
export const mainContent = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden', // Prevent scroll on container
  marginLeft: '256px', // Account for fixed sidebar width
  minHeight: 'calc(100vh - 64px)', // Ensure full height minus header
  position: 'relative',

  '@media': {
    'screen and (max-width: 767px)': {
      marginLeft: 0, // No margin on mobile when sidebar is hidden
    },
  },
});

// Mobile menu button
export const mobileMenuButton = style({
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

  ':hover': {
    backgroundColor: '#F3F4F6',
    color: '#374151',
  },

  ':focus': {
    outline: '2px solid #0F62FE',
    outlineOffset: '2px',
  },

  '@media': {
    'screen and (min-width: 768px)': {
      display: 'none',
    },
  },
});

// Content area styles
export const contentArea = style({
  flex: 1,
  overflow: 'auto', // Allow scrolling
  padding: 0,
  backgroundColor: '#F9FAFB', // Matches layout background
  height: '100%', // Full height of parent
});

// Logo styles (in global header)
export const logoContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
});

export const logoIcon = style({
  width: '2rem',
  height: '2rem',
  borderRadius: '0.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export const logoIconInner = style({
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  // Remove white background from SVG if needed for dark themes
  filter: 'brightness(0.98) contrast(1.02)',
});

export const logoText = style({
  fontSize: '1.25rem',
  fontWeight: '700',
  color: '#0F62FE',
  lineHeight: '1.75rem',
});

// Sidebar navigation
export const sidebarNav = style({
  flex: 1,
  padding: '1rem',
  overflow: 'auto',
});

export const navList = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  listStyle: 'none',
  margin: 0,
  padding: 0,
});

export const navItem = style({});

export const navLink = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  borderRadius: '0.5rem',
  color: '#6B7280',
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: '500',
  transition: 'all 0.2s ease-in-out',
  cursor: 'pointer',

  ':hover': {
    backgroundColor: '#F3F4F6',
    color: '#374151',
  },

  ':focus': {
    outline: '2px solid #0F62FE',
    outlineOffset: '2px',
  },
});

export const navLinkActive = style([
  navLink,
  {
    backgroundColor: '#EBF4FF', // Light blue background
    color: '#0F62FE', // Blue text
    fontWeight: '600',

    ':hover': {
      backgroundColor: '#DBEAFE',
      color: '#0D5CE8',
    },
  },
]);

export const navLinkDisabled = style([
  navLink,
  {
    color: '#9CA3AF', // Gray text for disabled state
    cursor: 'not-allowed',
    opacity: 0.6,

    ':hover': {
      backgroundColor: 'transparent',
      color: '#9CA3AF',
    },

    ':focus': {
      outline: 'none',
    },
  },
]);

export const navIcon = style({
  width: '1.25rem',
  height: '1.25rem',
  flexShrink: 0,
});

// Sidebar footer (user profile area)
export const sidebarFooter = style({
  padding: '1rem',
  borderTop: '1px solid #E5E7EB',
});

export const userProfile = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease-in-out',

  ':hover': {
    backgroundColor: '#F3F4F6',
  },

  ':focus': {
    outline: '2px solid #0F62FE',
    outlineOffset: '2px',
  },
});

export const userAvatar = style({
  width: '2rem',
  height: '2rem',
  backgroundColor: '#10B981', // Green color from mockup
  borderRadius: '9999px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

export const userAvatarText = style({
  color: 'white',
  fontSize: '0.875rem',
  fontWeight: '600',
});

export const userInfo = style({
  flex: 1,
  minWidth: 0, // Allow text truncation
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

// Utility classes for responsive behavior
export const hiddenOnMobile = style({
  '@media': {
    'screen and (max-width: 767px)': {
      display: 'none',
    },
  },
});

export const visibleOnMobile = style({
  display: 'block',

  '@media': {
    'screen and (min-width: 768px)': {
      display: 'none',
    },
  },
});

// Navigation loading overlay
export const navigationLoadingOverlay = style({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  animation: `${fadeIn} 0.2s ease-out`,
});

// Loading indicator for navigation items
const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

export const navLoadingIndicator = style({
  width: '16px',
  height: '16px',
  border: '2px solid #E5E7EB',
  borderTop: '2px solid #3B82F6',
  borderRadius: '50%',
  animation: `${spin} 1s linear infinite`,
  marginLeft: 'auto',
});

// Ensure proper body scroll handling when mobile sidebar is open
globalStyle('body.sidebar-open', {
  '@media': {
    'screen and (max-width: 767px)': {
      overflow: 'hidden',
    },
  },
});
