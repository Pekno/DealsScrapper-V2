/**
 * DealSuggestions styles - cross-site "also found on" list shown in an expanded row
 */
import { style } from '@vanilla-extract/css';

export const container = style({
  padding: '0.75rem 1rem',
  backgroundColor: '#F9FAFB',
});

export const heading = style({
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6B7280',
  marginBottom: '0.5rem',
});

export const list = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
});

export const item = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.5rem 0.75rem',
  backgroundColor: 'white',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
});

export const titleLink = style({
  flex: 1,
  minWidth: 0,
  fontSize: '0.875rem',
  color: '#1F2937',
  textDecoration: 'none',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',

  ':hover': {
    color: '#0F62FE',
    textDecoration: 'underline',
  },
});

export const price = style({
  fontSize: '0.875rem',
  fontWeight: 700,
  color: '#1F2937',
  whiteSpace: 'nowrap',
});

export const time = style({
  fontSize: '0.75rem',
  color: '#9CA3AF',
  whiteSpace: 'nowrap',
});

export const message = style({
  fontSize: '0.875rem',
  color: '#9CA3AF',
  padding: '0.5rem 0',
});
