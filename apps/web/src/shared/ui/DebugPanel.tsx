/**
 * DebugPanel - A reusable collapsible debug panel component
 * Only visible in development environment
 */
import React, { useState } from 'react';
import * as styles from './DebugPanel.css';

export interface DebugPanelProps {
  /** Panel title displayed in header */
  title: string;
  /** Icon/emoji displayed in header */
  icon: string;
  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
  /** Panel content */
  children: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
}

/**
 * DebugPanel Component
 *
 * A collapsible debug panel with header, icon, and content area.
 * Automatically hidden in production builds.
 *
 * @param title - Panel title
 * @param icon - Icon/emoji for the panel
 * @param defaultCollapsed - Initial collapsed state (default: true)
 * @param children - Panel content
 * @param className - Additional CSS classes
 */
export const DebugPanel: React.FC<DebugPanelProps> = ({
  title,
  icon,
  defaultCollapsed = true,
  children,
  className,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Hide debug panels in production
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`${styles.debugPanel} ${className || ''}`}>
      <div className={styles.debugPanelHeader} onClick={toggleCollapse}>
        <span className={styles.debugPanelIcon}>{icon}</span>
        <h3 className={styles.debugPanelTitle}>{title}</h3>
        <span className={styles.debugPanelToggle}>
          {isCollapsed ? '[+]' : '[−]'}
        </span>
      </div>

      <div
        className={`${styles.debugPanelContent} ${
          isCollapsed ? styles.debugPanelCollapsed : styles.debugPanelExpanded
        }`}
      >
        <div className={styles.debugPanelContentInner}>{children}</div>
      </div>
    </div>
  );
};

export default DebugPanel;
