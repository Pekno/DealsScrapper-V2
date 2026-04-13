/**
 * ProductCard styles using Vanilla Extract
 * Card-based design with responsive layout and hover effects
 */
import { style, styleVariants } from '@vanilla-extract/css';

// Card container
export const card = style({
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'white',
  borderRadius: '12px',
  border: '1px solid #E5E7EB',
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  transition: 'all 0.2s ease-in-out',
  overflow: 'hidden',
  height: '100%',

  ':hover': {
    transform: 'translateY(-2px)',
    boxShadow:
      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    borderColor: '#0F62FE',
  },
});

// Card size variants
export const cardSize = styleVariants({
  sm: {
    minHeight: '320px',
  },
  md: {
    minHeight: '360px',
  },
  lg: {
    minHeight: '400px',
  },
});

// Image section
export const imageContainer = style({
  position: 'relative',
  width: '100%',
  height: '180px',
  backgroundColor: '#F9FAFB',
  overflow: 'hidden',

  '@media': {
    '(max-width: 640px)': {
      height: '150px',
    },
  },
});

export const productImage = style({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  transition: 'transform 0.2s ease-in-out',

  ':hover': {
    transform: 'scale(1.05)',
  },
});

export const imagePlaceholder = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  backgroundColor: '#F3F4F6',
  color: '#9CA3AF',
});

export const placeholderIcon = style({
  fontSize: '3rem',
  opacity: 0.6,
});

export const hidden = style({
  display: 'none',
});

// Content section
export const content = style({
  display: 'flex',
  flexDirection: 'column',
  padding: '1rem',
  gap: '0.75rem',
  flex: 1,
});

// Title section
export const titleContainer = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.5rem',
});

export const categoryIcon = style({
  fontSize: '1.25rem',
  flexShrink: 0,
  marginTop: '0.125rem',

  '@media': {
    '(max-width: 640px)': {
      fontSize: '1rem',
    },
  },
});

export const productTitle = style({
  fontSize: '0.95rem',
  fontWeight: '600',
  color: '#1F2937',
  lineHeight: '1.4',
  margin: 0,
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',

  '@media': {
    '(max-width: 640px)': {
      fontSize: '0.875rem',
    },
  },
});

// Pricing section
export const pricingSection = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
});

export const originalPrice = style({
  fontSize: '0.875rem',
  color: '#9CA3AF',
  textDecoration: 'line-through',
  fontWeight: '500',
});

export const currentPrice = style({
  fontSize: '1.1rem',
  fontWeight: '700',
  color: '#059669',

  '@media': {
    '(max-width: 640px)': {
      fontSize: '1rem',
    },
  },
});

export const discount = style({
  fontSize: '0.8rem',
  fontWeight: '600',
  color: '#DC2626',
  backgroundColor: '#FEF2F2',
  padding: '0.25rem 0.5rem',
  borderRadius: '6px',
  alignSelf: 'flex-start',
  border: '1px solid #FECACA',
});

// Merchant
export const merchant = style({
  fontSize: '0.875rem',
  color: '#6B7280',
  fontWeight: '500',

  '@media': {
    '(max-width: 640px)': {
      fontSize: '0.8rem',
    },
  },
});

// Scores row
export const scoresRow = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
});

export const heatScore = style({
  fontSize: '0.875rem',
  fontWeight: '600',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
});

export const matchScore = style({
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#7C3AED',
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
});

// Action row
export const actionRow = style({
  marginTop: 'auto',
  paddingTop: '0.5rem',
});

export const viewButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '0.625rem 1rem',
  borderRadius: '8px',
  backgroundColor: '#0F62FE',
  color: 'white',
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: '600',
  transition: 'all 0.2s ease-in-out',
  gap: '0.5rem',

  ':hover': {
    backgroundColor: '#0D4FDB',
    transform: 'translateY(-1px)',
  },

  ':focus': {
    outline: '2px solid #0F62FE',
    outlineOffset: '2px',
  },

  ':active': {
    transform: 'translateY(0)',
  },
});
