import { style } from '@vanilla-extract/css';

export const debugPanel = style({
  backgroundColor: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  transition: 'all 0.2s ease',

  ':hover': {
    borderColor: '#555',
    boxShadow: '0 6px 16px rgba(0, 0, 0, 0.2)',
  },
});

export const debugPanelHeader = style({
  backgroundColor: '#2a2a2a',
  padding: '12px 16px',
  borderBottom: '1px solid #333',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'background-color 0.2s ease',

  ':hover': {
    backgroundColor: '#333',
  },
});

export const debugPanelIcon = style({
  fontSize: '16px',
  flexShrink: 0,
});

export const debugPanelTitle = style({
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  flex: 1,
  margin: 0,
});

export const debugPanelToggle = style({
  color: '#888',
  fontSize: '12px',
  fontWeight: '600',
  flexShrink: 0,
  transition: 'color 0.2s ease',

  selectors: {
    [`${debugPanelHeader}:hover &`]: {
      color: '#fff',
    },
  },
});

export const debugPanelContent = style({
  backgroundColor: '#1a1a1a',
  transition: 'all 0.3s ease',
  overflow: 'hidden',
});

export const debugPanelContentInner = style({
  padding: '16px',
  color: '#ccc',
  fontSize: '12px',
  lineHeight: '1.4',
});

export const debugPanelCollapsed = style({
  maxHeight: '0',
  padding: '0 16px',
});

export const debugPanelExpanded = style({
  maxHeight: '400px',
  overflowY: 'auto',
});

// Common debug content styles
export const debugField = style({
  marginBottom: '8px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '8px',
});

export const debugFieldLabel = style({
  color: '#888',
  minWidth: '80px',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
});

export const debugFieldValue = style({
  color: '#fff',
  wordBreak: 'break-all',
  flex: 1,
});

export const debugStatus = style({
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '10px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
});

export const debugStatusSuccess = style([
  debugStatus,
  {
    backgroundColor: '#22c55e',
    color: '#000',
  },
]);

export const debugStatusWarning = style([
  debugStatus,
  {
    backgroundColor: '#f59e0b',
    color: '#000',
  },
]);

export const debugStatusError = style([
  debugStatus,
  {
    backgroundColor: '#ef4444',
    color: '#fff',
  },
]);

export const debugStatusInfo = style([
  debugStatus,
  {
    backgroundColor: '#3b82f6',
    color: '#fff',
  },
]);

export const debugPreview = style({
  backgroundColor: '#0f0f0f',
  border: '1px solid #333',
  borderRadius: '4px',
  padding: '8px',
  fontFamily: 'monospace',
  fontSize: '10px',
  color: '#888',
  overflow: 'auto',
  maxHeight: '100px',
});
