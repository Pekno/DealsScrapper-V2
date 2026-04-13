/**
 * NotificationBell component styles using Vanilla Extract
 * Bell-specific notification component with animations and enhanced visual feedback
 */
import { style, keyframes, styleVariants } from '@vanilla-extract/css';

// Bell ring animation
const bellRingAnimation = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '10%': { transform: 'rotate(14deg)' },
  '20%': { transform: 'rotate(-8deg)' },
  '30%': { transform: 'rotate(14deg)' },
  '40%': { transform: 'rotate(-4deg)' },
  '50%': { transform: 'rotate(10deg)' },
  '60%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(0deg)' },
});

// Badge bounce animation for new notifications
const badgeBounceAnimation = keyframes({
  '0%': { transform: 'scale(1)' },
  '20%': { transform: 'scale(1.25)' },
  '40%': { transform: 'scale(1.15)' },
  '60%': { transform: 'scale(1.25)' },
  '80%': { transform: 'scale(1.05)' },
  '100%': { transform: 'scale(1)' },
});

// Bell icon container with hover effects
const bellIcon = style({
  transition: 'transform 0.2s ease-in-out',
  transformOrigin: 'top center',

  selectors: {
    '&:hover': {
      transform: 'rotate(-5deg)',
    },
  },
});

// Bell with ring animation
const bellIconRinging = style([
  bellIcon,
  {
    animation: `${bellRingAnimation} 1s ease-in-out`,
  },
]);

// Enhanced badge with bounce animation
const bouncingBadge = style({
  animation: `${badgeBounceAnimation} 0.6s ease-out`,
});

// Bell size variants for consistent icon scaling
const bellSizes = styleVariants({
  sm: {
    fontSize: '1rem', // 16px
    width: '1rem',
    height: '1rem',
  },
  md: {
    fontSize: '1.25rem', // 20px
    width: '1.25rem',
    height: '1.25rem',
  },
  lg: {
    fontSize: '1.5rem', // 24px
    width: '1.5rem',
    height: '1.5rem',
  },
});

// Custom SVG bell icon styling
const bellSvg = style({
  fill: 'currentColor',
  stroke: 'currentColor',
  strokeWidth: '0',
});

// Enhanced accessibility styles
const accessibleBell = style({
  // Ensure proper contrast and focus states
  ':focus-visible': {
    outline: '3px solid #0F62FE',
    outlineOffset: '3px',
    borderRadius: '0.5rem',
  },

  // High contrast mode support handled via browser defaults

  // Reduced motion support handled in components
});

export const notificationBell = {
  bellIcon,
  bellIconRinging,
  bouncingBadge,
  bellSizes,
  bellSvg,
  accessibleBell,
};
