/**
 * RuleComponents - Barrel Export File
 * Re-exports all rule-related components for easy importing
 *
 * This file has been refactored from a 752-line monolithic file into separate,
 * focused component files following the Single Responsibility Principle.
 *
 * Each component is now in its own file (<200 lines):
 * - BasicIcons.tsx: Basic action icons (Plus, Trash, Layers) [55 lines]
 * - FieldTypeIcons.tsx: Field type icon helpers [111 lines]
 * - OperatorIcons.tsx: Operator icon helpers and utilities [98 lines]
 * - RuleIcons.tsx: Barrel export for all icons [19 lines]
 * - FieldSelector.tsx: Field selection component [70 lines]
 * - OperatorSelector.tsx: Operator selection component [113 lines]
 * - ValueInput.tsx: Value input component [190 lines]
 * - ValueInputHelpers.ts: ValueInput helper utilities [29 lines]
 * - LogicalOperatorToggle.tsx: AND/OR toggle component [66 lines]
 * - ActionButtons.tsx: Add Rule/Group buttons [50 lines]
 * - RemoveButton.tsx: Remove button component [34 lines]
 * - RuleHelpers.tsx: Small utility components (loading, error display) [27 lines]
 */
// Export icon components (re-exported from RuleIcons barrel)
export {
  PlusIcon,
  TrashIcon,
  LayersIcon,
  getFieldIcon,
  getOperatorIcon,
  getOperatorDataCyKey,
} from './RuleIcons';

// Export main components
export { FieldSelector } from './FieldSelector';
export type { FieldSelectorProps } from './FieldSelector';

export { OperatorSelector } from './OperatorSelector';
export type { OperatorSelectorProps } from './OperatorSelector';

export { ValueInput } from './ValueInput';
export type { ValueInputProps } from './ValueInput';

export { LogicalOperatorToggle } from './LogicalOperatorToggle';
export type { LogicalOperatorToggleProps } from './LogicalOperatorToggle';

export { ActionButtons } from './ActionButtons';
export type { ActionButtonsProps } from './ActionButtons';

export { RemoveButton } from './RemoveButton';
export type { RemoveButtonProps } from './RemoveButton';

export { RuleLoadingSpinner, ErrorDisplay } from './RuleHelpers';
export type { ErrorDisplayProps } from './RuleHelpers';
