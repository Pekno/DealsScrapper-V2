/**
 * FilterDetailPage styles using Vanilla Extract
 * Following the design patterns from the existing components and wireframe
 */
import { style, keyframes, styleVariants } from '@vanilla-extract/css';

// Container and layout styles - matching CreateFilterForm width
export const container = style({
  maxWidth: '1024px',
  margin: '0 auto',
  padding: '2rem 1rem',

  '@media': {
    '(min-width: 768px)': {
      padding: '2rem',
    },
  },
});

// Filter Information Section - simplified since we use unified Section component
export const filterInfoSection = style({
  marginBottom: '2rem',
});

// General field styling - matching FormField appearance
export const generalField = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1.5rem',
});

export const generalFieldLabel = style({
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#1F2937',
  lineHeight: '1.25rem',
  marginBottom: '0.25rem',
});

export const generalFieldValue = style({
  fontSize: '0.875rem',
  color: '#1F2937',
  fontWeight: '400',
  lineHeight: '1.5',
});

export const generalFieldCategories = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
});

// Products Section
export const productsSection = style({
  marginBottom: '2rem',
});

export const productsCard = style({
  backgroundColor: 'white',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  padding: '2rem',
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',

  '@media': {
    '(max-width: 768px)': {
      padding: '1rem',
      borderRadius: '8px',
    },
  },
});

export const productsHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '1.5rem',
  paddingBottom: '1rem',
  borderBottom: '1px solid #F3F4F6',
});

export const productsTitle = style({
  fontSize: '1.25rem',
  fontWeight: '600',
  color: '#1F2937',
  margin: '0',
});

export const headerActions = style({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
});

export const refreshButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  fontSize: '0.875rem',
  fontWeight: '500',
  color: '#374151',
  backgroundColor: '#F9FAFB',
  border: '1px solid #D1D5DB',
  borderRadius: '6px',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',

  ':hover': {
    backgroundColor: '#F3F4F6',
    borderColor: '#9CA3AF',
  },

  ':disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },

  ':focus': {
    outline: 'none',
    boxShadow: '0 0 0 2px #3B82F6',
  },
});

export const nextCheckTimer = style({
  fontSize: '0.875rem',
  color: '#6B7280',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

// Loading states
const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

export const loadingContainer = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '50vh',
  gap: '1rem',
});

export const spinner = style({
  width: '2rem',
  height: '2rem',
  border: '3px solid #F3F4F6',
  borderTop: '3px solid #0F62FE',
  borderRadius: '50%',
  animation: `${spin} 1s linear infinite`,
});

export const loadingText = style({
  fontSize: '1rem',
  color: '#6B7280',
});

// Error states
export const errorContainer = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '50vh',
  textAlign: 'center',
  gap: '1rem',
  maxWidth: '500px',
  margin: '0 auto',
});

export const errorTitle = style({
  fontSize: '1.5rem',
  fontWeight: '600',
  color: '#DC2626',
  margin: '0',
});

export const errorMessage = style({
  fontSize: '1rem',
  color: '#6B7280',
  lineHeight: '1.5',
  margin: '0',
});

export const errorActions = style({
  display: 'flex',
  gap: '1rem',
  marginTop: '1rem',

  '@media': {
    '(max-width: 480px)': {
      flexDirection: 'column',
      width: '100%',
    },
  },
});

// Responsive design helpers
export const responsive = {
  mobile: style({
    '@media': {
      '(max-width: 640px)': {
        display: 'block',
      },
    },
  }),

  tablet: style({
    '@media': {
      '(max-width: 768px)': {
        display: 'block',
      },
    },
  }),

  desktop: style({
    '@media': {
      '(min-width: 769px)': {
        display: 'block',
      },
    },
  }),
};

// Scraping status container in products header
export const scrapingStatusContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.875rem',
  color: '#6B7280',
  fontWeight: '500',
  position: 'relative',
  cursor: 'help',
});

// Smart polling status tooltip
export const smartPollingTooltip = style({
  position: 'absolute',
  zIndex: 9999,
  width: 'auto',
  minWidth: '220px',
  backgroundColor: 'rgba(17, 24, 39, 0.95)',
  color: 'white',
  borderRadius: '8px',
  padding: '12px 16px',
  fontSize: '12px',
  fontWeight: '500',
  lineHeight: '1.5',
  boxShadow:
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  pointerEvents: 'none',

  // Position above the element
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: '8px',

  // Hide by default
  opacity: 0,
  visibility: 'hidden',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',

  // Arrow pointing down
  '::after': {
    content: '',
    position: 'absolute',
    top: '100%',
    left: '50%',
    marginLeft: '-4px',
    borderWidth: '4px',
    borderStyle: 'solid',
    borderColor: 'rgba(17, 24, 39, 0.95) transparent transparent transparent',
  },

  // Show on hover
  selectors: {
    [`${scrapingStatusContainer}:hover &`]: {
      opacity: 1,
      visibility: 'visible',
    },
  },
});
