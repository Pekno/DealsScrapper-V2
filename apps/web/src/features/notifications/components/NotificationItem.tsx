/**
 * NotificationItem - Enhanced notification display component
 * Shows actual filter names and item names instead of generic messaging
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EnhancedWebSocketNotification } from '@/shared/lib/websocket';
import { formatRelativeTime } from '@/shared/lib/date-utils';
import { apiClient } from '@/shared/lib/api';
import NotificationActionIcons from './NotificationActionIcons';
import * as styles from './NotificationItem.css';

export interface NotificationItemProps {
  /** The notification data to display */
  notification: EnhancedWebSocketNotification;
  /** Callback when notification is clicked */
  onNotificationClick?: (notification: EnhancedWebSocketNotification) => void;
  /** Callback to mark notification as read */
  onMarkAsRead: (id: string) => void;
  /** Optional callback when navigating to filter */
  onNavigateToFilter?: (filterId: string) => void;
}

const getNotificationIcon = (type: EnhancedWebSocketNotification['type']): React.ReactNode => {
  switch (type) {
    case 'DEAL_MATCH':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case 'SYSTEM':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    case 'ALERT':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
  }
};

const getNotificationColor = (type: EnhancedWebSocketNotification['type']) => {
  switch (type) {
    case 'DEAL_MATCH':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'SYSTEM':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'ALERT':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onNotificationClick,
  onMarkAsRead,
  onNavigateToFilter,
}) => {
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();

  const handleClick = async () => {
    // Extract filterId from notification data or URL structure
    const contentData = notification.content;

    // Try to get article title (user-friendly) instead of article ID
    const articleTitle =
      contentData?.title || notification.title || notification.itemName;

    // Fallback to article ID from URL if no title is available
    let articleSearchTerm: string | undefined;
    if (articleTitle) {
      articleSearchTerm = articleTitle;
    } else if (contentData?.url && typeof contentData.url === 'string') {
      // URL format: https://www.dealabs.com/bons-plans/[...]/[articleId]
      const urlParts = contentData.url.split('/');
      articleSearchTerm = urlParts[urlParts.length - 1];
    }

    // Get filterId from notification data
    let filterId = notification.filterId;

    // FALLBACK: If no filterId, try to find it by searching user's filters
    // This handles old notifications that don't have filterId stored
    if (!filterId && articleSearchTerm) {
      try {
        const result = await apiClient.getFilters({
          search: articleSearchTerm,
        });

        // If we find filters, use the first one as a reasonable guess
        if (
          result.success &&
          result.data?.filters &&
          result.data.filters.length > 0
        ) {
          filterId = result.data.filters[0].id;
        }
      } catch (error) {
        // Silently fail and use generic redirect
        console.warn('Could not find filterId for notification:', error);
      }
    }

    if (filterId) {
      // Navigate to filters page with article filter query parameter using title
      const queryParams = new URLSearchParams();
      if (articleSearchTerm) {
        queryParams.set('article', articleSearchTerm);
      }
      const url = `/filters/${filterId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      navigate(url);
    } else {
      // Fallback: Navigate to filters page with article search
      if (articleSearchTerm) {
        const url = `/filters?search=${encodeURIComponent(articleSearchTerm)}`;
        navigate(url);
      } else {
        // Final fallback: Navigate to filters page
        navigate('/filters');
      }
    }

    // Call original handler if provided
    onNotificationClick?.(notification);

    // Mark as read using the passed-in callback
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
  };

  // Determine display title and message based on available data
  const getDisplayContent = () => {
    // The notification structure has content directly on the notification object
    const contentData = notification.content;

    // Try to get filter name and article title from the actual data structure
    const filterName = notification.filterName;
    const articleTitle =
      contentData?.title || notification.title || notification.itemName;

    // If we have enhanced data from the backend response, use filter name as title and item name in description
    if (filterName && articleTitle) {
      return {
        title: filterName,
        message: `found a match: ${articleTitle}`,
      };
    }

    // If we only have filter name, use it as title
    if (filterName) {
      return {
        title: filterName,
        message: notification.message || 'New match found',
      };
    }

    // If we only have article title, show generic filter with article name
    if (articleTitle) {
      return {
        title: 'Deal Alert',
        message: `found a match: ${articleTitle}`,
      };
    }

    // Fallback to original notification data
    return {
      title: notification.title || 'Deal Match Found',
      message:
        notification.message ||
        'A new deal matching your filters has been found',
    };
  };

  const { title, message } = getDisplayContent();
  const isDealMatch = notification.type === 'DEAL_MATCH';

  // Extract deal data from notification.content structure
  const contentData = notification.content;
  const dealData = notification.data?.dealData || {
    title: typeof contentData?.title === 'string' ? contentData.title : '',
    url: typeof contentData?.url === 'string' ? contentData.url : undefined,
    imageUrl: typeof contentData?.imageUrl === 'string' ? contentData.imageUrl : undefined,
    price: typeof contentData?.price === 'number' ? contentData.price : undefined,
    originalPrice: undefined, // Not available in this structure
    temperature: typeof contentData?.temperature === 'number' ? contentData.temperature : undefined,
    merchant: typeof contentData?.merchant === 'string' ? contentData.merchant : undefined,
    category: undefined, // Not available in this structure
    discountPercentage: typeof contentData?.discountPercentage === 'number' ? contentData.discountPercentage : undefined,
    score: typeof contentData?.score === 'number' ? contentData.score : undefined,
  };

  return (
    <li
      className={styles.notificationItem}
      role="button"
      tabIndex={0}
      aria-label={`Notification: ${title} - ${message}`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className={styles.contentContainer}>
        {isDealMatch && dealData ? (
          // Enhanced deal match notification with rich data
          <div className={styles.dealContainer}>
            {/* Deal Image */}
            <div className={styles.imageContainer}>
              {dealData.imageUrl && !imageError ? (
                <img
                  src={dealData.imageUrl}
                  alt={dealData.title || 'Deal'}
                  className={styles.dealImage}
                  onError={() => setImageError(true)}
                />
              ) : null}
              <div
                className={styles.fallbackIcon}
                style={{
                  display: dealData.imageUrl && !imageError ? 'none' : 'flex',
                }}
              >
                {getNotificationIcon(notification.type)}
              </div>
            </div>

            {/* Deal Content */}
            <div className={styles.dealContent}>
              <div className={styles.dealHeader}>
                <div className={styles.dealTitleContainer}>
                  <h3
                    className={`${styles.dealTitle} ${notification.read ? styles.readTitle : ''}`}
                  >
                    {title}
                  </h3>
                  <p
                    className={`${styles.dealMessage} ${notification.read ? styles.readMessage : ''}`}
                  >
                    {message}
                  </p>
                  <div className={styles.dealMeta}>
                    <span className={styles.merchantBadge}>
                      {dealData.merchant || 'Store'}
                    </span>
                  </div>
                </div>
                {!notification.read && (
                  <div
                    className={styles.unreadDot}
                    aria-label="Unread notification"
                  />
                )}
              </div>

              {/* Price - simplified */}
              {dealData.price !== undefined && (
                <div className={styles.priceContainer}>
                  <span className={styles.price}>
                    {typeof dealData.price === 'number'
                      ? `€${dealData.price.toFixed(2)}`
                      : dealData.price}
                  </span>
                  {dealData.discountPercentage && (
                    <span className={styles.discount}>
                      -{dealData.discountPercentage}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          // Standard notification layout
          <div className={styles.standardContainer}>
            <div className={styles.iconContainer}>
              {getNotificationIcon(notification.type)}
            </div>
            <div className={styles.standardContent}>
              <div className={styles.standardHeader}>
                <p
                  className={`${styles.standardTitle} ${notification.read ? styles.readTitle : ''}`}
                >
                  {title}
                </p>
                {!notification.read && (
                  <div
                    className={styles.unreadDot}
                    aria-label="Unread notification"
                  />
                )}
              </div>
              <p
                className={`${styles.standardMessage} ${notification.read ? styles.readMessage : ''}`}
              >
                {message}
              </p>
            </div>
          </div>
        )}

        {/* Footer with timestamp, badge, and action icons */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <span className={styles.timestamp}>
              {(() => {
                try {
                  const possibleTimestamp =
                    notification.timestamp ||
                    notification.createdAt ||
                    notification.updatedAt ||
                    notification.date;
                  if (!possibleTimestamp) return 'Just now';
                  return formatRelativeTime(possibleTimestamp);
                } catch (error) {
                  return 'Just now';
                }
              })()}
            </span>
            <span
              className={`${styles.typeBadge} ${getNotificationColor(notification.type)}`}
            >
              {notification.type === 'DEAL_MATCH'
                ? 'deal match'
                : notification.type.toLowerCase().replace('_', ' ')}
            </span>
          </div>

          <div className={styles.footerRight}>
            {/* View Deal button removed per user request */}

            {/* Action Icons */}
            <NotificationActionIcons
              notificationId={notification.id}
              filterId={notification.filterId}
              articleUrl={dealData?.url || (typeof contentData?.url === 'string' ? contentData.url : undefined)}
              isRead={!!notification.read}
              onMarkAsRead={onMarkAsRead}
              onNavigateToFilter={onNavigateToFilter}
            />
          </div>
        </div>
      </div>
    </li>
  );
};

export default NotificationItem;
