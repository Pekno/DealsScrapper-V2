/**
 * Toast - Notification toast component
 *
 * This component provides toast notifications with proper accessibility,
 * animations, auto-dismiss functionality, and multiple variants.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as styles from './Toast.css';
import { dataCy } from '@/shared/lib/test-utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  /** Unique identifier for the toast */
  id: string;
  /** Toast type/variant */
  type: ToastType;
  /** Toast title (optional) */
  title?: string;
  /** Toast message */
  message: string;
  /** Auto-dismiss duration in milliseconds (0 = no auto-dismiss) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss: (id: string) => void;
  /** Position in the stack (used for stacking animation) */
  stackPosition?: number;
}

const ToastIcons = {
  success: (
    <svg
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  ),
  error: (
    <svg
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  ),
  warning: (
    <svg
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  ),
  info: (
    <svg
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onDismiss,
  stackPosition = 0,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const [showProgressBar, setShowProgressBar] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle auto-dismiss
  useEffect(() => {
    if (duration > 0) {
      // Small delay before showing progress bar to avoid flash
      progressTimeoutRef.current = setTimeout(() => {
        setShowProgressBar(true);
      }, 100);

      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, [duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    // Wait for exit animation to complete
    setTimeout(() => {
      onDismiss(id);
    }, 200);
  };

  const handleMouseEnter = () => {
    // Pause auto-dismiss on hover
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
    }
    setShowProgressBar(false);
  };

  const handleMouseLeave = () => {
    // Resume auto-dismiss on mouse leave
    if (duration > 0) {
      setShowProgressBar(true);
      timeoutRef.current = setTimeout(() => {
        handleDismiss();
      }, duration);
    }
  };

  const toastClassName = `${styles.toast} ${styles.toastVariants[type]}`.trim();
  const iconClassName =
    `${styles.toastIcon} ${styles.toastIconVariants[type]}`.trim();
  const progressBarClassName =
    `${styles.toastProgressBar} ${styles.progressBarVariants[type]}`.trim();

  // Calculate transform for stacking effect
  const stackOffset = stackPosition * 8; // 8px offset per toast in stack
  const stackScale = Math.max(0.9, 1 - stackPosition * 0.05); // Scale down slightly

  const transform =
    stackPosition > 0
      ? `translateY(-${stackOffset}px) scale(${stackScale})`
      : 'translateY(0) scale(1)';

  const toastStyle = {
    transform,
    zIndex: 1050 - stackPosition, // Higher positioned toasts have higher z-index
  };

  return (
    <div
      className={toastClassName}
      style={toastStyle}
      data-state={isExiting ? 'exiting' : 'entering'}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...dataCy(`toast-${type}`)}
    >
      <div className={styles.toastContent}>
        <div className={iconClassName}>{ToastIcons[type]}</div>

        <div className={styles.toastText}>
          {title && <div className={styles.toastTitle} {...dataCy('toast-title')}>{title}</div>}
          <div className={styles.toastMessage} {...dataCy('toast-message')}>{message}</div>
        </div>

        <button
          className={styles.toastCloseButton}
          onClick={handleDismiss}
          aria-label={`Dismiss ${type} notification${title ? `: ${title}` : ''}`}
          {...dataCy('toast-close')}
        >
          <svg
            className={styles.toastCloseIcon}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Progress bar for auto-dismiss */}
      {duration > 0 && showProgressBar && (
        <div
          className={progressBarClassName}
          data-animated="true"
          style={
            {
              '--duration': `${duration - 100}ms`,
            } as React.CSSProperties
          }
          aria-hidden="true"
        />
      )}

      {/* Screen reader announcement */}
      <div className={styles.srOnly}>
        {type.charAt(0).toUpperCase() + type.slice(1)} notification
        {title ? `: ${title}.` : '.'} {message}
      </div>
    </div>
  );
};

export const ToastContainer: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.toastContainer} aria-live="polite" {...dataCy('toast-container')}>
      {children}
    </div>,
    document.body
  );
};

export default Toast;
