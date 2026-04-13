/**
 * Auth Feature - Barrel Export
 * Re-exports all auth-related components, hooks, and types
 */

// Components
export { default as UserProfileSection } from './components/UserProfileSection';
export { default as LogoutConfirmModal } from './components/LogoutConfirmModal';

// Hooks
export { useAuth, AuthProvider } from './hooks/useAuth';
