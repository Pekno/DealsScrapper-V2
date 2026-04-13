// Database and system error types

// Prisma error interface (moved from scraper/src/types/filter.types.ts)
export interface PrismaError {
  code: string;
  message: string;
  meta?: {
    target?: string[];
    field_name?: string;
    constraint?: string;
    modelName?: string;
  };
  clientVersion: string;
}

// Database operation errors
export interface DatabaseError extends Error {
  code: string;
  operation: string;
  table?: string;
  constraint?: string;
  details?: Record<string, unknown>;
}

// Common error codes
export enum DatabaseErrorCode {
  UNIQUE_CONSTRAINT_VIOLATION = 'P2002',
  FOREIGN_KEY_CONSTRAINT_VIOLATION = 'P2003',
  RECORD_NOT_FOUND = 'P2025',
  CONNECTION_ERROR = 'P1001',
  TIMEOUT_ERROR = 'P1008',
  INVALID_DATA = 'P2006',
}

// Service error types
export interface ServiceError {
  service: string;
  operation: string;
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}

// Validation error types
export interface ValidationError {
  field: string;
  value: unknown;
  message: string;
  constraints: string[];
}
