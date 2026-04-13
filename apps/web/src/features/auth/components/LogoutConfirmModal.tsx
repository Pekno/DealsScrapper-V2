/**
 * LogoutConfirmModal - Confirmation dialog for user logout
 */
import React from 'react';
import * as styles from '@/shared/layout/NavigationMenu.css';

export interface LogoutConfirmModalProps {
  /** Whether the modal is visible */
  isVisible: boolean;
  /** Callback when logout is confirmed */
  onConfirm: () => void;
  /** Callback when logout is cancelled */
  onCancel: () => void;
}

/**
 * LogoutConfirmModal Component
 *
 * Displays a confirmation dialog before logging the user out.
 */
export default function LogoutConfirmModal({
  isVisible,
  onConfirm,
  onCancel,
}: LogoutConfirmModalProps): React.ReactElement | null {
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={styles.logoutModal}
      role="dialog"
      aria-labelledby="logout-title"
    >
      <div className={styles.logoutModalContent}>
        <h3 id="logout-title" className={styles.logoutModalTitle}>
          Confirm Sign Out
        </h3>
        <p className={styles.logoutModalMessage}>
          Are you sure you want to sign out of your DealsScrapper account?
        </p>
        <div className={styles.logoutModalActions}>
          <button
            className={styles.logoutConfirmButton}
            onClick={onConfirm}
            type="button"
          >
            Sign Out
          </button>
          <button
            className={styles.logoutCancelButton}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
