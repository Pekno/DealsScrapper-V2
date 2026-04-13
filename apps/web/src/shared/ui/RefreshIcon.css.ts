/**
 * RefreshIcon styles with smooth spinning animation
 */
import { style, keyframes, styleVariants } from '@vanilla-extract/css';

// Smooth spin animation
const spinAnimation = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

// Base icon styles
const baseIcon = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease-in-out',
  transformOrigin: 'center',
});

// Size variants
const iconSizes = styleVariants({
  sm: {
    width: '14px',
    height: '14px',
  },
  md: {
    width: '16px',
    height: '16px',
  },
  lg: {
    width: '20px',
    height: '20px',
  },
});

// Spinning state
const spinningIcon = style({
  animation: `${spinAnimation} 1s linear infinite`,
});

export const refreshIcon = {
  base: baseIcon,
  sizes: iconSizes,
  spinning: spinningIcon,
};
