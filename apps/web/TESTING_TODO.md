# Web Frontend Testing TODO

This document outlines the testing requirements for the web frontend application (`apps/web/`).

## Current State

**The web frontend currently has zero test coverage.** No test infrastructure is set up.

## Required Test Infrastructure

### Setup Tasks

1. **Install testing dependencies**
   - `@testing-library/react` - React Testing Library
   - `@testing-library/jest-dom` - Custom matchers for DOM testing
   - `@testing-library/user-event` - User interaction simulation
   - `vitest` - Test runner (or Jest if preferred)
   - `jsdom` - DOM environment for tests
   - `@vitejs/plugin-react` - React support for Vitest (if using Vitest)

2. **Configure test environment**
   - Create `vitest.config.ts` or `jest.config.js`
   - Set up test utilities and mocks
   - Configure path aliases matching `tsconfig.json`

3. **Create test utilities**
   - Mock providers wrapper (QueryClient, Auth context, etc.)
   - API client mocks
   - WebSocket client mocks

## Tests Needed

### Unit Tests

#### Components (`src/shared/ui/`)
- [ ] `Button.tsx` - Rendering, variants, states (loading, disabled)
- [ ] `Input.tsx` - Value handling, validation states
- [ ] `Section.tsx` - Rendering with children
- [ ] `FormField.tsx` - Label, error display
- [ ] `SiteBadge.tsx` - Correct colors per site
- [ ] `DeleteConfirmationModal.tsx` - Open/close, callbacks

#### Feature Components (`src/features/`)

##### Filters
- [ ] `CreateFilterForm.tsx` - Form submission, validation
- [ ] `RuleBuilder.tsx` - Add/remove rules, rule changes
- [ ] `ValueInput.tsx` - Different input types per field
- [ ] `SiteSelector.tsx` - Selection toggle, multi-select
- [ ] `CategorySelector.tsx` - Search, selection
- [ ] `ProductsTable.tsx` - Rendering, sorting, pagination
- [ ] `FilterCard.tsx` - Rendering, actions
- [ ] `SmartScrapingStatus.tsx` - Status display, loading states

##### Auth
- [ ] Login form component
- [ ] Register form component

##### Notifications
- [ ] `NotificationPanel.tsx` - Rendering, mark as read
- [ ] `NotificationItem.tsx` - Different notification types

#### Hooks (`src/features/*/hooks/`, `src/shared/hooks/`)
- [ ] `useFilterForm.ts` - Form state management, validation
- [ ] `useFilterMatches.ts` - Data fetching, caching
- [ ] `useCategorySearch.ts` - Search debouncing
- [ ] `useRealTimeFilterRefresh.ts` - WebSocket integration
- [ ] `useNotifications.ts` - Notification handling
- [ ] `useNotificationsQuery.ts` - Query caching
- [ ] `useAuth.tsx` - Authentication state
- [ ] `useSiteRegistry.ts` - Site data access
- [ ] `useAppLayout.tsx` - Layout state management

#### Utility Functions (`src/shared/lib/`)
- [ ] `api.ts` - API client methods, error handling
- [ ] `date-utils.ts` - Date formatting functions
- [ ] `websocket.ts` - Connection handling (mock Socket.IO)

### Integration Tests

- [ ] Filter creation flow (form fill -> submit -> redirect)
- [ ] Filter edit flow (load data -> edit -> save)
- [ ] Filter deletion flow (confirm modal -> delete)
- [ ] Authentication flow (login -> redirect -> profile access)
- [ ] Notification display flow (WebSocket event -> panel update)

### E2E Tests

Consider using Playwright or Cypress for full E2E tests:
- [ ] Complete filter CRUD workflow
- [ ] User registration and login
- [ ] Real-time notification receipt
- [ ] Article table interaction

## Priority

1. **HIGH** - Hooks and utility functions (most logic, least UI dependencies)
2. **MEDIUM** - Feature components (CreateFilterForm, RuleBuilder, ProductsTable)
3. **LOW** - Simple UI components (Button, Input - rarely change)

## Notes

- Tests should use proper TypeScript types (no `any`)
- Mock API responses should match actual backend DTOs
- WebSocket tests should simulate real event patterns
- Consider snapshot testing for complex UI components

## Related Files

- TypeScript config: `tsconfig.json`
- Existing test utilities: `src/shared/lib/test-utils.ts` (data-cy helpers)
