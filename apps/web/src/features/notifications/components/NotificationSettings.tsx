/**
 * NotificationSettings - Checkbox group for notification preferences
 * Allows users to configure their notification preferences for filters
 */
import React from 'react';
import * as styles from './NotificationSettings.css';
import { dataCy } from '@/shared/lib/test-utils';

export interface NotificationSettings {
  /** Immediate notification for each new matching listing */
  immediate: boolean;
  /** Daily digest email */
  dailyDigest: boolean;
  /** Weekly digest email */
  weeklyDigest: boolean;
  /** Monthly digest email */
  monthlyDigest: boolean;
}

export interface NotificationSettingsProps {
  /** Current notification settings */
  settings: NotificationSettings;
  /** Callback when settings change */
  onSettingsChange: (settings: NotificationSettings) => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

interface CheckboxOptionProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  indent?: boolean;
  dataCyId?: string; // For test attributes
}

const CheckboxOption: React.FC<CheckboxOptionProps> = ({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  indent = false,
  dataCyId,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.checked);
  };

  return (
    <label
      htmlFor={id}
      className={`${styles.notificationSettings.option} ${
        indent ? styles.notificationSettings.indentedOption : ''
      } ${disabled ? styles.notificationSettings.disabledOption : ''}`}
      {...(dataCyId ? dataCy(`${dataCyId}-label`) : {})}
    >
      <div className={styles.notificationSettings.checkboxWrapper}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className={styles.notificationSettings.checkbox}
          {...(dataCyId ? dataCy(dataCyId) : {})}
        />
        <div className={styles.notificationSettings.checkmark}>
          {checked && (
            <svg
              className={styles.notificationSettings.checkIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>

      <div className={styles.notificationSettings.labelContent}>
        <div className={styles.notificationSettings.labelText}>{label}</div>
        <div className={styles.notificationSettings.descriptionText}>
          {description}
        </div>
      </div>
    </label>
  );
};

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  settings,
  onSettingsChange,
  disabled = false,
}) => {
  const handleSettingChange =
    (key: keyof NotificationSettings) => (checked: boolean) => {
      onSettingsChange({
        ...settings,
        [key]: checked,
      });
    };

  return (
    <div className={styles.notificationSettings.container}>
      {/* Immediate notifications */}
      <CheckboxOption
        id="immediate-notifications"
        label="Immediate notification for each new matching listing"
        description="Get notified instantly when a deal matching your filter is found"
        checked={settings.immediate}
        onChange={handleSettingChange('immediate')}
        disabled={disabled}
        dataCyId="immediate-notifications-checkbox"
      />

      {/* Digest section header */}
      <div className={styles.notificationSettings.digestHeader}>
        And/Or a digest:
      </div>

      {/* Digest options */}
      <div className={styles.notificationSettings.digestOptions}>
        <CheckboxOption
          id="daily-digest"
          label="Daily digest"
          description="Receive a daily summary of all matching deals"
          checked={settings.dailyDigest}
          onChange={handleSettingChange('dailyDigest')}
          disabled={disabled}
          indent
        />

        <CheckboxOption
          id="weekly-digest"
          label="Weekly digest"
          description="Receive a weekly summary of all matching deals"
          checked={settings.weeklyDigest}
          onChange={handleSettingChange('weeklyDigest')}
          disabled={disabled}
          indent
        />

        <CheckboxOption
          id="monthly-digest"
          label="Monthly digest"
          description="Receive a monthly summary of all matching deals"
          checked={settings.monthlyDigest}
          onChange={handleSettingChange('monthlyDigest')}
          disabled={disabled}
          indent
        />
      </div>
    </div>
  );
};

export default NotificationSettings;
