/**
 * SearchInput component styles using Vanilla Extract
 * Extends the base Input styles with search-specific enhancements
 */
import { style, keyframes } from '@vanilla-extract/css';

// Container for the entire search input component
const container = style({
  position: 'relative',
  width: '100%',
});

// Dropdown containing suggestions
const dropdown = style({
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 50,
  backgroundColor: 'white',
  borderRadius: '0.75rem',
  border: '1px solid #E5E7EB',
  boxShadow:
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  marginTop: '0.25rem',
  maxHeight: '16rem',
  overflowY: 'auto',
  overflowX: 'hidden',

  // Custom scrollbar styling
  '::-webkit-scrollbar': {
    width: '4px',
  },

  '::-webkit-scrollbar-track': {
    background: 'transparent',
  },

  '::-webkit-scrollbar-thumb': {
    background: '#D1D5DB',
    borderRadius: '2px',
  },

  // Note: CSS-in-JS doesn't support pseudo-element hover selectors directly
  // This would need to be handled in the component or use a class-based approach

  // Smooth appear animation
  '@media': {
    '(prefers-reduced-motion: no-preference)': {
      animation: `${keyframes({
        '0%': {
          opacity: 0,
          transform: 'translateY(-4px)',
        },
        '100%': {
          opacity: 1,
          transform: 'translateY(0)',
        },
      })} 0.15s ease-out`,
    },
  },
});

// Individual suggestion item
const suggestionItem = style({
  padding: '0.75rem 1rem',
  cursor: 'pointer',
  borderBottom: '1px solid #F3F4F6',
  transition: 'all 0.15s ease-in-out',

  ':last-child': {
    borderBottom: 'none',
  },

  ':hover': {
    backgroundColor: '#F8FAFC',
  },

  ':active': {
    backgroundColor: '#F1F5F9',
  },
});

// Focused suggestion item
const focusedItem = style({
  backgroundColor: '#EBF3FF',
  color: '#1E40AF',

  ':hover': {
    backgroundColor: '#DBEAFE',
  },
});

// Container for suggestion content
const suggestionContent = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
});

// Suggestion text
const suggestionText = style({
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
  color: '#374151',
  flex: 1,

  selectors: {
    [`${focusedItem} &`]: {
      color: '#1E40AF',
    },
  },
});

// Highlighted text within suggestions
const highlight = style({
  backgroundColor: '#FEF3C7',
  color: '#92400E',
  fontWeight: '600',
  padding: '0.125rem 0.25rem',
  borderRadius: '0.25rem',

  selectors: {
    [`${focusedItem} &`]: {
      backgroundColor: '#DBEAFE',
      color: '#1E40AF',
    },
  },
});

// Recent search badge
const recentBadge = style({
  fontSize: '0.75rem',
  fontWeight: '500',
  color: '#6B7280',
  backgroundColor: '#F3F4F6',
  padding: '0.125rem 0.5rem',
  borderRadius: '0.75rem',
  marginLeft: '0.5rem',
  flexShrink: 0,

  selectors: {
    [`${focusedItem} &`]: {
      backgroundColor: '#DBEAFE',
      color: '#3B82F6',
    },
  },
});

// Loading item
const loadingItem = style({
  padding: '0.75rem 1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: '#6B7280',
  fontSize: '0.875rem',
  lineHeight: '1.25rem',

  // Disable pointer events for loading state
  pointerEvents: 'none',
});

// Empty state item
const emptyItem = style({
  padding: '0.75rem 1rem',
  color: '#9CA3AF',
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
  fontStyle: 'italic',
  textAlign: 'center',

  // Disable pointer events for empty state
  pointerEvents: 'none',
});

// Clear button styling
const clearButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.25rem',
  height: '1.25rem',
  color: '#6B7280',
  backgroundColor: 'transparent',
  border: 'none',
  borderRadius: '0.25rem',
  cursor: 'pointer',
  transition: 'all 0.15s ease-in-out',

  ':hover': {
    color: '#374151',
    backgroundColor: '#F3F4F6',
  },

  ':focus': {
    outline: 'none',
    color: '#0F62FE',
    backgroundColor: '#EBF3FF',
  },

  ':active': {
    transform: 'scale(0.95)',
  },

  // Restore pointer events that might be disabled by parent
  pointerEvents: 'auto',
});

// Spin animation for loading spinner
const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

// Loading spinner
const loadingSpinner = style({
  animation: `${spin} 1s linear infinite`,
});

// Export all styles
export const searchInput = {
  container,
  dropdown,
  suggestionItem,
  focusedItem,
  suggestionContent,
  suggestionText,
  highlight,
  recentBadge,
  loadingItem,
  emptyItem,
  clearButton,
  loadingSpinner,
};
