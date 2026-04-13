import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { apiClient, type User, type RegistrationData } from '@/shared/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state on mount with race condition protection
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates if component unmounts
    let initializationPromise: Promise<void> | null = null;

    const initializeAuth = async (): Promise<void> => {
      try {
        const token = apiClient.getToken();

        if (!isMounted) return; // Prevent state updates if unmounted

        if (token) {
          // Retry logic with exponential backoff for token validation
          let retries = 3;
          let delay = 200; // Start with 200ms delay

          while (retries > 0 && isMounted) {
            try {
              const response = await apiClient.getProfile();
              if (!isMounted) return; // Check again after async operation

              if (response.success && response.data) {
                if (isMounted) setUser(response.data);
                break; // Success, exit retry loop
              } else {
                // Invalid token, remove it
                apiClient.removeToken();
                if (isMounted) setUser(null);
                break; // Invalid token, exit retry loop
              }
            } catch (error) {
              console.error(
                `Auth: Failed to validate token (${retries} retries left):`,
                error
              );
              retries--;

              if (retries > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
              } else {
                // All retries exhausted
                console.error(
                  'Auth: All token validation retries exhausted, removing token'
                );
                apiClient.removeToken();
                if (isMounted) setUser(null);
              }
            }
          }
        } else {
          if (isMounted) setUser(null);
        }
      } catch (error) {
        console.error('Auth: Critical error during initialization:', error);
        if (isMounted) setUser(null);
      } finally {
        // Always set loading to false, even if there are errors
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Store the promise to prevent multiple initializations
    initializationPromise = initializeAuth();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);

      const response = await apiClient.login({ email, password });

      if (response.success && response.data) {
        // Extract login data directly from the response
        const { access_token, user } = response.data;

        if (!access_token || !user) {
          console.error(
            'Auth: Invalid login response structure:',
            response.data
          );
          return {
            success: false,
            error: 'Invalid response format from server',
          };
        }

        // Store token first
        apiClient.setToken(access_token);

        // Set user state immediately - convert backend user to frontend User interface
        setUser({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role || 'USER',
          createdAt: user.createdAt.toString(),
          updatedAt: user.createdAt.toString(), // Use createdAt as fallback
        });

        return { success: true };
      } else {
        return {
          success: false,
          error: response.error || 'Login failed',
        };
      }
    } catch (error) {
      console.error('Auth: Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<{ success: boolean; error?: string; user?: User }> => {
    try {
      setLoading(true);

      const response = await apiClient.register({
        email,
        password,
        firstName,
        lastName,
      });

      if (response.success && response.data) {
        // Extract registration data from response
        const { user, nextStep } = response.data;

        if (!user) {
          console.error(
            'Auth: Invalid registration response structure:',
            response.data
          );
          return {
            success: false,
            error: 'Invalid response format from server',
          };
        }

        // Return success with user data but don't auto-login
        // User needs to verify email first
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role || 'USER',
            createdAt: user.createdAt.toString(),
            updatedAt: user.createdAt.toString(), // Use createdAt as fallback
          },
        };
      } else {
        return {
          success: false,
          error: response.error || 'Registration failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setLoading(true);

      // Call backend logout endpoint
      await apiClient.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local state regardless of backend response
      apiClient.removeToken();
      setUser(null);
      setLoading(false);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const response = await apiClient.getProfile();
      if (response.success && response.data) {
        setUser(response.data);
      } else {
        // Token might be expired, logout user
        await logout();
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      await logout();
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hook to check if user is authenticated
export function useRequireAuth(): User | null {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to login page
      window.location.href = '/login';
    }
  }, [user, loading]);

  return user;
}

// Debug hook for development - provides detailed auth state information
export function useAuthDebug(): {
  user: User | null;
  loading: boolean;
  hasToken: boolean;
  tokenPreview: string | null;
  tokenStatus: string;
  lastChecked: string;
} {
  const { user, loading } = useAuth();
  const [lastChecked, setLastChecked] = useState<string>(
    new Date().toISOString()
  );

  const hasToken =
    typeof window !== 'undefined' ? !!apiClient.getToken() : false;
  const tokenPreview =
    typeof window !== 'undefined'
      ? apiClient.getToken()?.substring(0, 20) || null
      : null;

  // Generate comprehensive token status
  const tokenStatus = useMemo(() => {
    if (typeof window === 'undefined') return 'SSR - No token available';

    const token = apiClient.getToken();
    if (!token) return 'No token found in localStorage';

    // Validate token format
    const parts = token.split('.');
    if (parts.length !== 3)
      return `Invalid token format (${parts.length} parts)`;

    try {
      // Basic decode check (without validation)
      const payload = JSON.parse(atob(parts[1]));
      const isExpired = payload.exp && Date.now() >= payload.exp * 1000;
      const hasUserId = !!(payload.sub || payload.userId);

      if (isExpired) return 'Token expired';
      if (!hasUserId) return 'Token missing user identifier';

      return 'Token valid and ready';
    } catch (error) {
      return 'Token decode error';
    }
  }, [hasToken, tokenPreview]);

  // Update lastChecked when token state changes
  useEffect(() => {
    setLastChecked(new Date().toISOString());
  }, [hasToken, tokenPreview, tokenStatus]);

  return { user, loading, hasToken, tokenPreview, tokenStatus, lastChecked };
}
