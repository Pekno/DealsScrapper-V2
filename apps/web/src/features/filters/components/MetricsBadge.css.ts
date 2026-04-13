/**
 * MetricsBadge component styles using Vanilla Extract
 * Simple placeholder styles extending Badge component
 */
import { style } from '@vanilla-extract/css';

export const metricsContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
});

export const metricItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
});

export const metricIcon = style({
  width: '1rem',
  height: '1rem',
  flexShrink: 0,
});

export const metricText = style({
  fontWeight: '500',
  fontSize: '0.875rem',
});
