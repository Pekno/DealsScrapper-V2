/**
 * Toast Context Provider
 *
 * Provides toast notification functionality throughout the application.
 * Supports persistent toasts across page navigation and stacking.
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import Toast, { ToastContainer, ToastType } from '@/shared/ui/Toast';

export interface ToastData {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  createdAt: number;
}

export interface ToastOptions {
  /** Toast title (optional) */
  title?: string;
  /** Auto-dismiss duration in milliseconds (0 = no auto-dismiss, default = 5000) */
  duration?: number;
}

export interface ToastContextType {
  /** Show a toast notification */
  toast: {
    success: (message: string, options?: ToastOptions) => string;
    error: (message: string, options?: ToastOptions) => string;
    warning: (message: string, options?: ToastOptions) => string;
    info: (message: string, options?: ToastOptions) => string;
  };
  /** Manually dismiss a toast by ID */
  dismissToast: (id: string) => void;
  /** Clear all toasts */
  clearAllToasts: () => void;
  /** Get current toasts */
  toasts: ToastData[];
}

const ToastContext = createContext<ToastContextType | null>(null);

let toastCounter = 0;

const generateToastId = () => {
  toastCounter += 1;
  return `toast-${Date.now()}-${toastCounter}`;
};

export const ToastProvider: React.FC<{
  children: React.ReactNode;
  /** Maximum number of toasts to show simultaneously */
  maxToasts?: number;
}> = ({ children, maxToasts = 5 }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const toastRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Ensure client-side only rendering to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, options: ToastOptions = {}) => {
      const id = generateToastId();
      const { title, duration = 5000 } = options;

      const newToast: ToastData = {
        id,
        type,
        title,
        message,
        duration,
        createdAt: Date.now(),
      };

      setToasts((prevToasts) => {
        const updatedToasts = [newToast, ...prevToasts];

        // Limit the number of toasts
        if (updatedToasts.length > maxToasts) {
          const removedToasts = updatedToasts.slice(maxToasts);
          removedToasts.forEach((toast) => {
            const timeout = toastRefs.current.get(toast.id);
            if (timeout) {
              clearTimeout(timeout);
              toastRefs.current.delete(toast.id);
            }
          });
          return updatedToasts.slice(0, maxToasts);
        }

        return updatedToasts;
      });

      return id;
    },
    [maxToasts]
  );

  const dismissToast = useCallback((id: string) => {
    // Clear any existing timeout
    const timeout = toastRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      toastRefs.current.delete(id);
    }

    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    // Clear all timeouts
    toastRefs.current.forEach((timeout) => clearTimeout(timeout));
    toastRefs.current.clear();

    setToasts([]);
  }, []);

  // Toast utility functions
  const toastUtils = {
    success: (message: string, options?: ToastOptions) =>
      addToast('success', message, options),
    error: (message: string, options?: ToastOptions) =>
      addToast('error', message, options),
    warning: (message: string, options?: ToastOptions) =>
      addToast('warning', message, options),
    info: (message: string, options?: ToastOptions) =>
      addToast('info', message, options),
  };

  const contextValue: ToastContextType = {
    toast: toastUtils,
    dismissToast,
    clearAllToasts,
    toasts,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Render toasts - only on client side to avoid hydration mismatch */}
      {isMounted && (
        <ToastContainer>
          {toasts.map((toastData, index) => (
            <Toast
              key={toastData.id}
              id={toastData.id}
              type={toastData.type}
              title={toastData.title}
              message={toastData.message}
              duration={toastData.duration}
              onDismiss={dismissToast}
              stackPosition={index}
            />
          ))}
        </ToastContainer>
      )}
    </ToastContext.Provider>
  );
};

/**
 * Custom hook to use toast notifications
 * @throws Error if used outside of ToastProvider
 */
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
};

export default ToastProvider;
