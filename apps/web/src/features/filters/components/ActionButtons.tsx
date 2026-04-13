/**
 * ActionButtons Component
 * Provides "Add Rule" and "Add Group" action buttons for the rule builder
 */
import React from 'react';
import { PlusIcon, LayersIcon } from './RuleIcons';
import { dataCy } from '@/shared/lib/test-utils';
import * as styles from './RuleBuilder.css';

export interface ActionButtonsProps {
  onAddRule: () => void;
  onAddGroup: () => void;
  disabled?: boolean;
  level?: number;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  onAddRule,
  onAddGroup,
  disabled = false,
  level = 0,
}) => {
  return (
    <div className={styles.ruleGroupActions}>
      <button
        type="button"
        className={styles.actionButton.add}
        onClick={onAddRule}
        disabled={disabled}
        {...dataCy('add-rule-button')}
      >
        <PlusIcon />
        Add Rule
      </button>
      {level < 2 && ( // Limit nesting to 3 levels
        <button
          type="button"
          className={styles.actionButton.addGroup}
          onClick={onAddGroup}
          disabled={disabled}
        >
          <LayersIcon />
          Add Group
        </button>
      )}
    </div>
  );
};
