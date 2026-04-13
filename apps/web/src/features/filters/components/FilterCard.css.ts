/**
 * FilterCard component styles using Vanilla Extract
 * Based on the view_filters.png mockup design
 */
import { style, keyframes } from '@vanilla-extract/css';

// Loading spinner animation
const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

// Card base styles
const cardBase = style({
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  padding: '1.5rem',
  position: 'relative',
  transition: 'all 0.2s ease-in-out',
  minHeight: '200px',
  // REMOVED: animation to prevent flashing on re-renders when stats load

  // Subtle shadow matching the mockup
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',

  ':hover': {
    boxShadow:
      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    borderColor: '#D1D5DB',
  },
});

const cardClickable = style({
  cursor: 'pointer',

  ':hover': {
    transform: 'translateY(-2px)',
    boxShadow:
      '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },

  ':focus': {
    outline: '2px solid #3B82F6',
    outlineOffset: '2px',
  },
});

const cardLoading = style({
  opacity: 0.6,
  pointerEvents: 'none',
});

// Header styles
const header = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '1rem',
  gap: '1rem',
});

const titleSection = style({
  flex: 1,
  minWidth: 0, // Allow text truncation
});

const title = style({
  fontSize: '1.125rem',
  fontWeight: '600',
  color: '#111827',
  lineHeight: '1.5',
  marginBottom: '0.25rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

const inactiveIndicator = style({
  fontSize: '0.875rem',
  fontWeight: '400',
  color: '#9CA3AF',
  fontStyle: 'italic',
});

const description = style({
  fontSize: '0.875rem',
  color: '#6B7280',
  lineHeight: '1.4',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

// Metrics styles
const metricsSection = style({
  flexShrink: 0,
});

const metricsContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
});

const totalMetric = style({
  backgroundColor: '#F3F4F6',
  color: '#374151',
});

const newMetric = style({
  backgroundColor: '#DCFCE7',
  color: '#166534',
  fontWeight: '600',
});

// Clean badge wrapper for total metric with new count badge
const totalBadgeWrapper = style({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
});

// Clean new count badge attached to total metric
const newCountBadge = style({
  position: 'absolute',
  top: '-8px',
  right: '-12px',
  backgroundColor: '#22C55E',
  color: '#FFFFFF',
  fontSize: '0.75rem',
  fontWeight: '600',
  padding: '2px 6px',
  borderRadius: '10px',
  border: '2px solid #FFFFFF',
  lineHeight: '1',
  minWidth: '20px',
  textAlign: 'center',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  display: 'flex',
  alignItems: 'center',
  gap: '2px',
});

// Body styles
const body = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
});

const categoriesSection = style({
  marginTop: '0.5rem',
});

// Actions styles
const actions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '1rem',
  paddingTop: '1rem',
  borderTop: '1px solid #F3F4F6',
});

// Loading overlay styles
const loadingOverlay = style({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '12px',
});

const spinner = style({
  width: '2rem',
  height: '2rem',
  border: '2px solid #E5E7EB',
  borderTop: '2px solid #3B82F6',
  borderRadius: '50%',
  animation: `${spin} 1s linear infinite`,
});

// Active status display for smart polling
const activeStatus = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  color: '#10B981', // green color for active status
  fontWeight: '500',
});

export const card = {
  base: cardBase,
  clickable: cardClickable,
  loading: cardLoading,
  header,
  titleSection,
  title,
  inactiveIndicator,
  description,
  metricsSection,
  metricsContainer,
  totalMetric,
  newMetric,
  totalBadgeWrapper,
  newCountBadge,
  body,
  categoriesSection,
  actions,
  loadingOverlay,
  spinner,
  activeStatus,
};
