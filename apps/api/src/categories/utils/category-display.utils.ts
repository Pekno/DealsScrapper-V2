interface CategoryWithParent {
  name: string;
  level: number;
  parent?: {
    name: string;
    parent?: { name: string } | null;
  } | null;
}

const SEPARATOR = ' \u2192 ';

/**
 * Build the display path for a category by traversing its parent hierarchy.
 */
export function buildCategoryDisplayPath(category: CategoryWithParent): string {
  if (category.level === 0) {
    return category.name;
  }

  if (category.level === 1 && category.parent) {
    return `${category.parent.name}${SEPARATOR}${category.name}`;
  }

  if (category.level === 2 && category.parent) {
    const grandparentName = category.parent.parent?.name;
    if (grandparentName) {
      return `${grandparentName}${SEPARATOR}${category.parent.name}${SEPARATOR}${category.name}`;
    }
    return `${category.parent.name}${SEPARATOR}${category.name}`;
  }

  return category.name;
}

/**
 * Determine if a category is selectable by users.
 * Uses the isSelectable field from the database (set during discovery).
 * Fallback logic for backward compatibility with old data.
 */
export function isCategorySelectable(
  dbIsSelectable: boolean | undefined,
  level: number,
  siteId: string,
): boolean {
  if (dbIsSelectable !== undefined) {
    return dbIsSelectable;
  }
  if (siteId === 'vinted' && level === 0) {
    return false;
  }
  return true;
}
