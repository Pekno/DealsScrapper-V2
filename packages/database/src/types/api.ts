// API contract types - request/response interfaces used by external clients

import type { Category, Filter, User, Prisma } from '@prisma/client';

// Note: For simple cases, you can use Prisma types directly
// Only create DTOs when you need to:
// 1. Transform data (computed fields, formatting)
// 2. Hide sensitive fields
// 3. Combine multiple entities
// 4. Add API-specific metadata

// Use Prisma types directly for simple cases
export type CategoryDto = Category;

// Only create custom DTOs when they differ from Prisma types

export interface CategoryListResponse {
  categories: CategoryDto[];
  total: number;
  page?: number;
  limit?: number;
}

// Filter API types
export interface FilterDto {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  filterExpression: Prisma.JsonValue; // JSON filter expression
  immediateNotifications: boolean;
  digestFrequency: string;
  maxNotificationsPerDay: number;
  totalMatches: number;
  matchesLast24h: number;
  lastMatchAt?: Date;
  categories: CategoryDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFilterRequest {
  name: string;
  description?: string;
  active?: boolean;
  categoryIds: string[];
  filterExpression: Prisma.JsonValue; // JSON filter expression
  immediateNotifications?: boolean;
  digestFrequency?: 'hourly' | 'daily' | 'weekly' | 'disabled';
  maxNotificationsPerDay?: number;
}

export interface UpdateFilterRequest {
  name?: string;
  description?: string;
  active?: boolean;
  categoryIds?: string[];
  filterExpression?: Prisma.JsonValue;
  immediateNotifications?: boolean;
  digestFrequency?: 'hourly' | 'daily' | 'weekly' | 'disabled';
  maxNotificationsPerDay?: number;
}

export interface FilterListResponse {
  filters: FilterDto[];
  total: number;
  page: number;
  limit: number;
}

// User API types - exclude sensitive fields like password, loginAttempts, etc.
export type UserProfileDto = Omit<
  User,
  'password' | 'loginAttempts' | 'lockedUntil' | 'lastLoginAt'
>;

// Authentication API types
export interface LoginRequest {
  email: string;
  password: string;
  userAgent?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: string;
  user: UserProfileDto;
}

// Generic API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}
