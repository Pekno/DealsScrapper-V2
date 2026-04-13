/**
 * PageHeader - Reusable page header component with consistent styling
 * Supports flexible actions and maintains consistent design across all pages
 */
import React from 'react';

export interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional page description */
  description?: string;
  /** Action buttons - can be single element or array */
  actions?: React.ReactNode | React.ReactNode[];
  /** Additional CSS classes */
  className?: string;
  /** Children content (for complex headers like search inputs) */
  children?: React.ReactNode;
}

/**
 * PageHeader Component
 *
 * Creates a consistent page header with title, description, and flexible actions.
 * Follows the same styling pattern as existing page headers.
 *
 * @param title - The page title text
 * @param description - Optional description text below title
 * @param actions - Button(s) or other action elements (single or array)
 * @param className - Additional CSS classes to apply
 * @param children - Additional content below title/description (e.g., search inputs)
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  className = '',
  children,
}) => {
  // Normalize actions to array for consistent handling
  const actionElements = React.useMemo(() => {
    if (!actions) return [];
    return Array.isArray(actions) ? actions : [actions];
  }, [actions]);

  return (
    <div className={`px-8 py-6 border-b border-gray-200 bg-white ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && <p className="mt-1 text-gray-600">{description}</p>}
        </div>
        {actionElements.length > 0 && (
          <div className="flex items-center gap-3">
            {actionElements.map((action, index) => (
              <React.Fragment key={index}>{action}</React.Fragment>
            ))}
          </div>
        )}
      </div>
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
};

export default PageHeader;
