# Web Frontend - DealScrapper

Modern, responsive web application for DealScrapper built with Next.js 15 and React 19.

## Overview

The Web Frontend service provides a comprehensive user interface for DealScrapper, enabling users to create custom deal filters, receive real-time notifications, and browse matched deals. Built with Next.js 15's App Router and React 19, it leverages server components for optimal performance and real-time WebSocket integration for instant updates.

### Key Features

- **Advanced Filter Builder**: Visual, rule-based filter creation with logical operators (AND/OR)
- **Real-Time Notifications**: WebSocket-powered instant deal alerts
- **Authentication System**: JWT-based secure login with email verification
- **Deal Browsing**: Interactive table with sorting, pagination, and search
- **User Profile Management**: Settings, preferences, and notification controls
- **Responsive Design**: Mobile-first, works seamlessly across all devices
- **Type-Safe API Integration**: Full TypeScript support with TanStack Query

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 15.1.8 | App Router, SSR, RSC |
| **React** | 19.0.0 | UI components, hooks |
| **TypeScript** | 5.8.3 | Type safety |
| **TanStack Query** | 5.61.6 | Data fetching, caching |
| **Socket.IO Client** | 4.8.1 | WebSocket notifications |
| **Vanilla Extract** | 1.16.1 | CSS-in-JS styling |
| **Tailwind CSS** | 3.4.17 | Utility-first CSS |
| **React Hook Form** | 7.62.0 | Form management |
| **Zod** | 3.23.8 | Schema validation |

## Architecture

### Feature-Based Structure

The codebase follows a **feature-based architecture** for maximum modularity and maintainability:

```
apps/web/src/
├── app/                          # Next.js App Router (pages)
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Home page
│   ├── login/                   # Login page
│   ├── register/                # Registration page
│   ├── filters/                 # Filter management pages
│   │   ├── page.tsx            # Filter list
│   │   ├── create/             # Create filter
│   │   └── [id]/               # Filter detail & edit
│   └── verify-email/           # Email verification
│
├── features/                     # Feature modules
│   ├── auth/                    # Authentication
│   │   ├── components/         # Login, logout, profile
│   │   ├── hooks/              # useAuth, useRequireAuth
│   │   ├── api/                # Auth API calls
│   │   └── types/              # Auth TypeScript types
│   │
│   ├── filters/                 # Filter management
│   │   ├── components/         # FilterCard, FilterGrid, RuleBuilder
│   │   ├── hooks/              # useFilterForm, useFilterDetail
│   │   ├── api/                # Filter API calls
│   │   └── types/              # Filter TypeScript types
│   │
│   └── notifications/           # Real-time notifications
│       ├── components/         # NotificationBell, NotificationPanel
│       ├── hooks/              # useNotifications
│       ├── api/                # Notification API calls
│       └── types/              # Notification TypeScript types
│
└── shared/                      # Shared utilities
    ├── ui/                     # Reusable UI components
    │   ├── Button.tsx          # Button component
    │   ├── Input.tsx           # Input component
    │   ├── Modal.tsx           # Modal component
    │   ├── LoadingSpinner.tsx  # Loading states
    │   └── ...                 # Badge, Dropdown, Toast, etc.
    │
    ├── layout/                 # Layout components
    │   ├── AppLayout.tsx       # Main app layout
    │   ├── Header.tsx          # Navigation header
    │   └── Sidebar.tsx         # Sidebar navigation
    │
    ├── lib/                    # Core utilities
    │   ├── api.ts              # API client
    │   ├── websocket.ts        # WebSocket service
    │   ├── query-client.tsx    # TanStack Query setup
    │   ├── toast-context.tsx   # Toast notifications
    │   └── date-utils.ts       # Date formatting
    │
    ├── hooks/                  # Shared hooks
    │   ├── useDebounced.ts     # Debounce hook
    │   └── useDropdown.ts      # Dropdown state
    │
    └── types/                  # Shared TypeScript types
        ├── index.ts            # Core types
        └── article.ts          # Article/Deal types
```

### Server vs Client Components

Following Next.js 15 best practices, components are **server components by default** unless they need:

- **Client-side state** (useState, useReducer)
- **Browser APIs** (window, localStorage)
- **Event handlers** (onClick, onChange)
- **React hooks** (useEffect, useContext)

**Server Components** (default):
```typescript
// app/filters/page.tsx
export default async function FiltersPage() {
  // Direct data fetching on server
  return <FilterGrid />;
}
```

**Client Components** (explicit):
```typescript
'use client'; // Required directive

import { useState } from 'react';

export function FilterCard() {
  const [isOpen, setIsOpen] = useState(false);
  return <div onClick={() => setIsOpen(!isOpen)}>...</div>;
}
```

## Getting Started

### Prerequisites

- **Node.js** >= 20.0.0
- **PNPM** (required, not npm/yarn)
- **Docker** (for backend services)
- Backend services running (API, Notifier)

### Installation

```bash
# From project root
cd dealscrapper-v2

# Install dependencies (uses pnpm workspaces)
pnpm install
```

### Environment Variables

Create `.env.local` in `apps/web/`:

```env
# API Integration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3003

# Optional: Feature Flags
ENABLE_CYPRESS_TAGS=true
```

**Available Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API service endpoint |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3003` | WebSocket endpoint (Notifier) |
| `ENABLE_CYPRESS_TAGS` | `true` (dev) | Enable data-cy attributes for testing |

### Running Development Server

```bash
# From project root
pnpm dev:web

# Or directly from apps/web
cd apps/web
pnpm dev
```

The application will be available at **http://localhost:3000**

### Building for Production

```bash
# Build optimized production bundle
pnpm build

# Start production server
pnpm start
```

### Type Checking

```bash
# Check TypeScript types without building
pnpm type-check
```

### Linting

```bash
# Run ESLint
pnpm lint

# Auto-fix issues
pnpm lint:fix
```

## API Integration

### Using the API Client

The API client (`shared/lib/api.ts`) provides a type-safe interface to backend services:

```typescript
import { apiClient } from '@/shared/lib/api';

// All methods return typed responses
const user = await apiClient.auth.login({
  email: 'user@example.com',
  password: 'password123'
});

const filters = await apiClient.filters.list();
const filter = await apiClient.filters.getById(filterId);
```

**Available API Methods:**

```typescript
// Authentication
apiClient.auth.login(credentials)
apiClient.auth.register(data)
apiClient.auth.logout()
apiClient.auth.refreshToken()
apiClient.auth.verifyEmail(token)

// Filters
apiClient.filters.list()
apiClient.filters.getById(id)
apiClient.filters.create(data)
apiClient.filters.update(id, data)
apiClient.filters.delete(id)

// Matches
apiClient.matches.getByFilterId(filterId)

// User
apiClient.user.getProfile()
apiClient.user.updateProfile(data)
apiClient.user.changePassword(data)
```

### TanStack Query Integration

Use TanStack Query for data fetching with automatic caching, revalidation, and error handling:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api';

// Query (GET)
export function useFilters() {
  return useQuery({
    queryKey: ['filters'],
    queryFn: () => apiClient.filters.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation (POST/PUT/DELETE)
export function useCreateFilter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFilterDto) => apiClient.filters.create(data),
    onSuccess: () => {
      // Invalidate and refetch filters list
      queryClient.invalidateQueries({ queryKey: ['filters'] });
    },
  });
}

// Usage in component
function FilterList() {
  const { data: filters, isLoading, error } = useFilters();
  const createFilter = useCreateFilter();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorState error={error} />;

  return (
    <div>
      {filters.map(filter => <FilterCard key={filter.id} filter={filter} />)}
    </div>
  );
}
```

**Query Key Conventions:**

```typescript
['filters']                    // All filters
['filters', filterId]          // Single filter
['filters', filterId, 'matches'] // Filter matches
['notifications']              // All notifications
['user', 'profile']           // User profile
```

## Styling

### Vanilla Extract CSS-in-JS

Components use **Vanilla Extract** for type-safe, zero-runtime CSS:

```typescript
// Button.css.ts
import { style } from '@vanilla-extract/css';

export const button = style({
  padding: '0.5rem 1rem',
  borderRadius: '0.375rem',
  fontSize: '0.875rem',
  fontWeight: 500,
  transition: 'all 0.2s',

  ':hover': {
    opacity: 0.8,
  },
});

export const primary = style({
  backgroundColor: '#3b82f6',
  color: '#ffffff',
});

// Button.tsx
import * as styles from './Button.css';

export function Button({ variant = 'primary', children }) {
  return (
    <button className={`${styles.button} ${styles[variant]}`}>
      {children}
    </button>
  );
}
```

**Benefits:**
- Type-safe styles (autocomplete, refactoring)
- Zero runtime overhead (compiled to static CSS)
- CSS Modules scoping (no naming conflicts)
- First-class TypeScript support

### Tailwind CSS

Utility classes are available for rapid development:

```typescript
<div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow-md">
  <h2 className="text-xl font-bold text-gray-900">Deal Title</h2>
</div>
```

## Real-Time Features

### WebSocket Integration

The WebSocket service (`shared/lib/websocket.ts`) manages real-time connections:

```typescript
import { websocketService } from '@/shared/lib/websocket';

// Connect to WebSocket
websocketService.connect(accessToken);

// Subscribe to notifications
websocketService.on('notification', (notification) => {
  console.log('New notification:', notification);
});

// Listen to connection events
websocketService.on('connect', () => {
  console.log('WebSocket connected');
});

websocketService.on('disconnect', () => {
  console.log('WebSocket disconnected');
});

// Mark notification as read
websocketService.markAsRead(notificationId);

// Disconnect
websocketService.disconnect();
```

### Notification Hook

Use the `useNotifications` hook for reactive notification handling:

```typescript
import { useNotifications } from '@/features/notifications/hooks/useNotifications';

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  return (
    <div>
      <Badge count={unreadCount} />
      {notifications.map(notif => (
        <NotificationItem
          key={notif.id}
          notification={notif}
          onMarkRead={() => markAsRead(notif.id)}
        />
      ))}
    </div>
  );
}
```

**Event Types:**
- `notification` - New notification received
- `notification:marked_read` - Notification marked as read
- `connect` - WebSocket connected
- `disconnect` - WebSocket disconnected
- `error` - Connection error

## Authentication

### useAuth Hook

The `useAuth` hook provides authentication state and methods:

```typescript
import { useAuth } from '@/features/auth/hooks/useAuth';

export function ProtectedPage() {
  const {
    user,           // Current user or null
    isLoading,      // Loading state
    isAuthenticated, // Boolean auth status
    login,          // Login function
    logout,         // Logout function
    register,       // Register function
  } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <LoginPrompt />;

  return <div>Welcome, {user.email}!</div>;
}
```

### Protected Routes

Create protected pages with `useRequireAuth`:

```typescript
'use client';

import { useRequireAuth } from '@/features/auth/hooks/useAuth';

export default function DashboardPage() {
  // Automatically redirects to /login if not authenticated
  const { user } = useRequireAuth();

  return <div>Dashboard for {user.email}</div>;
}
```

### Token Management

Tokens are automatically managed:

- **Access Token**: Stored in memory, used for API calls
- **Refresh Token**: Stored in httpOnly cookie, auto-refreshed
- **Auto-refresh**: Happens 1 minute before expiration
- **Logout**: Clears all tokens and redirects to login

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode (re-run on changes)
pnpm test:watch

# Coverage report
pnpm test:coverage
```

### Test Coverage Requirements

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Writing Tests

Use React Testing Library for component tests:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await userEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

**Test utilities** are available in `shared/lib/test-utils.ts`:

```typescript
import { renderWithProviders } from '@/shared/lib/test-utils';

// Renders with QueryClient, AuthProvider, etc.
renderWithProviders(<MyComponent />);
```

## Common Tasks

### Adding a New Page

1. **Create page file** in `app/` directory:

```typescript
// app/my-page/page.tsx
export default function MyPage() {
  return (
    <div>
      <h1>My Page</h1>
    </div>
  );
}
```

2. **Add to navigation** in `shared/layout/NavigationMenu.tsx`
3. **Add route protection** if needed with `useRequireAuth`

### Creating a New Feature

1. **Create feature directory**:

```bash
mkdir -p src/features/my-feature/{components,hooks,api,types}
```

2. **Add feature components**:

```typescript
// features/my-feature/components/MyComponent.tsx
'use client';

export function MyComponent() {
  return <div>My Feature</div>;
}
```

3. **Add API methods**:

```typescript
// features/my-feature/api/my-feature.api.ts
import { apiClient } from '@/shared/lib/api';

export async function getMyData() {
  return apiClient.get('/my-endpoint');
}
```

4. **Add hooks**:

```typescript
// features/my-feature/hooks/useMyData.ts
import { useQuery } from '@tanstack/react-query';
import { getMyData } from '../api/my-feature.api';

export function useMyData() {
  return useQuery({
    queryKey: ['myData'],
    queryFn: getMyData,
  });
}
```

5. **Export from index**:

```typescript
// features/my-feature/index.ts
export * from './components/MyComponent';
export * from './hooks/useMyData';
```

### Adding UI Components

1. **Create component files**:

```typescript
// shared/ui/Card.css.ts
import { style } from '@vanilla-extract/css';

export const card = style({
  padding: '1.5rem',
  backgroundColor: 'white',
  borderRadius: '0.5rem',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
});

// shared/ui/Card.tsx
import * as styles from './Card.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`${styles.card} ${className}`}>
      {children}
    </div>
  );
}
```

2. **Export from index**:

```typescript
// shared/ui/index.ts
export * from './Card';
```

3. **Use in components**:

```typescript
import { Card } from '@/shared/ui';

<Card>Content here</Card>
```

### Integrating with New API Endpoint

1. **Add to ApiClient**:

```typescript
// shared/lib/api.ts
class ApiClient {
  // ... existing methods

  public async getDeals(filters?: DealFilters) {
    return this.get<Deal[]>('/deals', filters);
  }
}
```

2. **Create query hook**:

```typescript
// features/deals/hooks/useDeals.ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/lib/api';

export function useDeals(filters?: DealFilters) {
  return useQuery({
    queryKey: ['deals', filters],
    queryFn: () => apiClient.getDeals(filters),
    enabled: !!filters, // Only run if filters provided
  });
}
```

3. **Use in component**:

```typescript
const { data: deals, isLoading } = useDeals({ category: 'electronics' });
```

## Troubleshooting

### Port Already in Use

If port 3000 is already occupied:

```bash
# Find process using port 3000
ss -tlnp | grep :3000

# Kill the process
kill -9 <PID>

# Or use a different port
pnpm dev -- --port 3001
```

### WebSocket Connection Issues

**Problem**: Notifications not working

**Solution**:
1. Check Notifier service is running on port 3003
2. Verify `NEXT_PUBLIC_WS_URL` environment variable
3. Check browser console for connection errors
4. Ensure user is authenticated (token required)

```bash
# Test WebSocket endpoint
curl http://localhost:3003/health
```

### API Connection Errors

**Problem**: API calls failing

**Solution**:
1. Verify API service is running on port 3001
2. Check `NEXT_PUBLIC_API_URL` environment variable
3. Check CORS settings in API service
4. Inspect network tab in browser DevTools

```bash
# Test API endpoint
curl http://localhost:3001/health
```

### Build Errors

**Problem**: TypeScript or build errors

**Solution**:
```bash
# Clean build artifacts
pnpm clean

# Reinstall dependencies
rm -rf node_modules
pnpm install

# Type check
pnpm type-check

# Check for missing dependencies
pnpm install
```

### Styling Not Working

**Problem**: Vanilla Extract styles not applying

**Solution**:
1. Ensure `.css.ts` files are imported correctly
2. Check Vanilla Extract plugin in `next.config.js`
3. Restart dev server after config changes
4. Clear `.next` folder and rebuild

```bash
rm -rf .next
pnpm dev
```

### Authentication Loop

**Problem**: Constant redirects to login

**Solution**:
1. Check token expiration in browser DevTools (Application > Cookies)
2. Verify API `/auth/refresh` endpoint is working
3. Clear cookies and re-login
4. Check `AuthProvider` is wrapping the app

```typescript
// app/layout.tsx should have:
<AuthProvider>
  {children}
</AuthProvider>
```

## Development Tips

### Hot Reload

Next.js 15 supports Fast Refresh - changes appear instantly without full page reload:

- **Component changes**: Instant refresh
- **Style changes**: Instant refresh
- **Route changes**: Requires page navigation
- **Config changes**: Requires server restart

### DevTools

Recommended browser extensions:

- **React DevTools**: Component inspection
- **TanStack Query DevTools**: Built-in, auto-enabled in dev
- **Redux DevTools**: For state inspection

### Debugging

Use the built-in debug panels (dev mode only):

```typescript
// Enable debug mode
localStorage.setItem('debug', 'true');

// View API calls, WebSocket events, auth state
// Access via hamburger menu > Debug
```

### Code Organization Tips

1. **Colocation**: Keep related files together
2. **Feature modules**: Group by feature, not by type
3. **Shared components**: Only truly reusable components
4. **Type exports**: Export types from where they're defined
5. **API layer**: Centralize all API calls in feature/api folders

### Performance Optimization

- Use **React.memo** for expensive components
- Implement **virtualization** for long lists
- Use **server components** for static content
- Enable **incremental static regeneration** (ISR) where appropriate
- Optimize images with **next/image**

```typescript
import Image from 'next/image';

<Image
  src="/deal-image.jpg"
  alt="Deal"
  width={300}
  height={200}
  priority // For above-the-fold images
/>
```

## Additional Resources

- **Next.js Documentation**: https://nextjs.org/docs
- **React 19 Documentation**: https://react.dev
- **TanStack Query**: https://tanstack.com/query/latest
- **Vanilla Extract**: https://vanilla-extract.style
- **Socket.IO Client**: https://socket.io/docs/v4/client-api/

## Scripts Reference

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server (port 3000) |
| `pnpm build` | Build production bundle |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Auto-fix linting issues |
| `pnpm type-check` | Check TypeScript types |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Generate coverage report |
| `pnpm clean` | Remove build artifacts |

## Support

For issues, questions, or contributions:

1. Check existing issues in the repository
2. Review troubleshooting section above
3. Check service health endpoints
4. Review browser console and network logs
5. Verify environment variables are set correctly

---

**Built with Next.js 15, React 19, and TypeScript** | **Part of DealScrapper v2 Microservices Architecture**
