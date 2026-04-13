/**
 * AppLayout - Root layout component with responsive sidebar navigation
 *
 * This component provides the main application layout structure with:
 * - Fixed sidebar navigation on desktop
 * - Overlay sidebar on mobile with backdrop
 * - Responsive main content area
 * - Proper accessibility features
 *
 * Based on the design mockups: create_filter.png and view_filters.png
 */
import React, { useMemo } from 'react';
import * as styles from './AppLayout.css';
import { UserMenu } from '../ui/UserMenu';
import { SettingsModal } from '../ui/SettingsModal';
import NotificationBell from '@/features/notifications/components/NotificationBell';
import NotificationPanel from '@/features/notifications/components/NotificationPanel';
import { DealsRadarLoader } from '../ui/DealsRadarLoader';
import { useAppLayout } from '@/shared/hooks/useAppLayout';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { UnifiedDebugBar } from '../debug';
import { dataCy } from '@/shared/lib/test-utils';

// Navigation item interface
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  tooltip?: string;
}

// User profile interface
export interface UserProfile {
  name: string;
  email: string;
  initials: string;
}

// AppLayout props interface
export interface AppLayoutProps {
  children: React.ReactNode;
  /** Navigation items for the sidebar */
  navigationItems?: NavigationItem[];
  /** User profile information */
  userProfile?: UserProfile;
  /** Current active path for navigation highlighting */
  currentPath?: string;
  /** Custom header content */
  headerContent?: React.ReactNode;
  /** Whether to show the mobile menu button */
  showMobileMenu?: boolean;
  /** Callback when navigation item is clicked */
  onNavigate?: (path: string) => void;
  /** Callback when user profile is clicked */
  onUserProfileClick?: () => void;
  /** Callback when logout is triggered */
  onLogout?: () => void;
}

// Default navigation items matching the mockups (removed Settings - now in user menu)
const DEFAULT_NAVIGATION: NavigationItem[] = [
  {
    id: 'filters',
    label: 'Filters',
    href: '/filters',
    icon: (
      <svg
        className={styles.navIcon}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"
        />
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    href: '/analytics',
    disabled: true,
    tooltip: 'Analytics feature is under construction and not available yet',
    icon: (
      <svg
        className={styles.navIcon}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
];

// Default user profile
const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'John Doe',
  email: 'john.doe@example.com',
  initials: 'JD',
};

/**
 * AppLayout component providing the main application structure
 */
export default function AppLayout({
  children,
  navigationItems = DEFAULT_NAVIGATION,
  userProfile = DEFAULT_USER_PROFILE,
  currentPath = '',
  headerContent,
  showMobileMenu = true,
  onNavigate,
  onUserProfileClick, // eslint-disable-line @typescript-eslint/no-unused-vars
  onLogout,
}: AppLayoutProps): React.ReactElement {
  const { user: authUser } = useAuth();

  // Conditionally include Admin nav item for admin users
  const effectiveNavItems = useMemo(() => {
    const isAdmin = authUser?.role === 'ADMIN';
    if (!isAdmin) return navigationItems;

    // Check if admin item already exists (e.g. passed via props)
    if (navigationItems.some((item) => item.id === 'admin'))
      return navigationItems;

    const adminItem: NavigationItem = {
      id: 'admin',
      label: 'Admin',
      href: '/admin',
      icon: (
        <svg
          className={styles.navIcon}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    };

    return [...navigationItems, adminItem];
  }, [navigationItems, authUser?.role]);

  // Use custom hook for all state and handlers
  const {
    // Mobile menu
    isMobileMenuOpen,
    toggleMobileMenu,
    handleBackdropClick,
    // Settings
    isSettingsModalOpen,
    handleCloseSettings,
    // Notifications panel
    isNotificationPanelOpen,
    handleToggleNotifications,
    handleCloseNotifications,
    handleNotificationClick,
    // Navigation
    isNavigating,
    navigationTarget,
    handleNavigationClick,
    getNavigationTargetName,
    activeNavItems,
    // User menu
    userMenuActions,
    // Notifications (WebSocket)
    notifications,
    isConnected,
    connect,
    markAsRead,
    clearAll,
    unreadCount,
    isLoading,
    hasConnectionIssue,
    refreshNotifications,
    // Auth
    user,
    // Keyboard
    handleKeyDown,
  } = useAppLayout({
    currentPath,
    navigationItems: effectiveNavItems,
    onNavigate,
    onLogout,
  });

  return (
    <div className={styles.layoutContainer} data-layout="app">
      {/* Navigation Loading Overlay */}
      {isNavigating && (
        <div
          className={styles.navigationLoadingOverlay}
          role="dialog"
          aria-labelledby="navigation-loading-title"
          aria-describedby="navigation-loading-description"
        >
          <DealsRadarLoader
            message="Navigating..."
            subtext={`Loading ${getNavigationTargetName(navigationTarget)}...`}
            size="md"
          />
        </div>
      )}

      {/* Mobile backdrop */}
      {isMobileMenuOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={handleBackdropClick}
          onKeyDown={(e) => handleKeyDown(e, handleBackdropClick)}
          role="button"
          tabIndex={0}
          aria-label="Close navigation menu"
        />
      )}

      {/* Global Header */}
      <header className={styles.globalHeader} role="banner">
        {/* Logo */}
        <div className={styles.logoContainer}>
          <div className={styles.logoIcon}>
            <img
              src="/logos/logo-icon.svg"
              alt="DealsScraper Logo"
              className={styles.logoIconInner}
            />
          </div>
          <h1 className={styles.logoText}>DealsScraper</h1>
        </div>

        {/* Header Right Section */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          {showMobileMenu && (
            <button
              className={styles.mobileMenuButton}
              onClick={toggleMobileMenu}
              onKeyDown={(e) => handleKeyDown(e, toggleMobileMenu)}
              aria-label={
                isMobileMenuOpen
                  ? 'Close navigation menu'
                  : 'Open navigation menu'
              }
              aria-expanded={isMobileMenuOpen}
            >
              <svg
                className={styles.navIcon}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          )}

          {/* Custom header content */}
          {headerContent}

          {/* Notifications */}
          {!headerContent && (
            <div className="relative">
              <NotificationBell
                count={unreadCount}
                onClick={handleToggleNotifications}
                size="md"
                variant="ghost"
                animateOnUpdate={true}
                bounceBadgeOnUpdate={true}
                aria-label="Notifications"
                title={
                  isConnected
                    ? `${unreadCount} new notification${unreadCount !== 1 ? 's' : ''}`
                    : 'Notifications (disconnected)'
                }
              />
              <NotificationPanel
                notifications={notifications}
                isOpen={isNotificationPanelOpen}
                onClose={handleCloseNotifications}
                onMarkAsRead={markAsRead}
                onClearAll={clearAll}
                onNotificationClick={handleNotificationClick}
                isConnected={isConnected}
                onConnect={connect}
                unreadCount={unreadCount}
                isLoading={isLoading}
                hasConnectionIssue={hasConnectionIssue}
                onRefresh={refreshNotifications}
              />
            </div>
          )}
        </div>
      </header>

      {/* Content Wrapper */}
      <div className={styles.contentWrapper}>
        {/* Sidebar */}
        <aside
          className={
            isMobileMenuOpen
              ? styles.sidebarVariants.mobileVisible
              : styles.sidebarVariants.mobileHidden
          }
          role="navigation"
          aria-label="Main navigation"
        >
          {/* Navigation */}
          <nav
            className={styles.sidebarNav}
            role="navigation"
            aria-label="Primary navigation"
          >
            <ul className={styles.navList}>
              {activeNavItems.map((item) => (
                <li key={item.id} className={styles.navItem}>
                  {item.disabled || isNavigating ? (
                    <div
                      className={styles.navLinkDisabled}
                      title={
                        item.disabled
                          ? item.tooltip
                          : 'Navigation in progress...'
                      }
                      aria-label={`${item.label} - ${item.disabled ? item.tooltip : 'Navigation in progress'}`}
                      role="menuitem"
                      aria-disabled="true"
                    >
                      {item.icon}
                      {item.label}
                      {isNavigating && navigationTarget === item.href && (
                        <div className={styles.navLoadingIndicator} />
                      )}
                    </div>
                  ) : (
                    <a
                      href={item.href}
                      className={
                        item.active ? styles.navLinkActive : styles.navLink
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigationClick(item);
                      }}
                      onKeyDown={(e) =>
                        handleKeyDown(e, () => handleNavigationClick(item))
                      }
                      role="button"
                      tabIndex={0}
                      aria-current={item.active ? 'page' : undefined}
                    >
                      {item.icon}
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* User Profile with Menu */}
          <div className={styles.sidebarFooter}>
            <UserMenu actions={userMenuActions}>
              <div
                className={styles.userProfile}
                role="button"
                tabIndex={0}
                aria-label={`User profile menu: ${user?.firstName || userProfile.name} ${user?.lastName || ''}`}
              >
                <div className={styles.userAvatar} aria-hidden="true">
                  <span className={styles.userAvatarText}>
                    {user?.firstName && user?.lastName
                      ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`
                      : userProfile.initials}
                  </span>
                </div>
                <div className={styles.userInfo}>
                  <div
                    className={styles.userName}
                    title={
                      user?.firstName && user?.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : userProfile.name
                    }
                  >
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : userProfile.name}
                  </div>
                  <div
                    className={styles.userEmail}
                    {...dataCy('user-email')}
                    title={user?.email || userProfile.email}
                  >
                    {user?.email || userProfile.email}
                  </div>
                </div>
              </div>
            </UserMenu>
          </div>
        </aside>

        {/* Main Content */}
        <main className={styles.mainContent} role="main">
          {/* Content Area */}
          <div className={styles.contentArea}>{children}</div>
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettings}
      />

      {/* Unified Debug Bar - Development only */}
      <UnifiedDebugBar />
    </div>
  );
}

// Types are already exported with interface declarations above
