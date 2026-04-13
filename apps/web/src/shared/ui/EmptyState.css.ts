/**
 * EmptyState component styles using Vanilla Extract
 * Following the design system from the DealsScrapper mockups
 */
import { style, styleVariants, keyframes } from '@vanilla-extract/css';

const baseContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  textAlign: 'center',
  minHeight: '320px',
  width: '100%',
});

const containerSizes = styleVariants({
  sm: [
    baseContainer,
    {
      padding: '1.5rem',
      minHeight: '200px',
    },
  ],

  md: [
    baseContainer,
    {
      padding: '2rem',
      minHeight: '320px',
    },
  ],

  lg: [
    baseContainer,
    {
      padding: '3rem',
      minHeight: '400px',
    },
  ],
});

const content = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1.5rem',
  maxWidth: '480px',
  margin: '0 auto',
});

// Icon/illustration styles
const iconContainer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '80px',
  height: '80px',
  borderRadius: '50%',
  backgroundColor: '#F3F4F6',
  color: '#9CA3AF',
  fontSize: '2.5rem',
  marginBottom: '0.5rem',

  '@media': {
    '(max-width: 768px)': {
      width: '64px',
      height: '64px',
      fontSize: '2rem',
    },
  },
});

const iconSizes = styleVariants({
  sm: [
    iconContainer,
    {
      width: '56px',
      height: '56px',
      fontSize: '1.75rem',
    },
  ],

  md: [
    iconContainer,
    {
      width: '80px',
      height: '80px',
      fontSize: '2.5rem',
    },
  ],

  lg: [
    iconContainer,
    {
      width: '96px',
      height: '96px',
      fontSize: '3rem',
    },
  ],
});

// Text content styles
const title = style({
  fontSize: '1.5rem',
  fontWeight: '600',
  color: '#1F2937',
  margin: '0',
  lineHeight: '1.4',

  '@media': {
    '(max-width: 768px)': {
      fontSize: '1.25rem',
    },
  },
});

const titleSizes = styleVariants({
  sm: [
    title,
    {
      fontSize: '1.125rem',
    },
  ],

  md: [
    title,
    {
      fontSize: '1.5rem',
    },
  ],

  lg: [
    title,
    {
      fontSize: '1.875rem',
    },
  ],
});

const description = style({
  fontSize: '1rem',
  color: '#6B7280',
  margin: '0',
  lineHeight: '1.6',
  maxWidth: '400px',

  '@media': {
    '(max-width: 768px)': {
      fontSize: '0.875rem',
    },
  },
});

const descriptionSizes = styleVariants({
  sm: [
    description,
    {
      fontSize: '0.875rem',
      maxWidth: '300px',
    },
  ],

  md: [
    description,
    {
      fontSize: '1rem',
      maxWidth: '400px',
    },
  ],

  lg: [
    description,
    {
      fontSize: '1.125rem',
      maxWidth: '500px',
    },
  ],
});

// Action button styles
const actionButton = style({
  marginTop: '0.5rem',
});

// Default icon styles for common scenarios
const defaultIcons = styleVariants({
  filter: {
    color: '#0F62FE',
    backgroundColor: '#EFF6FF',
  },

  search: {
    color: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },

  notification: {
    color: '#10B981',
    backgroundColor: '#ECFDF5',
  },

  error: {
    color: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },

  empty: {
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
  },

  success: {
    color: '#10B981',
    backgroundColor: '#ECFDF5',
  },
});

// Animation for subtle entrance effect
const fadeInUp = keyframes({
  from: {
    opacity: 0,
    transform: 'translateY(16px)',
  },
  to: {
    opacity: 1,
    transform: 'translateY(0)',
  },
});

const animated = style({
  animation: `${fadeInUp} 0.4s ease-out`,

  '@media': {
    '(prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
});

// SVG icon styles for built-in icons
const svgIcon = style({
  width: '100%',
  height: '100%',
  display: 'block',
});

const animatedContent = style([content, animated]);

export const emptyState = {
  container: containerSizes,
  content: animatedContent,
  icon: {
    base: iconSizes,
    variants: defaultIcons,
    svg: svgIcon,
  },
  title: titleSizes,
  description: descriptionSizes,
  actionButton,
};
