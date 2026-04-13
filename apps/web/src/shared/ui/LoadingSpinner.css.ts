/**
 * LoadingSpinner component styles using Vanilla Extract
 * Provides beautiful, smooth loading animations for async content
 */
import { style, keyframes } from '@vanilla-extract/css';

// Spinner animation
const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

// Pulse animation for shimmer effect
const pulseKeyframes = keyframes({
  '0%, 100%': { opacity: 0.4 },
  '50%': { opacity: 0.8 },
});

// Shimmer animation for skeleton effect
const shimmer = keyframes({
  '0%': { backgroundPosition: '-200px 0' },
  '100%': { backgroundPosition: 'calc(200px + 100%) 0' },
});

// Base spinner container
const base = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
});

// Spinner circle
const spinner = style({
  border: '2px solid transparent',
  borderTopColor: '#3B82F6',
  borderRadius: '50%',
  animation: `${spin} 1s linear infinite`,
});

// Size variants
const small = style({
  width: '12px',
  height: '12px',
});

const medium = style({
  width: '16px',
  height: '16px',
});

const large = style({
  width: '24px',
  height: '24px',
});

// Color variants
const primary = style({
  borderTopColor: '#3B82F6',
});

const secondary = style({
  borderTopColor: '#6B7280',
});

const success = style({
  borderTopColor: '#059669',
});

const warning = style({
  borderTopColor: '#D97706',
});

const danger = style({
  borderTopColor: '#DC2626',
});

// Skeleton styles for metrics loading
const skeletonBase = style({
  background: 'linear-gradient(90deg, #F3F4F6 0%, #E5E7EB 50%, #F3F4F6 100%)',
  backgroundSize: '200px 100%',
  animation: `${shimmer} 1.5s ease-in-out infinite`,
  borderRadius: '4px',
});

const skeletonBadge = style([
  skeletonBase,
  {
    width: '48px',
    height: '20px',
    borderRadius: '12px',
  },
]);

const skeletonText = style([
  skeletonBase,
  {
    width: '100%',
    height: '16px',
  },
]);

const skeletonMetric = style([
  skeletonBase,
  {
    width: '32px',
    height: '16px',
    borderRadius: '8px',
  },
]);

// Pulse loading for content
const pulseContainer = style({
  animation: `${pulseKeyframes} 2s ease-in-out infinite`,
});

export const loadingSpinner = {
  base,
  spinner,
  // Size variants
  small,
  medium,
  large,
  // Color variants
  primary,
  secondary,
  success,
  warning,
  danger,
};

export const skeleton = {
  base: skeletonBase,
  badge: skeletonBadge,
  text: skeletonText,
  metric: skeletonMetric,
};

export const pulse = {
  container: pulseContainer,
};
