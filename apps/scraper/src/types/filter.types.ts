// Remove unused Prisma import

// Category data structure - matches Prisma Category model
export interface CategoryData {
  id: string;
  slug: string;
  name: string;
  siteId: string;
  parentId?: string | null;
  level: number;
  sourceUrl: string;
  description?: string | null;
  dealCount: number;
  avgTemperature: number;
  popularBrands: string[];
  isActive: boolean;
  userCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Prisma error with code
export interface PrismaError extends Error {
  code: string;
  meta?: Record<string, unknown>;
}
