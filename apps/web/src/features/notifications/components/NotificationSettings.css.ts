/**
 * NotificationSettings component styles using Vanilla Extract
 * Following the design system from the create filter mockup
 */
import { style } from '@vanilla-extract/css';

const container = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
});

const option = style({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  padding: '1rem',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  border: '1px solid transparent',

  selectors: {
    '&:hover:not([disabled])': {
      backgroundColor: '#F9FAFB',
      borderColor: '#E5E7EB',
    },
  },

  ':focus-within': {
    backgroundColor: '#F9FAFB',
    borderColor: '#0F62FE',
    outline: 'none',
    boxShadow: '0 0 0 3px rgba(15, 98, 254, 0.1)',
  },
});

const indentedOption = style({
  marginLeft: '1.5rem',
  backgroundColor: '#FAFBFC',
  border: '1px solid #F0F1F2',
});

const disabledOption = style({
  opacity: 0.6,
  cursor: 'not-allowed',

  ':hover': {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
});

const checkboxWrapper = style({
  position: 'relative',
  flexShrink: 0,
});

const checkbox = style({
  position: 'absolute',
  opacity: 0,
  width: 0,
  height: 0,
});

const checkmark = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.25rem',
  height: '1.25rem',
  borderRadius: '0.375rem',
  border: '2px solid #D1D5DB',
  backgroundColor: 'white',
  transition: 'all 0.2s ease-in-out',

  selectors: {
    [`${checkbox}:checked + &`]: {
      backgroundColor: '#0F62FE',
      borderColor: '#0F62FE',
    },

    [`${checkbox}:focus + &`]: {
      outline: '2px solid #0F62FE',
      outlineOffset: '2px',
    },

    [`${disabledOption} &`]: {
      backgroundColor: '#F3F4F6',
      borderColor: '#E5E7EB',
    },

    [`${disabledOption} ${checkbox}:checked + &`]: {
      backgroundColor: '#9CA3AF',
      borderColor: '#9CA3AF',
    },
  },
});

const checkIcon = style({
  width: '0.75rem',
  height: '0.75rem',
  color: 'white',
  strokeWidth: 3,
});

const labelContent = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  flex: 1,
  minWidth: 0,
});

const labelText = style({
  fontSize: '0.875rem',
  fontWeight: '500',
  color: '#1F2937',
  lineHeight: '1.25rem',
});

const descriptionText = style({
  fontSize: '0.75rem',
  color: '#6B7280',
  lineHeight: '1rem',
});

const digestHeader = style({
  fontSize: '0.875rem',
  fontWeight: '500',
  color: '#6B7280',
  marginTop: '0.5rem',
  marginBottom: '-0.5rem',
});

const digestOptions = style({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
});

export const notificationSettings = {
  container,
  option,
  indentedOption,
  disabledOption,
  checkboxWrapper,
  checkbox,
  checkmark,
  checkIcon,
  labelContent,
  labelText,
  descriptionText,
  digestHeader,
  digestOptions,
};
