// Export Prisma client and essential namespace types for queries
export { PrismaClient, Prisma, Role } from '@prisma/client';

// Export Prisma entity types for cleaner imports
export type {
  User,
  UserSession,
  Filter,
  Article,
  Match,
  Notification,
  ScheduledJob,
  ScrapingJob,
  Category,
  FilterCategory,
  Site,
} from '@prisma/client';

// Note: The Prisma namespace types are available via the generated types above

// Export database service and module
export { PrismaService } from './prisma.service.js';
export { PrismaModule } from './prisma.module.js';

// Export all custom types
export * from './types/index.js';
