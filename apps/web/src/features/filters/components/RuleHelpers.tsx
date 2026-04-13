/**
 * RuleHelpers Component
 * Small utility components for the rule builder (loading spinner, error display)
 */
import React from 'react';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import * as styles from './RuleBuilder.css';

/**
 * Loading spinner for rule operations
 */
export const RuleLoadingSpinner: React.FC = () => (
  <LoadingSpinner size="small" variant="primary" />
);

/**
 * Error display component
 */
export interface ErrorDisplayProps {
  message: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message }) => (
  <div className={styles.errorText}>{message}</div>
);
