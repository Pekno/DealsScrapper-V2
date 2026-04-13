/**
 * MatchesTable styles - Modern, clean table design for filter matches
 * Following the design system established in the app
 */
import { style, keyframes, globalStyle } from '@vanilla-extract/css';

// Container for the entire table section
export const tableContainer = style({
  width: '100%',
});

// Header section with search and controls
export const tableHeader = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '1.5rem',
  gap: '1rem',

  '@media': {
    '(max-width: 768px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: '1rem',
    },
  },
});

export const searchContainer = style({
  position: 'relative',
  flex: 1,
  maxWidth: '400px',

  '@media': {
    '(max-width: 768px)': {
      maxWidth: '100%',
    },
  },
});

export const searchInput = style({
  width: '100%',
  padding: '0.75rem 1rem',
  paddingLeft: '2.5rem',
  paddingRight: '2.5rem', // Make room for clear button
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  fontSize: '0.875rem',
  backgroundColor: '#F9FAFB',
  color: '#1F2937', // Fix: Add text color for visibility
  transition: 'all 0.2s ease',

  ':focus': {
    outline: 'none',
    borderColor: '#0F62FE',
    backgroundColor: 'white',
    color: '#1F2937', // Ensure text remains visible on focus
    boxShadow: '0 0 0 3px rgba(15, 98, 254, 0.1)',
  },

  '::placeholder': {
    color: '#9CA3AF',
  },
});

export const searchIcon = style({
  position: 'absolute',
  left: '0.75rem',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#9CA3AF',
  fontSize: '1rem',
  pointerEvents: 'none',
});

export const searchClearButton = style({
  position: 'absolute',
  right: '0.75rem',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  color: '#9CA3AF',
  fontSize: '1rem',
  cursor: 'pointer',
  padding: '0.25rem',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',

  ':hover': {
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
  },

  ':active': {
    transform: 'translateY(-50%) scale(0.95)',
  },
});

export const toggleExpiredButton = style({
  position: 'relative',
  marginLeft: '0.75rem',
  background: 'none',
  border: '1px solid #D1D5DB',
  borderRadius: '8px',
  color: '#6B7280',
  fontSize: '1rem',
  cursor: 'pointer',
  padding: '0.75rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.2s ease',
  minWidth: '40px',
  height: '40px',

  ':hover': {
    backgroundColor: '#F3F4F6',
    borderColor: '#9CA3AF',
    color: '#374151',
  },

  ':active': {
    transform: 'scale(0.95)',
  },
});

export const toggleExpiredButtonActive = style([
  toggleExpiredButton,
  {
    backgroundColor: '#EFF6FF',
    borderColor: '#0F62FE',
    color: '#0F62FE',

    ':hover': {
      backgroundColor: '#DBEAFE',
      borderColor: '#0D5CE8',
      color: '#0D5CE8',
    },
  },
]);

export const headerControlsGroup = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0',
});

export const tableControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',

  '@media': {
    '(max-width: 768px)': {
      justifyContent: 'space-between',
      width: '100%',
    },
  },
});

// Modern table styles
export const table = style({
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0',
  backgroundColor: 'white',
  borderRadius: '12px',
  overflow: 'visible', // Allow tooltips to escape the table bounds
  border: '1px solid #E5E7EB',
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  position: 'relative', // Establish stacking context for tooltips
});

export const tableHeaderRow = style({
  backgroundColor: '#F9FAFB',
  borderBottom: '1px solid #E5E7EB',
});

export const headerCell = style({
  padding: '1rem',
  textAlign: 'left',
  fontSize: '0.875rem',
  fontWeight: '600',
  color: '#374151',
  borderRight: '1px solid #E5E7EB',
  cursor: 'pointer',
  position: 'relative',
  userSelect: 'none',
  transition: 'background-color 0.15s ease',
  // DO NOT use display: flex - let it be table-cell for horizontal layout
  // Use flexbox on inner content via headerContent wrapper

  ':hover': {
    backgroundColor: '#F3F4F6',
  },

  selectors: {
    '&:last-child': {
      borderRight: 'none',
    },
  },
});

export const sortIndicator = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  color: '#9CA3AF',
  transition: 'all 0.15s ease',
  flexShrink: 0,
  width: '16px',
  height: '16px',
});

export const sortIndicatorActive = style([
  sortIndicator,
  {
    color: '#0F62FE',
    fontWeight: '700',
    transform: 'scale(1.2)',
    opacity: 1,
  },
]);

// SVG Sort Icons - Active state (bold and prominent)
export const sortIconUp = style({
  width: '12px',
  height: '12px',
  fill: 'currentColor',
  strokeWidth: '2',
  fontWeight: 'bold',
});

export const sortIconDown = style([
  sortIconUp,
  {
    transform: 'rotate(180deg)',
  },
]);

export const sortIconNeutral = style({
  width: '20px',
  height: '20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1px',
  opacity: '0.6',
});

// SVG arrow styles
export const sortArrow = style({
  width: '16px',
  height: '16px',
  transition: 'all 0.15s ease',
  color: 'currentColor',
});

export const sortArrowUp = style([
  sortArrow,
  {
    marginBottom: '1px',
  },
]);

export const sortArrowDown = style([
  sortArrow,
  {
    marginTop: '1px',
  },
]);

// Active state for individual arrows when applied directly
export const sortArrowActive = style({
  color: '#0F62FE',
  fontWeight: '700',
  transform: 'scale(1.1)',
  filter: 'brightness(1.2)',
  opacity: '1',
});

// Header content wrapper for flexbox layout inside table cell
export const headerContent = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  width: '100%',
});

// Header text styling for proper alignment
export const headerText = style({
  flex: '1',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

export const tableRow = style({
  borderBottom: '1px solid #F3F4F6',
  cursor: 'pointer',
  transition: 'all 0.15s ease',

  ':hover': {
    backgroundColor: '#F8FAFC',
  },

  selectors: {
    '&:last-child': {
      borderBottom: 'none',
    },
  },
});

// Expired article row styling
export const expiredTableRow = style([
  tableRow,
  {
    opacity: 0.5,
    transition: 'all 0.2s ease',

    ':hover': {
      backgroundColor: '#F8FAFC',
      opacity: 0.85,
    },
  },
]);

export const tableCell = style({
  padding: '1rem',
  fontSize: '0.875rem',
  color: '#1F2937',
  borderRight: '1px solid #F3F4F6',
  verticalAlign: 'middle',
  overflow: 'visible', // Allow content to escape cell boundaries

  selectors: {
    '&:last-child': {
      borderRight: 'none',
    },
  },
});

export const productNameCell = style([
  tableCell,
  {
    fontWeight: '500',
    minWidth: '200px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    position: 'relative',
    cursor: 'help',
    overflow: 'visible', // Ensure tooltips can escape
  },
]);

// Inline thumbnail styles
export const productThumbnail = style({
  width: '40px',
  height: '40px',
  borderRadius: '6px',
  objectFit: 'cover',
  border: '1px solid #E5E7EB',
  flexShrink: 0,
});

export const thumbnailPlaceholder = style({
  width: '40px',
  height: '40px',
  borderRadius: '6px',
  backgroundColor: '#F3F4F6',
  border: '1px solid #E5E7EB',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1rem',
  color: '#9CA3AF',
  flexShrink: 0,
});

export const productTitle = style({
  flex: 1,
  lineHeight: '1.3',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
});

export const heatCell = style([
  tableCell,
  {
    textAlign: 'center',
    fontWeight: '600',
    minWidth: '80px',
  },
]);

export const priceCell = style([
  tableCell,
  {
    textAlign: 'right',
    fontWeight: '500',
    minWidth: '80px',
  },
]);

export const originalPrice = style({
  textDecoration: 'line-through',
  color: '#9CA3AF',
  fontSize: '0.8125rem',
  marginRight: '0.5rem',
});

export const currentPrice = style({
  fontSize: '1rem',
  fontWeight: '600',
  color: '#059669',
});

export const discountCell = style([
  tableCell,
  {
    textAlign: 'center',
    fontWeight: '500',
    minWidth: '70px',
  },
]);

export const discountBadge = style({
  display: 'inline-block',
  padding: '0.25rem 0.5rem',
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: '600',
  backgroundColor: '#FEE2E2',
  color: '#DC2626',
});

export const shopCell = style([
  tableCell,
  {
    minWidth: '100px',
    fontSize: '0.8125rem',
    fontWeight: '500',
  },
]);

export const scoreCell = style([
  tableCell,
  {
    textAlign: 'center',
    fontWeight: '600',
    minWidth: '70px',
  },
]);

export const scoreBadge = style({
  display: 'inline-block',
  padding: '0.25rem 0.5rem',
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: '600',
  backgroundColor: '#DBEAFE',
  color: '#1E40AF',
});

export const dateCell = style([
  tableCell,
  {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: '0.8125rem',
    minWidth: '60px',
    position: 'relative',
    cursor: 'help',
    overflow: 'visible', // Ensure tooltips can escape
  },
]);

// Date tooltip for showing scraped date on hover
export const dateTooltip = style({
  position: 'absolute',
  zIndex: 9999,
  width: '200px',
  backgroundColor: 'rgba(17, 24, 39, 0.95)',
  color: 'white',
  textAlign: 'center',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '12px',
  fontWeight: '500',
  lineHeight: '1.5',
  boxShadow:
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  pointerEvents: 'none',

  // Position above the cell
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: '8px',

  // Hide by default
  opacity: 0,
  visibility: 'hidden',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',

  // Arrow pointing down
  '::after': {
    content: '',
    position: 'absolute',
    top: '100%',
    left: '50%',
    marginLeft: '-4px',
    borderWidth: '4px',
    borderStyle: 'solid',
    borderColor: 'rgba(17, 24, 39, 0.95) transparent transparent transparent',
  },

  // Show on hover - force full opacity regardless of parent
  selectors: {
    [`${dateCell}:hover &`]: {
      opacity: '1 !important',
      visibility: 'visible',
    },
  },
});

// Expired article tooltip with warning styling
export const expiredDateTooltip = style([
  dateTooltip,
  {
    backgroundColor: 'rgba(220, 38, 38, 0.95)', // Red background for expired items
    width: '220px',

    // Arrow pointing down with red color
    '::after': {
      borderColor:
        'rgba(220, 38, 38, 0.95) transparent transparent transparent',
    },
  },
]);

// Product name tooltip for showing larger image and complete title
export const productTooltip = style({
  position: 'absolute',
  zIndex: 9999,
  width: '300px',
  backgroundColor: 'rgba(17, 24, 39, 0.95)',
  color: 'white',
  borderRadius: '12px',
  padding: '16px',
  fontSize: '14px',
  lineHeight: '1.4',
  boxShadow:
    '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  pointerEvents: 'none',

  // Position above the cell
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: '8px',

  // Hide by default
  opacity: 0,
  visibility: 'hidden',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',

  // Arrow pointing down
  '::after': {
    content: '',
    position: 'absolute',
    top: '100%',
    left: '50%',
    marginLeft: '-6px',
    borderWidth: '6px',
    borderStyle: 'solid',
    borderColor: 'rgba(17, 24, 39, 0.95) transparent transparent transparent',
  },

  // Show on hover - force full opacity regardless of parent
  selectors: {
    [`${productNameCell}:hover &`]: {
      opacity: '1 !important',
      visibility: 'visible',
    },
  },
});

export const productTooltipImage = style({
  width: '100%',
  height: '160px',
  objectFit: 'cover',
  borderRadius: '8px',
  marginBottom: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
});

export const productTooltipImagePlaceholder = style({
  width: '100%',
  height: '160px',
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  marginBottom: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '2rem',
  color: 'rgba(255, 255, 255, 0.5)',
});

export const productTooltipTitle = style({
  fontSize: '14px',
  fontWeight: '600',
  color: 'white',
  lineHeight: '1.4',
  margin: '0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 3,
  WebkitBoxOrient: 'vertical',
});

// Enhanced date cell with hover functionality
// Removed invalid CSS selector - tooltip visibility is controlled by React state

// Image hover tooltip
export const imageTooltip = style({
  position: 'absolute',
  zIndex: 1000,
  backgroundColor: 'white',
  border: '1px solid #E5E7EB',
  borderRadius: '8px',
  padding: '0.5rem',
  boxShadow:
    '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  opacity: 0,
  transform: 'translateY(-10px)',
  transition: 'all 0.2s ease',
  pointerEvents: 'none',
});

export const imageTooltipVisible = style([
  imageTooltip,
  {
    opacity: 1,
    transform: 'translateY(0)',
  },
]);

export const tooltipImage = style({
  width: '150px',
  height: '90px',
  objectFit: 'cover',
  borderRadius: '4px',
});

export const tooltipPlaceholder = style({
  width: '150px',
  height: '90px',
  backgroundColor: '#F3F4F6',
  borderRadius: '4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  color: '#9CA3AF',
});

// Loading and empty states
export const loadingContainer = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4rem 2rem',
  gap: '1rem',
});

const spin = keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(360deg)' },
});

export const spinner = style({
  width: '2rem',
  height: '2rem',
  border: '3px solid #F3F4F6',
  borderTop: '3px solid #0F62FE',
  borderRadius: '50%',
  animation: `${spin} 1s linear infinite`,
});

export const loadingText = style({
  fontSize: '1rem',
  color: '#6B7280',
});

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4rem 2rem',
  gap: '1rem',
  textAlign: 'center',
});

export const emptyStateText = style({
  fontSize: '1rem',
  color: '#6B7280',
  margin: '0',
});

// Pagination styles
export const pagination = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '2rem',
  padding: '1rem 0',
  borderTop: '1px solid #F3F4F6',

  '@media': {
    '(max-width: 768px)': {
      flexDirection: 'column',
      gap: '1rem',
      alignItems: 'stretch',
    },
  },
});

export const paginationInfo = style({
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  fontSize: '0.875rem',
  color: '#6B7280',

  '@media': {
    '(max-width: 768px)': {
      justifyContent: 'space-between',
    },
  },
});

export const itemsPerPageContainer = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

export const itemsPerPageSelect = style({
  // Removed border as the custom Dropdown component handles its own styling
  fontSize: '0.875rem',
});

export const paginationControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

export const pageNumbers = style({
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  margin: '0 1rem',
});

export const pageButton = style({
  minWidth: '2.5rem',
  height: '2.5rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid #D1D5DB',
  borderRadius: '6px',
  backgroundColor: 'white',
  color: '#374151',
  fontSize: '0.875rem',
  fontWeight: '500',
  cursor: 'pointer',
  transition: 'all 0.15s ease',

  ':hover': {
    backgroundColor: '#F9FAFB',
    borderColor: '#9CA3AF',
  },
});

export const pageButtonActive = style([
  pageButton,
  {
    backgroundColor: '#0F62FE',
    borderColor: '#0F62FE',
    color: 'white',

    ':hover': {
      backgroundColor: '#0D5CE8',
      borderColor: '#0D5CE8',
    },
  },
]);

export const pageEllipsis = style({
  padding: '0.5rem',
  color: '#9CA3AF',
  fontSize: '0.875rem',
});

// Site details cell (consolidated site-specific attributes)
export const detailsCell = style([
  tableCell,
  {
    minWidth: '160px',
    maxWidth: '240px',
    verticalAlign: 'middle',
  },
]);

export const detailsTagList = style({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  alignItems: 'center',
});

export const detailsTag = style({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  padding: '2px 8px',
  borderRadius: '9999px',
  fontSize: '0.6875rem',
  fontWeight: '500',
  lineHeight: '1.4',
  backgroundColor: '#F3F4F6',
  color: '#374151',
  whiteSpace: 'nowrap',
});

export const detailsTagLabel = style({
  color: '#9CA3AF',
  fontWeight: '400',
});

export const detailsTagHeat = style([
  detailsTag,
  {
    fontWeight: '700',
  },
]);

export const detailsTagDiscount = style([
  detailsTag,
  {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    fontWeight: '600',
  },
]);

// Responsive table wrapper
export const tableWrapper = style({
  // Remove overflow-x: auto to allow tooltips to escape
  overflowY: 'visible', // Allow vertical tooltips to escape
  // Ensure tooltips can escape in all directions
  position: 'static',

  '@media': {
    '(max-width: 768px)': {
      marginLeft: '-1rem',
      marginRight: '-1rem',
      overflowX: 'auto', // Only add horizontal scroll on mobile when needed
    },
  },
});

// Global styles for table responsiveness
globalStyle(`${tableWrapper}::-webkit-scrollbar`, {
  height: '8px',
});

globalStyle(`${tableWrapper}::-webkit-scrollbar-track`, {
  backgroundColor: '#F3F4F6',
});

globalStyle(`${tableWrapper}::-webkit-scrollbar-thumb`, {
  backgroundColor: '#D1D5DB',
  borderRadius: '4px',
});

globalStyle(`${tableWrapper}::-webkit-scrollbar-thumb:hover`, {
  backgroundColor: '#9CA3AF',
});

// Fix rounded corners for all table cells to respect table border radius
globalStyle(`${table} thead tr:first-child th:first-child`, {
  borderTopLeftRadius: '12px',
});

globalStyle(`${table} thead tr:first-child th:last-child`, {
  borderTopRightRadius: '12px',
});

globalStyle(`${table} tbody tr:last-child td:first-child`, {
  borderBottomLeftRadius: '12px',
});

globalStyle(`${table} tbody tr:last-child td:last-child`, {
  borderBottomRightRadius: '12px',
});
