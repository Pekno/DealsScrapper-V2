/**
 * FormField component styles using Vanilla Extract
 * Following the design system from the create filter mockup
 */
import { style } from '@vanilla-extract/css';

const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1.5rem',
});

const errorContainer = style({});

const label = style({
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#1F2937',
  lineHeight: '1.25rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
});

const required = style({
  color: '#EF4444',
  fontSize: '0.875rem',
  fontWeight: 'normal',
  marginLeft: '0.125rem',
});

const description = style({
  fontSize: '0.875rem',
  color: '#6B7280',
  lineHeight: '1.25rem',
  marginTop: '-0.25rem',
  marginBottom: '0.25rem',
});

const inputWrapper = style({
  display: 'flex',
  flexDirection: 'column',
});

const errorText = style({
  fontSize: '0.875rem',
  color: '#EF4444',
  lineHeight: '1.25rem',
  marginTop: '0.25rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',

  '::before': {
    content: '⚠',
    fontSize: '0.75rem',
    color: '#EF4444',
  },
});

export const formField = {
  container,
  errorContainer,
  label,
  required,
  description,
  inputWrapper,
  errorText,
};
