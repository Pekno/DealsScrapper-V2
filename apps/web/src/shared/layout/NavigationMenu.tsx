/**
 * NavigationMenu - Comprehensive navigation component for DealsScrapper
 *
 * This component provides a feature-rich navigation experience with:
 * - Navigation items with icons, labels, and badges
 * - User profile dropdown with actions
 * - Responsive design and accessibility
 * - Active state highlighting and hover effects
 * - Nested menu support and logout functionality
 *
 * Can be used standalone or integrated within layouts.
 */
import React from 'react';
import {
  NavigationMenuProps,
  DEFAULT_NAVIGATION_ITEMS,
  DEFAULT_USER_PROFILE,
} from './NavigationTypes';
import NavigationMenuItem from './NavigationMenuItem';
import UserProfileSection from '@/features/auth/components/UserProfileSection';
import LogoutConfirmModal from '@/features/auth/components/LogoutConfirmModal';
import { useNavigationState } from '@/shared/hooks/useNavigationState';
import * as styles from './NavigationMenu.css';

// Re-export types and defaults for convenience
export type { NavigationItem, UserProfile, NavigationMenuProps } from './NavigationTypes';
export { DEFAULT_NAVIGATION_ITEMS, DEFAULT_USER_PROFILE };

/**
 * NavigationMenu Component
 *
 * Main navigation menu container that orchestrates:
 * - Navigation item rendering
 * - User profile section
 * - Logout confirmation
 * - State management via useNavigationState hook
 */
export default function NavigationMenu({
  items,
  currentPath,
  userProfile,
  onNavigate,
  onLogout,
  onProfileView,
  onSettings,
  className,
  showBadges = true,
  collapseByDefault = false,
}: NavigationMenuProps): React.ReactElement {
  // Use custom hook for state management
  const {
    collapsedItems,
    handleGroupToggle,
    handleNavigationClick,
    handleKeyDown,
    showProfileDropdown,
    handleProfileToggle,
    showLogoutConfirm,
    handleLogoutClick,
    handleLogoutConfirm,
    handleLogoutCancel,
  } = useNavigationState({
    items,
    collapseByDefault,
    onNavigate,
    onLogout,
  });

  return (
    <nav
      className={
        className
          ? `${styles.navigationMenu} ${className}`
          : styles.navigationMenu
      }
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Navigation Items */}
      <ul className={styles.navList} role="menubar">
        {items.map((item) => (
          <NavigationMenuItem
            key={item.id}
            item={item}
            currentPath={currentPath}
            showBadges={showBadges}
            isCollapsed={collapsedItems.has(item.id)}
            onNavigate={handleNavigationClick}
            onToggle={handleGroupToggle}
            onKeyDown={handleKeyDown}
          />
        ))}
      </ul>

      {/* User Profile Section */}
      <UserProfileSection
        userProfile={userProfile}
        showDropdown={showProfileDropdown}
        onToggle={handleProfileToggle}
        onLogout={handleLogoutClick}
        onProfileView={onProfileView}
        onSettings={onSettings}
        onKeyDown={handleKeyDown}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isVisible={showLogoutConfirm}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />
    </nav>
  );
}
