/**
 * @fileoverview Audit logging service for admin actions
 */

import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '@dealscrapper/shared-logging';
import { apiLogConfig } from '../config/logging.config.js';

/** Sensitive admin actions that must be audit-logged */
export const AuditAction = {
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  USER_DELETED: 'USER_DELETED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_ACCOUNT_LOCKED: 'USER_ACCOUNT_LOCKED',
  USER_ACCOUNT_UNLOCKED: 'USER_ACCOUNT_UNLOCKED',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Provides structured audit log entries for sensitive admin operations.
 * All entries are tagged with [AUDIT] and routed through the existing
 * Winston logging infrastructure — no separate storage required.
 */
@Injectable()
export class AuditLoggerService {
  private readonly logger = createServiceLogger(apiLogConfig);

  /**
   * Emit a structured audit log entry.
   *
   * @param action  - The admin action performed (see AuditAction)
   * @param adminId - ID of the admin who performed the action
   * @param adminEmail - Email of the admin who performed the action
   * @param details - Optional key/value pairs providing additional context
   */
  log(
    action: AuditAction,
    adminId: string,
    adminEmail: string,
    details?: Record<string, unknown>,
  ): void {
    const detailsStr = details ? ' | ' + JSON.stringify(details) : '';
    this.logger.log(
      `[AUDIT] ${action} | admin: ${adminEmail} (${adminId})${detailsStr}`,
      'AuditLoggerService',
    );
  }
}
