import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from '@/shared/lib/query-client';
import { AuthProvider } from '@/features/auth/hooks/useAuth';
import { ToastProvider } from '@/shared/lib/toast-context';
import { AppRoutes } from '@/routes';
import './app/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <AuthProvider>
          <ToastProvider maxToasts={5}>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </BrowserRouter>
  </StrictMode>
);
