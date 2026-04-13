/**
 * CategoryTags - Display category tags with consistent color coding
 * Uses category ID to generate fixed colors across all pages
 */
import React from 'react';
import Badge from '@/shared/ui/Badge';

export interface Category {
  id: string;
  name: string;
  slug: string;
  color?: string;
  displayPath?: string; // Pre-built hierarchy string like "Femmes -> Vetements -> Shorts"
}

export interface CategoryTagsProps {
  /** Array of categories to display */
  categories: Category[];
  /** Maximum number of visible tags (rest will show as "+X more") */
  maxVisible?: number;
  /** Size of the tags */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class name */
  className?: string;
  /** Callback when a category is clicked */
  onCategoryClick?: (category: Category) => void;
}

// Predefined color schemes - ensuring good contrast and visibility
const COLOR_SCHEMES = [
  ['#DBEAFE', '#1E40AF'], // Blue background, blue text
  ['#DCFCE7', '#166534'], // Green background, green text
  ['#E9D5FF', '#7C2D12'], // Purple background, brown text (better contrast)
  ['#FEF3C7', '#92400E'], // Yellow background, yellow-brown text
  ['#FCE7F3', '#BE185D'], // Pink background, pink text
  ['#E0E7FF', '#3730A3'], // Indigo background, indigo text
  ['#FEE2E2', '#DC2626'], // Red background, red text
  ['#ECFDF5', '#059669'], // Emerald background, emerald text
  ['#FEF7FF', '#A855F7'], // Fuchsia background, fuchsia text
  ['#F0F9FF', '#0284C7'], // Sky background, sky text
  ['#FFFBEB', '#D97706'], // Amber background, amber text
  ['#FDF2F8', '#EC4899'], // Rose background, rose text
] as const;

/**
 * Generate consistent color based on category ID
 * This ensures the same category always has the same color across all pages
 */
export const getCategoryColorById = (categoryId: string): [string, string] => {
  // Create a simple hash from the category ID
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = ((hash << 5) - hash + categoryId.charCodeAt(i)) & 0xffffffff;
  }

  // Use the hash to select a color scheme
  const colorIndex = Math.abs(hash) % COLOR_SCHEMES.length;
  const scheme = COLOR_SCHEMES[colorIndex];
  return [scheme[0], scheme[1]];
};

export const CategoryTags: React.FC<CategoryTagsProps> = ({
  categories,
  maxVisible = 3,
  size = 'sm',
  className = '',
  onCategoryClick,
}) => {
  if (!categories.length) {
    return null;
  }

  const visibleCategories = categories.slice(0, maxVisible);
  const hiddenCount = Math.max(0, categories.length - maxVisible);

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {visibleCategories.map((category) => {
        const [bgColor, textColor] = getCategoryColorById(category.id);

        return (
          <Badge
            key={category.id}
            variant="accent"
            size={size}
            className={
              onCategoryClick
                ? 'cursor-pointer hover:opacity-80 transition-opacity'
                : ''
            }
            onClick={() => onCategoryClick?.(category)}
            style={{
              backgroundColor: bgColor,
              color: textColor,
              border: `1px solid ${bgColor}`,
            }}
          >
            {category.displayPath || category.name}
          </Badge>
        );
      })}

      {hiddenCount > 0 && (
        <Badge variant="default" size={size} className="opacity-70">
          +{hiddenCount} more
        </Badge>
      )}
    </div>
  );
};

export default CategoryTags;
