/**
 * DebugPanelContainer - Fixed bottom container for debug panels
 * Provides a grid layout for multiple debug panels
 */
import React from 'react';
import * as styles from './DebugPanelContainer.css';

export interface DebugPanelContainerProps {
  /** Debug panels to display */
  children: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
}

/**
 * DebugPanelContainer Component
 *
 * A fixed-position container at the bottom of the screen that holds
 * multiple debug panels in a responsive grid layout.
 * Automatically hidden in production builds.
 *
 * @param children - DebugPanel components
 * @param className - Additional CSS classes
 */
export const DebugPanelContainer: React.FC<DebugPanelContainerProps> = ({
  children,
  className,
}) => {
  // Hide debug container in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className={`${styles.debugPanelContainer} ${className || ''}`}>
      <div className={styles.debugPanelScrollArea}>
        <div className={styles.debugPanelGrid}>{children}</div>
      </div>
    </div>
  );
};

export default DebugPanelContainer;
