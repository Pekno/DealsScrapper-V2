/**
 * SettingsModal - Modal component for user settings
 *
 * This component provides a modal interface for managing user account settings
 * including profile information, password changes, and account management.
 * Note: Notification settings are managed per-filter, not globally.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { apiClient } from '@/shared/lib/api';
import { useToast } from '@/shared/lib/toast-context';
import Modal from './Modal';
import { FormField } from './FormField';
import { Input } from './Input';
import moment from 'moment';
import { Button } from './Button';

interface UserProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
}

interface PasswordChangeFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface SettingsModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to call when modal should be closed */
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, refreshUser, loading } = useAuth();
  const { toast } = useToast();

  // Profile form state
  const [profileForm, setProfileForm] = useState<UserProfileFormData>({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password form state
  const [passwordForm, setPasswordForm] = useState<PasswordChangeFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Active tab state
  const [activeTab, setActiveTab] = useState<
    'profile' | 'password' | 'account'
  >('profile');

  // Initialize form data when user changes
  useEffect(() => {
    if (user && isOpen) {
      setProfileForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
      });
    }
  }, [user, isOpen]);

  // Reset form states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('profile');
      setProfileError('');
      setPasswordError('');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [isOpen]);

  if (!user) {
    return null;
  }

  // Handle profile form submission
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setProfileLoading(true);
    setProfileError('');

    try {
      const response = await apiClient.updateProfile(profileForm);

      if (response.success) {
        toast.success('Profile updated successfully!', {
          title: 'Profile Updated',
          duration: 4000,
        });
        await refreshUser(); // Refresh user data in context
      } else {
        setProfileError(response.error || 'Failed to update profile');
        toast.error(response.error || 'Failed to update profile', {
          title: 'Update Failed',
        });
      }
    } catch (error) {
      const errorMessage = 'An error occurred while updating your profile';
      setProfileError(errorMessage);
      toast.error(errorMessage, {
        title: 'Network Error',
      });
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle password form submission
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setPasswordLoading(true);
    setPasswordError('');

    // Client-side validation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      setPasswordLoading(false);
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      setPasswordLoading(false);
      return;
    }

    try {
      const response = await apiClient.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      if (response.success) {
        toast.success('Password changed successfully!', {
          title: 'Password Updated',
          duration: 4000,
        });
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        setPasswordError(response.error || 'Failed to change password');
        toast.error(response.error || 'Failed to change password', {
          title: 'Password Change Failed',
        });
      }
    } catch (error) {
      const errorMessage = 'An error occurred while changing your password';
      setPasswordError(errorMessage);
      toast.error(errorMessage, {
        title: 'Network Error',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Tab navigation
  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'password', label: 'Password' },
    { id: 'account', label: 'Account' },
  ] as const;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <form id="settings-form" onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="First Name" required>
                <Input
                  type="text"
                  value={profileForm.firstName}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      firstName: e.target.value,
                    })
                  }
                  placeholder="Enter your first name"
                  required
                />
              </FormField>

              <FormField label="Last Name" required>
                <Input
                  type="text"
                  value={profileForm.lastName}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, lastName: e.target.value })
                  }
                  placeholder="Enter your last name"
                  required
                />
              </FormField>
            </div>

            <FormField label="Email Address" required>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, email: e.target.value })
                }
                placeholder="Enter your email address"
                required
              />
            </FormField>

            {profileError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600 text-sm">{profileError}</p>
              </div>
            )}
          </form>
        );

      case 'password':
        return (
          <form id="settings-form" onSubmit={handlePasswordSubmit} className="space-y-4">
            <FormField label="Current Password" required>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    currentPassword: e.target.value,
                  })
                }
                placeholder="Enter your current password"
                required
              />
            </FormField>

            <FormField label="New Password" required>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    newPassword: e.target.value,
                  })
                }
                placeholder="Enter your new password"
                required
              />
            </FormField>

            <FormField label="Confirm New Password" required>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Confirm your new password"
                required
              />
            </FormField>

            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-600 text-sm">{passwordError}</p>
              </div>
            )}
          </form>
        );

      case 'account':
        return (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Account created:{' '}
                {moment(user.createdAt || Date.now()).format('MMMM DD, YYYY')}
              </p>

              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-red-800 mb-2">
                  Danger Zone
                </h4>
                <p className="text-sm text-red-600 mb-3">
                  Once you delete your account, there is no going back. Please
                  be certain.
                </p>
                <Button variant="danger" size="sm">
                  Delete Account
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const isSaveableTab = activeTab === 'profile' || activeTab === 'password';
  const isSaveLoading = activeTab === 'profile' ? profileLoading : passwordLoading;
  const saveButtonLabel = activeTab === 'password' ? 'Change Password' : 'Save Changes';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {isSaveableTab && (
            <Button
              type="submit"
              form="settings-form"
              loading={isSaveLoading}
              disabled={isSaveLoading}
            >
              {saveButtonLabel}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col h-full max-h-[70vh]">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6 -mx-6 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">{renderTabContent()}</div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
