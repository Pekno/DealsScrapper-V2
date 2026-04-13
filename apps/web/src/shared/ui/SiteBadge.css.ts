/**
 * SiteBadge Styles
 * Vanilla Extract styles for the site badge component
 */
import { style, styleVariants } from '@vanilla-extract/css';

export const siteBadge = {
  base: style({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    borderRadius: '4px',
    border: '1px solid',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
  }),

  small: style({
    fontSize: '11px',
    padding: '2px 6px',
    gap: '3px',
  }),

  medium: style({
    fontSize: '12px',
    padding: '4px 8px',
    gap: '4px',
  }),

  large: style({
    fontSize: '14px',
    padding: '6px 12px',
    gap: '6px',
  }),

  icon: style({
    fontSize: '14px',
    lineHeight: 1,
  }),

  name: style({
    lineHeight: 1,
  }),
};
