/**
 * DeleteConfirmationModal - Modal component for delete confirmations
 *
 * Provides a consistent, accessible deletion confirmation dialog
 * that replaces browser confirm() popups with a proper modal interface.
 */
import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { dataCy } from '@/shared/lib/test-utils';

export interface DeleteConfirmationModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to call when modal should be closed */
  onClose: () => void;
  /** Function to call when deletion is confirmed */
  onConfirm: () => Promise<void> | void;
  /** Title of the item being deleted */
  itemName: string;
  /** Type of item being deleted (e.g., "filter", "category") */
  itemType?: string;
  /** Custom warning message */
  warningMessage?: string;
  /** Whether the deletion operation is in progress */
  loading?: boolean;
}

export const DeleteConfirmationModal: React.FC<
  DeleteConfirmationModalProps
> = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = 'item',
  warningMessage,
  loading = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirm();
      // Modal will be closed by parent component after successful deletion
    } catch (error) {
      console.error('Delete operation failed:', error);
      // Keep modal open on error so user can retry
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting && !loading) {
      onClose();
    }
  };

  const isOperationInProgress = isDeleting || loading;

  const defaultWarningMessage = `Are you sure you want to delete "${itemName}"? This action cannot be undone.`;

  const footerActions = (
    <div className="flex gap-3 justify-end">
      <Button
        variant="secondary"
        size="md"
        onClick={handleClose}
        disabled={isOperationInProgress}
        {...dataCy('cancel-delete-button')}
      >
        Cancel
      </Button>
      <Button
        variant="danger"
        size="md"
        onClick={handleConfirm}
        loading={isOperationInProgress}
        disabled={isOperationInProgress}
        icon={
          !isOperationInProgress ? (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          ) : undefined
        }
        {...dataCy('confirm-delete-button')}
      >
        {isOperationInProgress ? 'Deleting...' : `Delete ${itemType}`}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Delete ${itemType}`}
      size="sm"
      footer={footerActions}
      closeOnOverlayClick={!isOperationInProgress}
      closeOnEscapeKey={!isOperationInProgress}
      showCloseButton={!isOperationInProgress}
      {...dataCy('delete-confirmation-modal')}
    >
      <div className="space-y-4">
        {/* Warning Icon */}
        <div className="flex items-center justify-center">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.04c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        </div>

        {/* Warning Message */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Confirm Deletion
          </h3>
          <p
            className="text-sm text-gray-600 leading-relaxed"
            {...dataCy('delete-confirmation-message')}
          >
            {warningMessage || defaultWarningMessage}
          </p>
        </div>

        {/* Additional Warning */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="w-4 h-4 text-red-400 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-2">
              <p className="text-xs font-medium text-red-800">
                This action is permanent and cannot be undone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteConfirmationModal;
