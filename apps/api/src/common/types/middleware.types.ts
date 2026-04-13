import { Request } from 'express';

export interface ExtendedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    emailVerified: boolean;
  };
  requestId?: string;
  startTime?: number;
}

export interface SanitizationResult {
  [key: string]: unknown;
}
