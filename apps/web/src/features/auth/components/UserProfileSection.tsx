/**
 * UserProfileSection - User profile button with dropdown menu
 */
import React, { useRef, useEffect } from 'react';
import { UserProfile } from '@/shared/layout/NavigationTypes';
import * as styles from '@/shared/layout/NavigationMenu.css';

export interface UserProfileSectionProps {
  /** User profile information */
  userProfile: UserProfile;
  /** Whether the dropdown is visible */
  showDropdown: boolean;
  /** Callback when profile button is clicked */
  onToggle: () => void;
  /** Callback when logout is triggered */
  onLogout: () => void;
  /** Optional callback for profile view */
  onProfileView?: () => void;
  /** Optional callback for settings */
  onSettings?: () => void;
  /** Callback for keyboard navigation */
  onKeyDown: (event: React.KeyboardEvent, action: () => void) => void;
}

/**
 * UserProfileSection Component
 *
 * Displays user profile button and dropdown menu with:
 * - User avatar/initials
 * - Profile information
 * - Quick actions (View Profile, Settings)
 * - Sign Out action
 */
export default function UserProfileSection({
  userProfile,
  showDropdown,
  onToggle,
  onLogout,
  onProfileView,
  onSettings,
  onKeyDown,
}: UserProfileSectionProps): React.ReactElement {
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        onToggle();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown, onToggle]);

  const handleDropdownAction = (action?: () => void) => {
    if (action) {
      action();
    }
    onToggle();
  };

  return (
    <div className={styles.userProfileSection} ref={profileDropdownRef}>
      <button
        className={styles.userProfileButton}
        onClick={onToggle}
        onKeyDown={(e) => onKeyDown(e, onToggle)}
        aria-expanded={showDropdown}
        aria-haspopup="menu"
        aria-label={`User profile menu for ${userProfile.name}`}
        type="button"
      >
        <div className={styles.userAvatar} aria-hidden="true">
          {userProfile.avatar ? (
            <img
              src={userProfile.avatar}
              alt={`${userProfile.name}'s avatar`}
              className={styles.userAvatarImage}
              width={40}
              height={40}
            />
          ) : (
            <span className={styles.userAvatarText}>
              {userProfile.initials ||
                userProfile.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{userProfile.name}</div>
          {userProfile.email && (
            <div className={styles.userEmail}>{userProfile.email}</div>
          )}
          {userProfile.role && (
            <div className={styles.userRole}>{userProfile.role}</div>
          )}
        </div>
        <svg
          className={styles.chevronIcon}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 15l7-7 7 7"
          />
        </svg>
      </button>

      {/* Profile Dropdown Menu */}
      {showDropdown && (
        <div
          className={styles.profileDropdown}
          role="menu"
          aria-labelledby="user-profile-button"
        >
          <div className={styles.profileDropdownHeader}>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>{userProfile.name}</div>
              {userProfile.email && (
                <div className={styles.profileEmail}>{userProfile.email}</div>
              )}
            </div>
          </div>

          <div className={styles.profileDropdownDivider} />

          <div className={styles.profileDropdownActions}>
            {onProfileView && (
              <button
                className={styles.profileDropdownAction}
                onClick={() => handleDropdownAction(onProfileView)}
                role="menuitem"
                type="button"
              >
                <svg
                  className={styles.actionIcon}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                View Profile
              </button>
            )}

            {onSettings && (
              <button
                className={styles.profileDropdownAction}
                onClick={() => handleDropdownAction(onSettings)}
                role="menuitem"
                type="button"
              >
                <svg
                  className={styles.actionIcon}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </button>
            )}

            <div className={styles.profileDropdownDivider} />

            <button
              className={styles.profileDropdownActionDanger}
              onClick={onLogout}
              role="menuitem"
              type="button"
            >
              <svg
                className={styles.actionIcon}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
