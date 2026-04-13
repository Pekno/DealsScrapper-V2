/**
 * CategorySelector component styles using Vanilla Extract
 * Following the design system from the create filter mockup
 */
import { style, keyframes } from '@vanilla-extract/css';

// Animation keyframes
const fadeIn = keyframes({
  '0%': { opacity: 0, transform: 'translateY(-8px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  position: 'relative',
  // Ensure container allows dropdown to overflow properly
  zIndex: 'auto',
});

const selectedCategories = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  alignItems: 'center',
});

const searchWrapper = style({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
});

const searchInputContainer = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
});

const searchInput = style({
  display: 'block',
  width: '100%',
  padding: '0.75rem 3rem 0.75rem 1rem',
  borderRadius: '0.75rem',
  border: '1px solid #D1D5DB',
  backgroundColor: 'white',
  color: '#1F2937',
  fontSize: '1rem',
  lineHeight: '1.5rem',
  transition: 'all 0.3s ease-in-out',

  '::placeholder': {
    color: '#9CA3AF',
  },

  ':focus': {
    outline: 'none',
    borderColor: '#0F62FE',
    boxShadow: '0 0 0 3px rgba(15, 98, 254, 0.1)',
  },

  ':disabled': {
    backgroundColor: '#F9FAFB',
    color: '#6B7280',
    cursor: 'not-allowed',
    opacity: 0.7,
  },
});

const searchIcon = style({
  position: 'absolute',
  right: '0.75rem',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#6B7280',
  pointerEvents: 'none',
  zIndex: 1,
});

const dropdown = style({
  position: 'absolute',
  top: 'calc(100% + 0.25rem)',
  left: 0,
  right: 0,
  zIndex: 50,
  backgroundColor: 'white',
  borderRadius: '0.75rem',
  border: '1px solid #D1D5DB',
  boxShadow:
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  maxHeight: '16rem',
  overflowY: 'auto',
  animation: `${fadeIn} 0.2s ease-out`,
  // Ensure dropdown can overflow parent containers
  minWidth: '100%',
  width: 'max-content',
  maxWidth: '24rem',
});

const dropdownItem = style({
  display: 'block',
  width: '100%',
  padding: '0.75rem 1rem',
  textAlign: 'left',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease-in-out',
  borderBottom: '1px solid #F3F4F6',

  ':hover': {
    backgroundColor: '#F9FAFB',
  },

  ':focus': {
    outline: 'none',
    backgroundColor: '#F0F4F8',
  },

  ':last-child': {
    borderBottom: 'none',
  },
});

const focusedItem = style({
  backgroundColor: '#F0F4F8',
});

const categoryInfo = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  width: '100%',
});

const categoryHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  width: '100%',
});

const categoryName = style({
  fontSize: '0.875rem',
  fontWeight: '500',
  color: '#1F2937',
  lineHeight: '1.25rem',
  flex: 1,
});

const categoryDescription = style({
  fontSize: '0.75rem',
  color: '#6B7280',
  lineHeight: '1rem',
});

const loadingItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  color: '#6B7280',
  fontSize: '0.875rem',
});

const emptyItem = style({
  padding: '0.75rem 1rem',
  color: '#9CA3AF',
  fontSize: '0.875rem',
  fontStyle: 'italic',
  textAlign: 'center',
});

const errorItem = style({
  padding: '0.75rem 1rem',
  color: '#EF4444',
  fontSize: '0.875rem',
  textAlign: 'center',
  backgroundColor: '#FEF2F2',
  borderRadius: '0.5rem',
  margin: '0.25rem',
});

const spinner = style({
  width: '1rem',
  height: '1rem',
  border: '2px solid #E5E7EB',
  borderTopColor: '#0F62FE',
  borderRadius: '50%',
  animation: `${spin} 1s linear infinite`,
});

const maxIndicator = style({
  fontSize: '0.75rem',
  color: '#6B7280',
  textAlign: 'right',
  fontStyle: 'italic',
});

const maxIndicatorWarning = style({
  fontSize: '0.8125rem',
  color: '#D97706',
  fontWeight: '500',
  padding: '0.375rem 0.75rem',
  backgroundColor: '#FFFBEB',
  border: '1px solid #FDE68A',
  borderRadius: '0.5rem',
  textAlign: 'center',
});

const siteIndicator = style({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  flexShrink: 0,
});

const categoryNameWithIndicator = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

export const categorySelector = {
  container,
  selectedCategories,
  searchWrapper,
  searchInputContainer,
  searchInput,
  searchIcon,
  dropdown,
  dropdownItem,
  focusedItem,
  categoryInfo,
  categoryHeader,
  categoryName,
  categoryNameWithIndicator,
  categoryDescription,
  loadingItem,
  emptyItem,
  errorItem,
  spinner,
  maxIndicator,
  maxIndicatorWarning,
  siteIndicator,
};
