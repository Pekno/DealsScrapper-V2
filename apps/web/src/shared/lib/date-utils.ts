/**
 * Date utilities using moment.js
 * Centralized date formatting and parsing for consistent behavior across the app
 */

import moment from 'moment';

// Configure moment globally
moment.locale('en'); // Ensure English locale

/**
 * Format a date for display in relative terms (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (
  date: string | Date | moment.Moment
): string => {
  const momentDate = moment(date);
  if (!momentDate.isValid()) {
    return 'Invalid date';
  }
  return momentDate.fromNow();
};

/**
 * Format a date for display in absolute terms (e.g., "January 15, 2025")
 */
export const formatAbsoluteDate = (
  date: string | Date | moment.Moment
): string => {
  const momentDate = moment(date);
  if (!momentDate.isValid()) {
    return 'Invalid date';
  }
  return momentDate.format('MMMM DD, YYYY');
};

/**
 * Format a date with time for detailed display (e.g., "January 15th 2025, 3:30:45 pm")
 */
export const formatDateTime = (date: string | Date | moment.Moment): string => {
  const momentDate = moment(date);
  if (!momentDate.isValid()) {
    return 'Invalid date';
  }
  return momentDate.format('MMMM Do YYYY, h:mm:ss a');
};

/**
 * Format a date in short format (e.g., "01/15/2025")
 */
export const formatShortDate = (
  date: string | Date | moment.Moment
): string => {
  const momentDate = moment(date);
  if (!momentDate.isValid()) {
    return 'Invalid date';
  }
  return momentDate.format('MM/DD/YYYY');
};

/**
 * Check if a date is valid
 */
export const isValidDate = (date: string | Date | moment.Moment): boolean => {
  return moment(date).isValid();
};

/**
 * Parse and validate a date, return null if invalid
 */
export const parseDate = (
  date: string | Date | moment.Moment
): moment.Moment | null => {
  const momentDate = moment(date);
  return momentDate.isValid() ? momentDate : null;
};

/**
 * Safe date formatting with fallback
 */
export const safeDateFormat = (
  date: string | Date | moment.Moment,
  format: string = 'MMMM DD, YYYY',
  fallback: string = 'No date available'
): string => {
  try {
    const momentDate = moment(date);
    if (!momentDate.isValid()) {
      return fallback;
    }
    return momentDate.format(format);
  } catch {
    return fallback;
  }
};

// Export moment for direct use when needed
export { moment };
export default moment;
