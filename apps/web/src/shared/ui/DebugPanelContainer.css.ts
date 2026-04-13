import { style } from '@vanilla-extract/css';

export const debugPanelContainer = style({
  position: 'fixed',
  bottom: '0',
  left: '0',
  right: '0',
  zIndex: 9999,
  backgroundColor: 'rgba(0, 0, 0, 0.95)',
  backdropFilter: 'blur(10px)',
  borderTop: '1px solid #333',
  padding: '16px',
  maxHeight: '50vh',
  overflow: 'hidden',
});

export const debugPanelGrid = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '12px',
  maxWidth: '1200px',
  margin: '0 auto',

  '@media': {
    '(max-width: 768px)': {
      gridTemplateColumns: '1fr',
      gap: '8px',
    },
  },
});

export const debugPanelScrollArea = style({
  maxHeight: 'calc(50vh - 32px)',
  overflowY: 'auto',
  overflowX: 'hidden',

  // Custom scrollbar
  '::-webkit-scrollbar': {
    width: '6px',
  },
  '::-webkit-scrollbar-track': {
    backgroundColor: '#1a1a1a',
  },
  '::-webkit-scrollbar-thumb': {
    backgroundColor: '#666',
    borderRadius: '3px',
  },
  selectors: {
    '&::-webkit-scrollbar-thumb:hover': {
      backgroundColor: '#888',
    },
  },
});
