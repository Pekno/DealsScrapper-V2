/**
 * FilterGrid component styles using Vanilla Extract
 * Based on the view_filters.png mockup design
 */
import { style, keyframes } from '@vanilla-extract/css';

// Loading animations
const shimmer = keyframes({
  '0%': { transform: 'translateX(-100%)' },
  '100%': { transform: 'translateX(100%)' },
});

const pulse = keyframes({
  '0%, 100%': { opacity: 1 },
  '50%': { opacity: 0.7 },
});

// Grid container styles
const gridContainer = style({
  width: '100%',
  height: '100%',
});

// Main grid styles - responsive layout matching the mockup
const gridBase = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '1.5rem',
  padding: '0',

  // Responsive breakpoints
  '@media': {
    // Mobile: single column
    '(max-width: 640px)': {
      gridTemplateColumns: '1fr',
      gap: '1rem',
    },

    // Tablet: 2 columns
    '(min-width: 641px) and (max-width: 1024px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '1.25rem',
    },

    // Desktop: consistent 2 columns
    '(min-width: 1025px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '1.5rem',
    },

    // Large desktop: consistent 2 columns
    '(min-width: 1400px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '2rem',
    },
  },
});

// Individual grid item
const gridItem = style({
  minHeight: '200px',
  display: 'flex',
  flexDirection: 'column',
});

// Skeleton loading styles
const skeletonBase = style({
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: '#F9FAFB',

  '::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)',
    animation: `${shimmer} 2s infinite`,
    zIndex: 1,
  },
});

const skeletonCard = style([
  skeletonBase,
  {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    padding: '1.5rem',
    minHeight: '200px',
    gap: '1rem',
  },
]);

const skeletonHeader = style({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '1rem',
});

const skeletonTitleArea = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
});

const skeletonTitle = style([
  skeletonBase,
  {
    height: '1.5rem',
    width: '70%',
    borderRadius: '4px',
  },
]);

const skeletonDescription = style([
  skeletonBase,
  {
    height: '1rem',
    width: '90%',
    borderRadius: '4px',
  },
]);

const skeletonMetrics = style({
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'center',
});

const skeletonBadge = style([
  skeletonBase,
  {
    height: '1.75rem',
    width: '3rem',
    borderRadius: '12px',
  },
]);

const skeletonBody = style({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
});

const skeletonDate = style([
  skeletonBase,
  {
    height: '1rem',
    width: '40%',
    borderRadius: '4px',
  },
]);

const skeletonTags = style({
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
});

const skeletonTag = style([
  skeletonBase,
  {
    height: '1.5rem',
    width: '4rem',
    borderRadius: '12px',
  },
]);

const skeletonActions = style({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.5rem',
  marginTop: '1rem',
  paddingTop: '1rem',
  borderTop: '1px solid #F3F4F6',
});

const skeletonButton = style([
  skeletonBase,
  {
    height: '2rem',
    width: '4rem',
    borderRadius: '6px',
  },
]);

// Empty state styles
const emptyStateContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '400px',
  gridColumn: '1 / -1', // Span all columns
});

const emptyStateContent = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  maxWidth: '400px',
  gap: '1.5rem',
});

const emptyStateIcon = style({
  color: '#9CA3AF',
  animation: `${pulse} 2s ease-in-out infinite`,
});

const emptyStateTitle = style({
  fontSize: '1.5rem',
  fontWeight: '600',
  color: '#111827',
  margin: 0,
});

const emptyStateDescription = style({
  fontSize: '1rem',
  color: '#6B7280',
  lineHeight: '1.6',
  margin: 0,
});

const emptyStateButton = style({
  marginTop: '0.5rem',
});

// Export all styles
export const grid = {
  container: gridContainer,
  base: gridBase,
  item: gridItem,
};

export const skeleton = {
  card: skeletonCard,
  header: skeletonHeader,
  titleArea: skeletonTitleArea,
  title: skeletonTitle,
  description: skeletonDescription,
  metrics: skeletonMetrics,
  badge: skeletonBadge,
  body: skeletonBody,
  date: skeletonDate,
  tags: skeletonTags,
  tag: skeletonTag,
  actions: skeletonActions,
  button: skeletonButton,
};

export const emptyState = {
  container: emptyStateContainer,
  content: emptyStateContent,
  icon: emptyStateIcon,
  title: emptyStateTitle,
  description: emptyStateDescription,
  button: emptyStateButton,
};
