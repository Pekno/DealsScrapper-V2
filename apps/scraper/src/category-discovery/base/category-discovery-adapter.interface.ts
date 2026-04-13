/**
 * Interface for site-specific category discovery adapters
 * Each site implements this interface to provide category metadata
 */
export interface ICategoryDiscoveryAdapter {
  /**
   * Site identifier (dealabs, vinted, leboncoin)
   */
  readonly siteId: string;

  /**
   * Base URL for the site
   */
  readonly baseUrl: string;

  /**
   * Discovers all available categories from the site homepage/catalog
   * @returns Promise resolving to array of category metadata
   */
  discoverCategories(): Promise<CategoryMetadata[]>;

  /**
   * Builds hierarchical category tree structure
   * Useful for sites with nested categories (e.g., LeBonCoin)
   * @returns Promise resolving to tree of category nodes
   */
  buildCategoryTree(): Promise<CategoryNode[]>;
}

/**
 * Metadata for a single category discovered from a site
 */
export interface CategoryMetadata {
  /**
   * URL-friendly identifier (e.g., 'informatique', 'mode')
   */
  slug: string;

  /**
   * Human-readable category name
   */
  name: string;

  /**
   * Full URL to the category page on the source site
   */
  url: string;

  /**
   * Parent category identifier for hierarchical structures.
   * During discovery, this holds the parent's slug.
   * When saved to DB, this is resolved to the actual category ID.
   * null for top-level categories.
   */
  parentId: string | null;

  /**
   * Whether users can select this category for filters.
   * false for synthetic navigation-only categories (e.g., Vinted main tabs like "Femmes", "Hommes")
   * true for real categories that have scrapeable URLs.
   * Defaults to true if not specified.
   */
  isSelectable?: boolean;
}

/**
 * Node in a hierarchical category tree
 * Extends CategoryMetadata with children
 */
export interface CategoryNode extends CategoryMetadata {
  /**
   * Child categories (empty array for leaf nodes)
   */
  children: CategoryNode[];
}
