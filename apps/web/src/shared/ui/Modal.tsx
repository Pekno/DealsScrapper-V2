/**
 * Modal - Reusable modal dialog component
 *
 * This component provides a modal overlay with proper focus management,
 * keyboard navigation, and accessibility features.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as styles from './Modal.css';

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to call when modal should be closed */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether to show the close button */
  showCloseButton?: boolean;
  /** Whether clicking the overlay closes the modal */
  closeOnOverlayClick?: boolean;
  /** Whether pressing escape closes the modal */
  closeOnEscapeKey?: boolean;
  /** Modal content */
  children: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** Custom header content (replaces title and close button) */
  customHeader?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscapeKey = true,
  children,
  footer,
  customHeader,
  className = '',
  ...rest
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscapeKey) {
        onClose();
      }
    },
    [onClose, closeOnEscapeKey]
  );

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (closeOnOverlayClick && event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose, closeOnOverlayClick]
  );

  // Handle focus trap
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }
  }, []);

  // Manage body scroll and focus
  useEffect(() => {
    if (isOpen) {
      // Store current active element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Prevent body scroll
      document.body.classList.add('modal-open');

      // Add escape key listener
      document.addEventListener('keydown', handleEscapeKey);

      // Focus modal after a brief delay to allow for animation
      const timer = setTimeout(() => {
        const modal = modalRef.current;
        if (modal) {
          const firstFocusable = modal.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement;
          if (firstFocusable) {
            firstFocusable.focus();
          } else {
            modal.focus();
          }
        }
      }, 100);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleEscapeKey);
        document.body.classList.remove('modal-open');

        // Restore focus to previous element
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, handleEscapeKey]);

  // Don't render if not open
  if (!isOpen) return null;

  // Ensure we have a DOM element to portal into
  if (typeof document === 'undefined') return null;

  const modalClassName =
    `${styles.modal} ${styles.modalVariants[size]} ${className}`.trim();

  const modalContent = (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        className={modalClassName}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
        {...rest}
      >
        {/* Header */}
        {customHeader || title || showCloseButton ? (
          <div className={styles.header}>
            {customHeader || (
              <>
                {title && (
                  <h2 id="modal-title" className={styles.title}>
                    {title}
                  </h2>
                )}
                {showCloseButton && (
                  <button
                    className={styles.closeButton}
                    onClick={onClose}
                    aria-label="Close modal"
                  >
                    <svg
                      className={styles.closeIcon}
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
                )}
              </>
            )}
          </div>
        ) : null}

        {/* Body */}
        <div className={styles.body}>{children}</div>

        {/* Footer */}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );

  // Portal the modal to document.body
  return createPortal(modalContent, document.body);
};

export default Modal;
