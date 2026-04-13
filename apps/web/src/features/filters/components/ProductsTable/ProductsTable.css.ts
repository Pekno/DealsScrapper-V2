/**
 * ProductsTable styles using Vanilla Extract
 * Card-based grid layout with responsive design
 */
import { style, keyframes, styleVariants } from '@vanilla-extract/css';

// Container and layout
export const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
});

// Header section with search and sort
export const headerSection = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap',

  '@media': {
    '(max-width: 640px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '0.75rem',
    },
  },
});

export const searchContainer = style({
  position: 'relative',
  flex: 1,
  maxWidth: '400px',
  minWidth: '250px',

  '@media': {
    '(max-width: 640px)': {
      maxWidth: 'none',
      minWidth: 'auto',
    },
  },
});

export const searchInput = style({
  width: '100%',
  paddingLeft: '2.5rem',

  '::placeholder': {
    color: '#9CA3AF',
  },
});

export const searchIcon = style({
  position: 'absolute',
  left: '0.75rem',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#6B7280',
  fontSize: '1rem',
  pointerEvents: 'none',
});

// Sort section
export const sortContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  minWidth: '180px',

  '@media': {
    '(max-width: 640px)': {
      justifyContent: 'space-between',
      width: '100%',
      minWidth: 'auto',
    },
  },
});

export const sortLabel = style({
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#374151',
  whiteSpace: 'nowrap',
});

export const sortSelect = style({
  padding: '0.5rem 0.75rem',
  border: '1px solid #D1D5DB',
  borderRadius: '6px',
  backgroundColor: 'white',
  fontSize: '0.875rem',
  fontWeight: '500',
  color: '#374151',
  minWidth: '140px',

  ':focus': {
    outline: 'none',
    borderColor: '#0F62FE',
    boxShadow: '0 0 0 1px #0F62FE',
  },

  '@media': {
    '(max-width: 640px)': {
      flex: 1,
      minWidth: 'auto',
    },
  },
});

// Grid container
export const gridContainer = style({
  width: '100%',
});

// Products grid
export const productsGrid = style({
  display: 'grid',
  gap: '1.5rem',
  gridTemplateColumns: 'repeat(4, 1fr)',

  '@media': {
    // Desktop: 4 cards per row
    '(min-width: 1024px)': {
      gridTemplateColumns: 'repeat(4, 1fr)',
    },
    // Tablet: 2 cards per row
    '(min-width: 768px) and (max-width: 1023px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '1.25rem',
    },
    // Mobile: 1 card per row
    '(max-width: 767px)': {
      gridTemplateColumns: '1fr',
      gap: '1rem',
    },
  },
});

// Loading and empty states
const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

export const loadingState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4rem 2rem',
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

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4rem 2rem',
  gap: '1rem',
  textAlign: 'center',
  color: '#6B7280',
});

// Pagination section
export const paginationSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  alignItems: 'center',
  padding: '1rem 0',

  '@media': {
    '(max-width: 768px)': {
      gap: '0.75rem',
    },
  },
});

export const resultsInfo = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  fontSize: '0.875rem',
  color: '#6B7280',

  '@media': {
    '(max-width: 640px)': {
      flexDirection: 'column',
      gap: '0.5rem',
      alignItems: 'flex-start',
    },
  },
});

export const itemsPerPageContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

export const itemsPerPageSelect = style({
  padding: '0.25rem 0.5rem',
  border: '1px solid #D1D5DB',
  borderRadius: '4px',
  backgroundColor: 'white',
  fontSize: '0.875rem',

  ':focus': {
    outline: 'none',
    borderColor: '#0F62FE',
    boxShadow: '0 0 0 1px #0F62FE',
  },
});

export const paginationControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',

  '@media': {
    '(max-width: 640px)': {
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
  },
});

export const pageNumbers = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  margin: '0 1rem',

  '@media': {
    '(max-width: 640px)': {
      margin: '0 0.5rem',
    },
  },
});

export const pageNumber = styleVariants({
  active: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2rem',
    height: '2rem',
    borderRadius: '4px',
    backgroundColor: '#0F62FE',
    color: 'white',
    fontSize: '0.875rem',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
  },

  inactive: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2rem',
    height: '2rem',
    borderRadius: '4px',
    backgroundColor: 'transparent',
    color: '#6B7280',
    fontSize: '0.875rem',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',

    ':hover': {
      backgroundColor: '#F3F4F6',
      color: '#1F2937',
    },
  },
});

export const pageEllipsis = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '2rem',
  height: '2rem',
  color: '#9CA3AF',
  fontSize: '0.875rem',
});
