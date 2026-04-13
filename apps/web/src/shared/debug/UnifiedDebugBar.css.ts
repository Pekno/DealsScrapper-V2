import { style } from '@vanilla-extract/css';

// Main container fixed at bottom of screen
export const debugBarContainer = style({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 9999,
  pointerEvents: 'none', // Allow clicks through the container
});

// Row of small debug buttons
export const debugButtonsRow = style({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 16px',
  pointerEvents: 'auto', // Re-enable clicks for buttons

  '@media': {
    '(max-width: 768px)': {
      padding: '6px 8px',
      gap: '6px',
    },
  },
});

// Individual debug button
export const debugButton = style({
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 12px',
  backgroundColor: 'rgba(0, 0, 0, 0.8)',
  border: '1px solid rgba(0, 0, 0, 0.9)',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '12px',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  minWidth: '70px',
  justifyContent: 'center',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',

  ':hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    transform: 'translateY(-1px)',
  },

  '@media': {
    '(max-width: 768px)': {
      padding: '4px 8px',
      fontSize: '11px',
      minWidth: '60px',
    },
  },
});

export const debugButtonActive = style({
  backgroundColor: 'rgba(59, 130, 246, 0.3)', // Blue background when active
  borderColor: 'rgba(59, 130, 246, 0.6)',
  color: '#93c5fd',

  ':hover': {
    backgroundColor: 'rgba(59, 130, 246, 0.4)',
  },
});

export const debugButtonIcon = style({
  fontSize: '14px',
  lineHeight: 1,

  '@media': {
    '(max-width: 768px)': {
      fontSize: '12px',
    },
  },
});

export const debugButtonTitle = style({
  '@media': {
    '(max-width: 480px)': {
      display: 'none', // Hide text on very small screens, show only icons
    },
  },
});

export const debugButtonIndicator = style({
  fontSize: '10px',
  color: '#93c5fd',
  marginLeft: '2px',
});

// Expanded panel container (appears above buttons)
export const expandedPanelContainer = style({
  position: 'absolute',
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: '8px',
  pointerEvents: 'auto',
  maxWidth: '90vw',
  width: '600px',

  '@media': {
    '(max-width: 768px)': {
      width: '95vw',
      left: '2.5vw',
      transform: 'none',
    },
  },
});

export const expandedPanel = style({
  backgroundColor: 'rgba(0, 0, 0, 0.95)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  maxHeight: '400px',
  display: 'flex',
  flexDirection: 'column',
});

export const expandedPanelHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  flexShrink: 0,
});

export const expandedPanelTitle = style({
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  margin: 0,
});

export const closeButton = style({
  background: 'none',
  border: 'none',
  color: '#999',
  fontSize: '20px',
  cursor: 'pointer',
  padding: '0',
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
  transition: 'all 0.2s ease',

  ':hover': {
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

export const expandedPanelContent = style({
  padding: '16px',
  color: '#ccc',
  fontSize: '12px',
  lineHeight: '1.4',
  overflowY: 'auto',
  flex: 1,

  // Custom scrollbar
  '::-webkit-scrollbar': {
    width: '6px',
  },
  '::-webkit-scrollbar-track': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
  },
  '::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: '3px',
  },
  selectors: {
    '&::-webkit-scrollbar-thumb:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
  },
});

// Animation for panel expansion (removed keyframes as they should be defined separately)
export const expandAnimation = style({
  animation: 'expandUp 0.2s ease-out forwards',
});
