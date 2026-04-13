export interface IUrlOptimizer {
  /**
   * Optimizes scraping URL with filter constraints.
   * Adds query parameters to reduce HTML response size.
   */
  optimizeUrl(baseUrl: string, constraints: FilterConstraints): string;

  /**
   * Checks if this site supports URL optimization.
   */
  supportsOptimization(): boolean;

  /**
   * Analyzes filters and extracts constraints for optimization.
   */
  extractConstraints(filters: unknown[]): FilterConstraints;
}

export interface FilterConstraints {
  price?: { min: number | null; max: number | null };
  temperature?: { min: number | null; max: number | null };
  merchants?: string[];
  // Site-specific fields can be added via extension
  [key: string]: unknown;
}
