// SPDX-License-Identifier: MIT
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('manager@chirag.org');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      nav(loc.state?.from || '/map', { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-chirag-primary flex items-center justify-center text-white font-bold">J</div>
          <div>
            <div className="text-lg font-semibold">Jal Sakhi</div>
            <div className="text-sm text-chirag-muted">CHIRAG Springshed Dashboard</div>
          </div>
        </div>
        <label className="block">
          <span className="text-sm text-chirag-muted">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input mt-1"
            autoComplete="username"
          />
        </label>
        <label className="block">
          <span className="text-sm text-chirag-muted">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input mt-1"
            autoComplete="current-password"
          />
        </label>
        {err && <div className="text-chirag-alert text-sm">{err}</div>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-chirag-muted text-center">
          Managers and admins only. KRPs use the mobile app.
        </p>
      </form>
    </div>
  );
}
