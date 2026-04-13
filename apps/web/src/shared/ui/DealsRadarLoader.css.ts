/**
 * DealsRadarLoader - Themed loading component for DealsScrapper
 * Features a radar scanning animation hunting for deals
 */
import { style, keyframes } from '@vanilla-extract/css';

// Radar sweep animation
const radarSweep = keyframes({
  '0%': {
    transform: 'rotate(0deg)',
    opacity: 1,
  },
  '50%': {
    opacity: 0.8,
  },
  '100%': {
    transform: 'rotate(360deg)',
    opacity: 1,
  },
});

// Deal blip pulse animation
const dealPulse = keyframes({
  '0%': {
    transform: 'scale(0.8)',
    opacity: 0.6,
  },
  '50%': {
    transform: 'scale(1.2)',
    opacity: 1,
  },
  '100%': {
    transform: 'scale(0.8)',
    opacity: 0.6,
  },
});

// Container styles
export const container = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
  minHeight: '200px',
});

export const radarContainer = style({
  position: 'relative',
  width: '120px',
  height: '120px',
  marginBottom: '1.5rem',
});

// Radar circles (background grid)
export const radarCircle = style({
  position: 'absolute',
  border: '1px solid #E5E7EB',
  borderRadius: '50%',
  opacity: 0.6,
});

export const radarCircle1 = style([
  radarCircle,
  {
    width: '40px',
    height: '40px',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
]);

export const radarCircle2 = style([
  radarCircle,
  {
    width: '80px',
    height: '80px',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
]);

export const radarCircle3 = style([
  radarCircle,
  {
    width: '120px',
    height: '120px',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
]);

// Radar sweep line
export const radarSweepLine = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '60px',
  height: '2px',
  background: 'linear-gradient(90deg, #3B82F6 0%, transparent 100%)',
  transformOrigin: '0 50%',
  transform: 'translate(0, -50%)',
  animation: `${radarSweep} 2s linear infinite`,
  borderRadius: '2px',
});

// Deal blips (detected deals)
export const dealBlip = style({
  position: 'absolute',
  width: '8px',
  height: '8px',
  backgroundColor: '#10B981',
  borderRadius: '50%',
  animation: `${dealPulse} 1.5s ease-in-out infinite`,
  boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
});

export const dealBlip1 = style([
  dealBlip,
  {
    top: '25%',
    left: '35%',
    animationDelay: '0s',
  },
]);

export const dealBlip2 = style([
  dealBlip,
  {
    top: '60%',
    left: '70%',
    animationDelay: '0.3s',
  },
]);

export const dealBlip3 = style([
  dealBlip,
  {
    top: '40%',
    left: '20%',
    animationDelay: '0.6s',
  },
]);

export const dealBlip4 = style([
  dealBlip,
  {
    top: '75%',
    left: '45%',
    animationDelay: '0.9s',
  },
]);

// Center radar hub
export const radarHub = style({
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '12px',
  height: '12px',
  backgroundColor: '#3B82F6',
  borderRadius: '50%',
  transform: 'translate(-50%, -50%)',
  boxShadow: '0 0 12px rgba(59, 130, 246, 0.8)',
});

// Loading text
export const loadingText = style({
  fontSize: '1.125rem',
  fontWeight: '600',
  color: '#374151',
  marginBottom: '0.5rem',
  textAlign: 'center',
});

export const loadingSubtext = style({
  fontSize: '0.875rem',
  color: '#6B7280',
  textAlign: 'center',
  lineHeight: '1.4',
});

// Deal count animation
const countUp = keyframes({
  '0%': { opacity: 0, transform: 'translateY(10px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

export const dealCounter = style({
  display: 'inline-block',
  fontWeight: '700',
  color: '#10B981',
  animation: `${countUp} 0.5s ease-out`,
});

// Size variants
export const sizes = {
  sm: style({
    transform: 'scale(0.8)',
  }),
  md: style({}), // Default size
  lg: style({
    transform: 'scale(1.2)',
  }),
};
