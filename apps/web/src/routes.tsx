import { Routes, Route } from 'react-router-dom';

import HomePage from '@/app/page';
import LoginPage from '@/app/login/page';
import RegisterPage from '@/app/register/page';
import ForgotPasswordPage from '@/app/auth/forgot-password/page';
import ResetPasswordPage from '@/app/auth/reset-password/page';
import FiltersPage from '@/app/filters/page';
import FilterCreatePage from '@/app/filters/create/page';
import FilterDetailPage from '@/app/filters/[id]/FilterDetailPageClient';
import FilterEditPage from '@/app/filters/[id]/edit/page';
import VerifyEmailPage from '@/app/verify-email/page';
import VerifyEmailConfirmPage from '@/app/verify-email/confirm/page';
import AdminPage from '@/app/admin/page';
import NotFoundPage from '@/app/not-found';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route path="/filters" element={<FiltersPage />} />
      <Route path="/filters/create" element={<FilterCreatePage />} />
      <Route path="/filters/:id" element={<FilterDetailPage />} />
      <Route path="/filters/:id/edit" element={<FilterEditPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/verify-email/confirm" element={<VerifyEmailConfirmPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
