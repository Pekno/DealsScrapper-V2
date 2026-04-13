import { style } from '@vanilla-extract/css';

export const notificationItem = style({
  padding: '12px',
  borderRadius: '0',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  transition: 'background-color 0.2s ease',
  border: 'none',
  outline: 'none',

  ':hover': {
    backgroundColor: '#f9fafb', // gray-50
  },

  ':focus': {
    backgroundColor: '#f3f4f6', // gray-100
    outline: '2px solid #3b82f6',
    outlineOffset: '-2px',
  },
});

export const contentContainer = style({
  width: '100%',
});

// Deal notification styles (enhanced with image)
export const dealContainer = style({
  display: 'flex',
  gap: '12px',
  marginBottom: '8px',
});

export const imageContainer = style({
  flexShrink: 0,
  position: 'relative',
});

export const dealImage = style({
  width: '64px',
  height: '64px',
  objectFit: 'cover',
  borderRadius: '8px',
  border: '1px solid #e5e7eb', // gray-200
});

export const fallbackIcon = style({
  width: '64px',
  height: '64px',
  background: 'linear-gradient(to bottom right, #dbeafe, #e9d5ff)', // blue-100 to purple-100
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export const dealContent = style({
  flex: 1,
  minWidth: 0,
});

export const dealHeader = style({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '8px',
});

export const dealTitleContainer = style({
  flex: 1,
  minWidth: 0,
});

export const dealTitle = style({
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1.25',
  color: '#111827', // gray-900
  marginBottom: '4px',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

export const dealMessage = style({
  fontSize: '14px',
  lineHeight: '1.25',
  color: '#374151', // gray-700
  marginBottom: '4px',
});

export const dealMeta = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginTop: '4px',
});

export const merchantBadge = style({
  fontSize: '12px',
  color: '#6b7280', // gray-500
  backgroundColor: '#f3f4f6', // gray-100
  padding: '2px 8px',
  borderRadius: '4px',
});

export const temperatureBadge = style({
  fontSize: '12px',
  padding: '2px 8px',
  borderRadius: '4px',
  fontWeight: '500',
});

export const hotDeal = style({
  backgroundColor: '#fee2e2', // red-100
  color: '#dc2626', // red-600
});

export const warmDeal = style({
  backgroundColor: '#fed7aa', // orange-100
  color: '#ea580c', // orange-600
});

export const coolDeal = style({
  backgroundColor: '#dbeafe', // blue-100
  color: '#2563eb', // blue-600
});

export const priceContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginTop: '8px',
});

export const price = style({
  fontSize: '18px',
  fontWeight: '700',
  color: '#059669', // green-600
});

export const discount = style({
  fontSize: '14px',
  fontWeight: '500',
  color: '#dc2626', // red-600
  backgroundColor: '#fee2e2', // red-50
  padding: '2px 8px',
  borderRadius: '4px',
});

export const score = style({
  fontSize: '12px',
  color: '#6b7280', // gray-600
  backgroundColor: '#f9fafb', // gray-50
  padding: '2px 8px',
  borderRadius: '4px',
});

// Standard notification styles
export const standardContainer = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '8px',
});

export const iconContainer = style({
  flexShrink: 0,
});

export const standardContent = style({
  flex: 1,
  minWidth: 0,
});

export const standardHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

export const standardTitle = style({
  fontSize: '14px',
  fontWeight: '500',
  color: '#111827', // gray-900
});

export const standardMessage = style({
  fontSize: '14px',
  marginTop: '4px',
  color: '#374151', // gray-700
});

// Read state styles
export const readTitle = style({
  color: '#6b7280', // gray-500
});

export const readMessage = style({
  color: '#9ca3af', // gray-400
});

// Common elements
export const unreadDot = style({
  width: '8px',
  height: '8px',
  backgroundColor: '#2563eb', // blue-600
  borderRadius: '50%',
  flexShrink: 0,
  marginTop: '4px',
});

// Footer styles
export const footer = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '8px',
});

export const footerLeft = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const footerRight = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const timestamp = style({
  fontSize: '12px',
  color: '#6b7280', // gray-500
});

export const typeBadge = style({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '2px 8px',
  fontSize: '12px',
  borderRadius: '999px',
});

export const viewDealButton = style({
  fontSize: '12px',
  color: '#2563eb', // blue-600
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontWeight: '500',
  padding: '2px 4px',
  borderRadius: '4px',
  transition: 'color 0.2s ease',

  ':hover': {
    color: '#1d4ed8', // blue-700
  },
});
