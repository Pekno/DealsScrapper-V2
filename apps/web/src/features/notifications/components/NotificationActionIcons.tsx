/**
 * NotificationActionIcons - Compact action buttons for notifications
 * Provides mark as read and navigate to filter actions in a space-efficient layout
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as styles from './NotificationActionIcons.css';

export interface NotificationActionIconsProps {
  /** Notification ID for mark as read action */
  notificationId: string;
  /** Filter ID for navigation (if available) */
  filterId?: string;
  /** Article URL to open in new tab (if available) */
  articleUrl?: string;
  /** Whether the notification is already read */
  isRead: boolean;
  /** Callback to mark notification as read */
  onMarkAsRead: (id: string) => void;
  /** Optional callback when filter navigation is triggered */
  onNavigateToFilter?: (filterId: string) => void;
}

// Mark as read icon (checkmark)
const ReadIcon: React.FC = () => (
  <svg
    className={styles.iconSvg}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

// Open article in new tab icon (external link)
const ExternalLinkIcon: React.FC = () => (
  <svg
    className={styles.iconSvg}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

export const NotificationActionIcons: React.FC<
  NotificationActionIconsProps
> = ({
  notificationId,
  filterId,
  articleUrl,
  isRead,
  onMarkAsRead,
  onNavigateToFilter,
}) => {
  const navigate = useNavigate();

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onMarkAsRead(notificationId);
  };

  const handleOpenArticle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!articleUrl) return;

    // Mark notification as read when opening article
    if (!isRead) {
      onMarkAsRead(notificationId);
    }

    // Open article in new tab
    window.open(articleUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={styles.actionContainer}>
      {/* Mark as read button - only show for unread notifications */}
      {!isRead && (
        <button
          type="button"
          className={styles.actionButton}
          onClick={handleMarkAsRead}
          aria-label="Mark notification as read"
          title="Mark as read"
        >
          <ReadIcon />
        </button>
      )}

      {/* Open article button - only show when articleUrl is available */}
      {articleUrl && (
        <button
          type="button"
          className={`${styles.actionButton} ${styles.filterButton}`}
          onClick={handleOpenArticle}
          aria-label="Open article in new tab"
          title="Open article in new tab"
        >
          <ExternalLinkIcon />
        </button>
      )}
    </div>
  );
};

export default NotificationActionIcons;
