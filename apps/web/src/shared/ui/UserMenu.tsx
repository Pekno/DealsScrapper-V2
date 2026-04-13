/**
 * UserMenu - Dropdown menu for user profile actions
 *
 * This component provides a dropdown menu with user actions like Settings and Logout.
 * It includes proper keyboard navigation and accessibility features.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as styles from './UserMenu.css';
import { dataCy } from '@/shared/lib/test-utils';

export interface UserMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant?: 'default' | 'danger';
  onClick: () => void;
}

export interface UserMenuProps {
  /** Menu actions/items */
  actions: UserMenuAction[];
  /** Trigger content (user profile component) */
  children: React.ReactNode;
  /** Whether the menu is disabled */
  disabled?: boolean;
  /** Custom CSS classes */
  className?: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({
  actions,
  children,
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Toggle menu
  const toggleMenu = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      setFocusedIndex(-1);
    }
  }, [disabled]);

  // Close menu
  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  // Handle action click
  const handleActionClick = useCallback(
    (action: UserMenuAction) => {
      action.onClick();
      closeMenu();
    },
    [closeMenu]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (!isOpen) {
            toggleMenu();
          } else if (focusedIndex >= 0 && focusedIndex < actions.length) {
            handleActionClick(actions[focusedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          closeMenu();
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            toggleMenu();
          } else {
            setFocusedIndex((prev) =>
              prev < actions.length - 1 ? prev + 1 : 0
            );
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (!isOpen) {
            toggleMenu();
          } else {
            setFocusedIndex((prev) =>
              prev > 0 ? prev - 1 : actions.length - 1
            );
          }
          break;
        case 'Tab':
          // Allow natural tab behavior, but close menu
          closeMenu();
          break;
      }
    },
    [isOpen, focusedIndex, actions, toggleMenu, closeMenu, handleActionClick]
  );

  // Handle dropdown item keyboard navigation
  const handleDropdownKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      switch (event.key) {
        case 'Enter':
        case ' ':
          event.preventDefault();
          handleActionClick(actions[index]);
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(index < actions.length - 1 ? index + 1 : 0);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(index > 0 ? index - 1 : actions.length - 1);
          break;
        case 'Escape':
          event.preventDefault();
          closeMenu();
          break;
      }
    },
    [actions, handleActionClick, closeMenu]
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, closeMenu]);

  // Focus management for dropdown items
  useEffect(() => {
    if (isOpen && dropdownRef.current && focusedIndex >= 0) {
      const items = dropdownRef.current.querySelectorAll(
        'button[role="menuitem"]'
      );
      const item = items[focusedIndex] as HTMLButtonElement;
      item?.focus();
    }
  }, [isOpen, focusedIndex]);

  const containerClassName = `${styles.container} ${className}`.trim();

  return (
    <div ref={containerRef} className={containerClassName}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        className={styles.trigger}
        onClick={toggleMenu}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        disabled={disabled}
        {...dataCy('user-menu')}
      >
        {children}
      </button>

      {/* Backdrop for mobile */}
      {isOpen && <div className={styles.backdrop} onClick={closeMenu} />}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className={styles.dropdown}
          role="menu"
          aria-orientation="vertical"
        >
          {actions.map((action, index) => (
            <button
              key={action.id}
              className={
                action.variant === 'danger'
                  ? `${styles.menuItem} ${styles.menuItemVariants.danger}`
                  : styles.menuItem
              }
              onClick={() => handleActionClick(action)}
              onKeyDown={(e) => handleDropdownKeyDown(e, index)}
              role="menuitem"
              tabIndex={focusedIndex === index ? 0 : -1}
              {...dataCy(
                action.id === 'logout' ? 'logout-button' : `menu-${action.id}`
              )}
            >
              <span className={styles.menuItemIcon}>{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserMenu;
