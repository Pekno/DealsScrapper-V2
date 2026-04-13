---
name: notifier-channels
description: >
  Load this skill when working on notification delivery in DealsScrapper — WebSocket channel,
  email channel, user preferences, delivery tracking, or retry logic. Contains WebSocket gateway
  (Socket.IO namespace /notifications, JWT auth, max 3 connections/user), email service
  (Gmail OAuth2 or MailHog, MJML templates), channel health thresholds, preference structure,
  decision engine, delivery tracking, and retry mechanism. Invoke when implementing or
  debugging notification delivery, preferences, or channel selection logic.
---

# Notifier Channels & Delivery Skill

## 1. WebSocket Channel

**Implementation**: `NotificationGateway`
**Location**: `apps/notifier/src/websocket/notification.gateway.ts`

### Configuration
- Namespace: `/notifications`
- Authentication: JWT token via Socket.IO handshake (query param or headers)
- Max 3 connections per user
- Connection rate limit: 5 attempts per minute per IP
- Heartbeat interval cleans up stale connections

### Key Methods
| Method | Purpose |
|---|---|
| `sendToUser(userId, payload)` | Send notification to a specific user |
| `isUserOnline(userId)` | Check if user has an active connection (Redis) |
| `handleConnection(client)` | Authenticate and register connection |
| `handleDisconnect(client)` | Clean up user status |

### WebSocket Events
- `notification` - Incoming notification delivery
- `activity:update` - User activity tracking
- `preferences:update` - Preference changes
- `mark-read` - Mark notification as read
- `fetch-unread` - Fetch unread notifications

### User Status (Redis)
```typescript
interface UserStatus {
  userId: string;
  isOnline: boolean;
  isActive: boolean;      // Active in last 5 minutes
  lastActivity: Date;
  deviceType: 'web' | 'mobile';
  connectedSockets: number;
}
```
Redis keys:
- `user:status:{userId}` — TTL 5 minutes
- `user:activity:{userId}` — last activity timestamp
- `user:sockets:{userId}` — set of active socket IDs

Status transitions: online on connect, offline when last socket disconnects, stale on heartbeat failure.

Activity events tracked: page views, clicks, scrolls, focus/visibility changes. Used for active vs. idle state and smart delivery timing.

---

## 2. Email Channel

**Implementation**: `EmailService`
**Location**: `apps/notifier/src/channels/email.service.ts`

### Providers
| Environment | Provider | Config |
|---|---|---|
| Production | Gmail OAuth2 | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL` |
| Test | MailHog SMTP | `EMAIL_HOST=mailhog-test`, `EMAIL_PORT=1025` |

### Email Types
- `sendDealMatchEmail()` — Deal match alert
- `sendEmailVerification()` — Email verification
- `sendSystemNotification()` — System-level message
- `sendDigestEmail()` — Daily/weekly digest

### Template Rendering (TemplateService)
**Location**: `apps/notifier/src/templates/template.service.ts`

Templates are built programmatically — no `.mjml` files on disk.

Pipeline:
1. Build MJML template string inline
2. Compile MJML to responsive HTML
3. Register Handlebars helpers
4. Apply `TemplateData` with sanitization
5. Return rendered HTML

```typescript
interface TemplateData {
  user?: { name, email, id };
  deal?: { title, price, merchant, url, score };
  filter?: { name, id };
  system?: { subject, message, priority };
  digest?: { matches, frequency };
  branding?: { appName, logoUrl, primaryColor };
}
```

### Security
- `sanitizeInput()` — strips XSS patterns and template injection
- `sanitizeUrl()` — validates and whitelists URL protocols
- DOMPurify final HTML cleanup

---

## 3. Channel Selection Logic

Implemented in `NotificationProcessor.handleDealMatch()`.

### Priority-Based Selection
1. Check user preferences — which channels are enabled
2. Check user status — is user online (Redis)
3. Check channel health — is channel operational
4. Select optimal channels:
   - **High priority**: try all healthy channels
   - **Normal priority**: primary only (WebSocket if online, Email if offline)
   - **Low priority**: best single channel

### Fallback Strategy
```
Primary Channel Failed
  → Try Secondary Channel
  → Store for Retry
  → Schedule Retry Job (60 min)
```

### Channel Health (ChannelHealthService)
**Location**: `apps/notifier/src/services/channel-health.service.ts`

| Status | Success Rate | Latency |
|---|---|---|
| Healthy | > 90% | < 2s |
| Degraded | 70–90% | < 5s |
| Unhealthy | < 70% | > 5s |

Stored in Redis: `channel:health:{channel}` — TTL 1 hour, rolling window of last 100 attempts.

---

## 4. User Preferences

**Implementation**: `NotificationPreferencesService`
**Location**: `apps/notifier/src/services/notification-preferences.service.ts`

Stored in `User.notificationPreferences` (JSONB field).

### Preference Structure
```typescript
interface NotificationPreferences {
  email: boolean;
  inApp: boolean;
  frequency: DigestFrequency | 'immediate';
  quietHours: QuietHoursConfig;     // { enabled, start: "22:00", end: "08:00", timezone? }
  categories: {
    dealMatch: boolean;
    digest: boolean;
    system: boolean;
    priceAlert: boolean;
    stockAlert: boolean;
  };
  filters: {
    minScore: number;               // 0–100
    maxPerDay: number;              // Default: 50
    preferredMerchants: string[];   // Whitelist (empty = all)
    blockedKeywords: string[];
    priorityOnly: boolean;
  };
  channels: {
    email: { address: string; verified: boolean };
  };
}
```

### Decision Engine: `shouldSendNotification(context)`

Input:
```typescript
interface NotificationContext {
  userId: string;
  notificationType: 'deal-match' | 'system' | 'digest';
  priority: 'high' | 'normal' | 'low';
  score?: number;
  dealData?: { title, price, merchant, category };
  userActivity: { isOnline, isActive, lastActivity, deviceType };
}
```

Output:
```typescript
interface NotificationPermissionResult {
  allowed: boolean;
  reason?: string;            // Why blocked if not allowed
  channels: Array<'websocket' | 'email'>;
  recommendedDelay?: number;  // Seconds
}
```

### Decision Flow
1. Category enabled? — if no, block
2. Quiet hours? — if yes, block (high priority overrides quiet hours)
3. Daily limit exceeded? — if yes, block
4. Score >= minScore? — if no, block
5. Blocked keywords match? — if yes, block
6. Preferred merchants (if set) — must match
7. Select channels based on online status, priority, preferences, health

---

## 5. Delivery Tracking

**Implementation**: `DeliveryTrackingService`
**Location**: `apps/notifier/src/services/delivery-tracking.service.ts`

### Unified Notification Payload
```typescript
interface UnifiedNotificationPayload {
  id: string;                       // "notif_{timestamp}_{random}"
  type: 'DEAL_MATCH' | 'SYSTEM';
  title: string;
  message: string;
  filterId?: string;
  data: { dealData?: {...}; systemType?: string };
  timestamp: string;                // ISO
  read: boolean;
}
```

### Database: Notification Table
```sql
CREATE TABLE "Notification" (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES "User"(id),
  type      TEXT NOT NULL,
  priority  TEXT NOT NULL,
  content   JSONB NOT NULL,         -- UnifiedNotificationPayload
  createdAt TIMESTAMP DEFAULT NOW()
);
```

### Usage Pattern
```typescript
// 1. Create delivery record
const deliveryId = await deliveryTracking.createDelivery({
  userId, type, priority, notificationPayload
});

// 2. Record each channel attempt
await deliveryTracking.recordAttempt(
  deliveryId,
  'email',                          // channel
  'delivered',                      // 'pending' | 'delivered' | 'failed'
  undefined                         // error message if failed
);
```

---

## 6. Retry Mechanism

```typescript
await deliveryTracking.scheduleRetry(deliveryId, 60); // minutes
```

- Max 3 retry attempts
- Exponential backoff: 1 min → 5 min → 60 min
- Re-evaluates user preferences on each retry
- Checks channel health before attempting retry
