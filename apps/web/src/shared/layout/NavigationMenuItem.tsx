/**
 * NavigationMenuItem - Individual navigation item with support for collapsible groups
 */
import React from 'react';
import { NavigationItem } from './NavigationTypes';
import * as styles from './NavigationMenu.css';

export interface NavigationMenuItemProps {
  /** Navigation item data */
  item: NavigationItem;
  /** Current active path for highlighting */
  currentPath: string;
  /** Whether badges should be shown */
  showBadges: boolean;
  /** Whether this item is collapsed (for collapsible groups) */
  isCollapsed: boolean;
  /** Callback when navigation item is clicked */
  onNavigate: (item: NavigationItem) => void;
  /** Callback when collapsible group is toggled */
  onToggle: (itemId: string) => void;
  /** Callback for keyboard navigation */
  onKeyDown: (event: React.KeyboardEvent, action: () => void) => void;
  /** Nesting level for indentation */
  level?: number;
}

/**
 * NavigationMenuItem Component
 *
 * Renders a single navigation item, which can be:
 * - A simple link
 * - A collapsible group with children
 */
export default function NavigationMenuItem({
  item,
  currentPath,
  showBadges,
  isCollapsed,
  onNavigate,
  onToggle,
  onKeyDown,
  level = 0,
}: NavigationMenuItemProps): React.ReactElement {
  // Check if path is active
  const isItemActive = (navItem: NavigationItem): boolean => {
    return (
      currentPath === navItem.path ||
      (navItem.path !== '/' && currentPath.startsWith(navItem.path))
    );
  };

  // Check if group contains active item
  const isGroupActive = (navItem: NavigationItem): boolean => {
    if (isItemActive(navItem)) return true;
    if (navItem.children) {
      return navItem.children.some((child) => isItemActive(child));
    }
    return false;
  };

  const isActive = isItemActive(item);
  const hasChildren = item.children && item.children.length > 0;
  const isGroupActiveState = isGroupActive(item);
  const hasActivePath = isGroupActiveState || isActive;

  return (
    <li className={styles.navItem}>
      {hasChildren ? (
        <>
          {/* Collapsible group header */}
          <button
            className={hasActivePath ? styles.navLinkActive : styles.navLink}
            onClick={() => onToggle(item.id)}
            onKeyDown={(e) => onKeyDown(e, () => onToggle(item.id))}
            aria-expanded={!isCollapsed}
            aria-controls={`nav-group-${item.id}`}
            type="button"
          >
            <div className={styles.navLinkContent}>
              {item.icon}
              <span className={styles.navLabel}>{item.label}</span>
              {showBadges && item.badge && (
                <span className={styles.navBadge}>{item.badge}</span>
              )}
            </div>
            <svg
              className={
                isCollapsed ? styles.chevronCollapsed : styles.chevronExpanded
              }
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          {/* Child items */}
          {!isCollapsed && item.children && (
            <ul className={styles.navSubList} id={`nav-group-${item.id}`}>
              {item.children.map((child) => (
                <NavigationMenuItem
                  key={child.id}
                  item={child}
                  currentPath={currentPath}
                  showBadges={showBadges}
                  isCollapsed={false}
                  onNavigate={onNavigate}
                  onToggle={onToggle}
                  onKeyDown={onKeyDown}
                  level={level + 1}
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        /* Regular navigation item */
        <button
          className={isActive ? styles.navLinkActive : styles.navLink}
          onClick={() => onNavigate(item)}
          onKeyDown={(e) => onKeyDown(e, () => onNavigate(item))}
          aria-current={isActive ? 'page' : undefined}
          type="button"
        >
          <div className={styles.navLinkContent}>
            {item.icon}
            <span className={styles.navLabel}>{item.label}</span>
            {showBadges && item.badge && (
              <span className={styles.navBadge}>{item.badge}</span>
            )}
          </div>
        </button>
      )}
    </li>
  );
}
