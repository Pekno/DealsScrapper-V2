---
name: react-standards
description: >
  Load this skill when working on the web frontend (apps/web/). Contains React + TypeScript
  standards for DealsScrapper: feature-based architecture, component patterns, Vanilla Extract
  styling, TanStack Query, Next.js 15 App Router conventions, and the component/hook checklists.
  Invoke for any task involving React components, custom hooks, styling, or frontend architecture.
---

# DealsScrapper — React + TypeScript Standards (apps/web)

## Architecture: Feature-Based Structure

```
apps/web/src/
├── app/                    # Next.js 15 App Router pages
│   ├── (auth)/             # Login, register, verify-email
│   ├── (dashboard)/        # Protected pages
│   └── layout.tsx          # Root layout
├── components/
│   ├── display/            # Read-only display: FilterCard, MetricsBadge, EmptyState
│   ├── form/               # Form inputs: RuleBuilder, CategorySelector, SearchInput
│   ├── interactive/        # User interaction: FilterGrid, ProductsTable, NavigationMenu
│   ├── layout/             # Layout: AppLayout, Header, Sidebar
│   ├── specialized/        # Domain: NotificationBell, RuleOperatorSelector
│   └── ui/                 # Primitives: Button, Input, Modal, Badge
├── hooks/                  # Custom hooks (useNotifications, useFilterStats, useDebounced)
├── lib/                    # Utilities, services, auth-context
└── types/                  # TypeScript type definitions
```

## Component Principles

- **Single Responsibility**: If a component exceeds ~150-200 lines, split it
- **Functional components only** — no class components
- **Container/Presentational pattern**: Containers handle state/data; presentational components only render
- **No deep prop drilling** (>3 levels) — use Context or restructure
- **No inline business logic** in JSX — extract to custom hooks

## TypeScript

- **Strict mode** — `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`
- **Define prop interfaces** explicitly:
  ```typescript
  interface LoginFormProps {
    onSubmit: (data: LoginData) => void;
  }
  const LoginForm: React.FC<LoginFormProps> = ({ onSubmit }) => { ... }
  ```
- **Avoid `any`** — never without justification
- **Avoid `as unknown as SomeType`** casts — define types properly
- Use `Partial`, `Pick`, `Omit` to compose types

## Styling: Vanilla Extract

All styles live in co-located `.css.ts` files:
```typescript
// MyComponent.css.ts
import { style } from '@vanilla-extract/css';
export const container = style({ display: 'flex', padding: '16px' });

// MyComponent.tsx
import * as styles from './MyComponent.css.ts';
<div className={styles.container}>...</div>
```

**No inline style objects in components** — always extract to `.css.ts`.  
Tailwind CSS utilities can supplement for one-off spacing/layout.

## State Management

- **Local state**: `useState`, `useReducer`
- **Global shared state**: React Context (`AuthContext`, `ToastContext`)
- **Server state**: TanStack Query (React Query v5) — never raw fetch in components
- **Memoization** (`React.memo`, `useCallback`, `useMemo`): only when measured, not preemptively

## Custom Hook Pattern

```typescript
interface UseFeatureReturn {
  data: DataType;
  isLoading: boolean;
  error: Error | null;
  actions: {
    doSomething: () => void;
  };
}

export function useFeature(): UseFeatureReturn {
  // Data fetching via TanStack Query
  // Return typed object, not array tuple (for non-simple hooks)
}
```

- Name starts with `use`
- Explicit return type
- Error handling included
- Cleanup in `useEffect` returns

## Next.js 15 App Router

- **Server components by default** — only add `'use client'` when needed (event handlers, hooks, browser APIs)
- **Route-based code splitting** automatic
- **Protected routes**: redirect unauthenticated users via middleware or layout
- **API base URL**: `NEXT_PUBLIC_API_URL` env var → `http://localhost:3001` in dev

## Naming Conventions

| Item | Convention |
|---|---|
| Components | PascalCase (`UserProfile.tsx`) |
| Hooks | `use` prefix (`useFilterStats.ts`) |
| Style files | Co-located (`Component.css.ts`) |
| Pages | App Router directories (`app/dashboard/page.tsx`) |

## ⚠️ Critical Frontend Gotchas

- **Use `currentPrice`** for price columns/data — NOT `price`
- **Do NOT send `enabledSites`** in filter create/update requests — the backend derives this from categories
- **Dynamic table columns**: must adapt based on selected sites (e.g., `temperature` only shown for Dealabs)
- **WebSocket URL**: `ws://localhost:3003/notifications` (Notifier service, not API)
- **JWT auth**: tokens in httpOnly cookies (handled by API service)

## Checklist for New Components

- [ ] Single responsibility, <200 lines
- [ ] Props interface defined and exported
- [ ] No `any` types
- [ ] Styles in `.css.ts` file
- [ ] Custom hooks for data/logic
- [ ] Error handling
- [ ] Accessibility attributes (ARIA)
- [ ] No `console.log` in production code
