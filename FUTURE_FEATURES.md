# Future Features & Deferred Work

This document tracks features and improvements that are intentionally deferred for future releases. These items are marked with `DEFERRED` comments in the codebase.

---

## Notification Analytics & Limits

These features require a `notification_analytics` table to be added to the Prisma schema.

### Analytics Tracking
- **Location:** `apps/notifier/src/services/notification-preferences.service.ts:317`
- **Description:** Track notification delivery metrics (sent, opened, clicked)
- **Requires:** New `NotificationAnalytics` model in Prisma schema

### Daily Email Limit Checking
- **Location:** `apps/notifier/src/services/notification-preferences.service.ts:452`
- **Description:** Enforce per-user daily email limits to prevent spam
- **Requires:** Analytics table to count daily sends per user

### Daily Email Limit Tracking (Processor)
- **Location:** `apps/notifier/src/processors/notification.processor.ts:1146`
- **Description:** Track email sends against daily quota in notification processor
- **Requires:** Analytics infrastructure

### Record Email Send for Analytics
- **Location:** `apps/notifier/src/processors/notification.processor.ts:1196`
- **Description:** Log each email send for analytics dashboard
- **Requires:** Analytics table and aggregation queries

---

## User Notification Preferences

### Read from User.notificationPreferences
- **Location:** `apps/notifier/src/websocket/notification.gateway.ts:825`
- **Description:** Read user's notification channel preferences from database
- **Requires:** `notificationPreferences` JSON field on User model

---

## Health Monitoring Enhancements

### Email Service Health Status
- **Location:** `apps/notifier/src/services/channel-health.service.ts:170`
- **Description:** Verify SMTP connection health via `EmailService.getHealthStatus()`
- **Requires:** SMTP health check implementation in EmailService

### WebSocket Connection Count
- **Location:** `apps/notifier/src/services/channel-health.service.ts:223`
- **Description:** Track active WebSocket connections via `NotificationGateway.getConnectedUserCount()`
- **Requires:** Connection tracking in NotificationGateway

---

## Implementation Priority

### High Priority (User-Facing)
1. User notification preferences
2. Daily email limits

### Medium Priority (Operations)
3. Analytics tracking
4. Email service health check
5. WebSocket connection monitoring

### Low Priority (Technical Debt)
6. (No items currently)

---

## Schema Changes Required

```prisma
// Add to packages/database/prisma/schema.prisma

model NotificationAnalytics {
  id             String   @id @default(uuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  channel        String   // 'email' | 'websocket' | 'push'
  eventType      String   // 'sent' | 'delivered' | 'opened' | 'clicked'
  notificationId String?
  createdAt      DateTime @default(now())

  @@index([userId, createdAt])
  @@index([channel, createdAt])
}

// Add to User model
model User {
  // ... existing fields
  notificationPreferences Json? // { email: true, websocket: true, dailyLimit: 50 }
  notificationAnalytics   NotificationAnalytics[]
}
```

---

*Last updated: 2026-04*
