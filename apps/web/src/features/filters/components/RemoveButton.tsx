/**
 * RemoveButton Component
 * Button to remove rules or groups from the rule builder
 */
import React from 'react';
import { TrashIcon } from './RuleIcons';
import * as styles from './RuleBuilder.css';

export interface RemoveButtonProps {
  onRemove: () => void;
  disabled?: boolean;
  label?: string;
}

export const RemoveButton: React.FC<RemoveButtonProps> = ({
  onRemove,
  disabled = false,
  label = 'Remove',
}) => {
  return (
    <button
      type="button"
      className={styles.actionButton.remove}
      onClick={onRemove}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <TrashIcon />
    </button>
  );
};
