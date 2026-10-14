// SPDX-License-Identifier: MIT
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}
