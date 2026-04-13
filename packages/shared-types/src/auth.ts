/**
 * @fileoverview Shared authentication types used across all services
 * Provides consistent authentication interfaces for all services
 */

import { Request } from 'express';
import type { StandardApiResponse } from './responses.js';
import type { UserRole } from './enums.js';

/**
 * JWT payload structure used for token generation and validation
 * Contains essential user information for authentication
 */
export interface JwtPayload {
  sub: string; // user ID
  email: string;
  emailVerified: boolean;
  role?: UserRole; // Optional for backward compat with in-flight tokens
  iat?: number;
  exp?: number;
}

/**
 * Authenticated user interface used across all services
 * Represents a user that has been validated and attached to requests
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  role: UserRole;
}

/**
 * Extended request interface with authenticated user
 * Used by middleware to attach user information to requests
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Authentication tokens structure
 * Standard response for successful authentication
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * Login response data structure
 * Internal data structure for login operations
 */
export interface LoginData {
  access_token: string;
  refresh_token: string;
  expires_in: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified: boolean;
    role: string;
    createdAt: Date;
  };
}

/**
 * Registration response data structure
 * Internal data structure for registration operations
 */
export interface RegistrationData {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified: boolean;
    role: string;
    createdAt: Date;
  };
  nextStep: 'verify-email';
}

/**
 * Login response structure
 * Clean response for successful login using StandardApiResponse
 */
export interface LoginResponse extends StandardApiResponse<LoginData> {}

/**
 * Registration response structure
 * Clean response for successful user registration using StandardApiResponse
 * Message and data are required for registration responses
 */
export interface RegistrationResponse
  extends StandardApiResponse<RegistrationData> {
  message: string; // Override to make message required for registration
  data: RegistrationData; // Override to make data required for registration
}

/**
 * User update data for security tracking
 * Used for login attempt tracking and security measures
 */
export interface UserUpdateData {
  loginAttempts: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date;
}
