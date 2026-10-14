// SPDX-License-Identifier: MIT
import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  showBadge?: boolean;
}

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/map',     label: 'Map',         icon: '🗺️' },
      { to: '/compare', label: 'Comparative', icon: '📊' },
      { to: '/alerts',  label: 'Alerts',      icon: '🔔' },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/springs',        label: 'Springs',  icon: '💧' },
      { to: '/readings',       label: 'Readings', icon: '📋' },
      { to: '/krp-management', label: 'KRPs',     icon: '👥' },
    ],
  },
  {
    title: 'Approvals',
    items: [
      { to: '/approvals', label: 'Pending KRPs', icon: '⏳', showBadge: true },
    ],
  },
];

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const { user, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  // Poll the pending-approvals count every 60s so managers see new signups.
  useEffect(() => {
    let cancelled = false;
    const tick = () => api.pendingKrps()
      .then((r) => { if (!cancelled) setPendingCount(r.count); })
      .catch(() => {});
    tick();
    const id = setInterval(tick, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const sidebarContent = (
    <>
      <div className="px-5 py-5 border-b border-chirag-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-chirag-primary flex items-center justify-center text-white font-bold text-sm">J</div>
          <div>
            <div className="font-semibold leading-tight">Jal Sakhi</div>
            <div className="text-xs text-chirag-muted">CHIRAG Springshed</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title}>
            <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-chirag-muted/70">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 ' +
                    (isActive
                      ? 'bg-chirag-primary/10 text-chirag-primary font-medium shadow-sm'
                      : 'text-chirag-text hover:bg-chirag-bg hover:translate-x-0.5')
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-base">{l.icon}</span>
                    <span>{l.label}</span>
                  </span>
                  {l.showBadge && pendingCount > 0 && (
                    <span className="bg-chirag-warning text-white text-xs font-semibold rounded-full px-2 py-0.5 min-w-[22px] text-center animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-chirag-border text-sm">
        <div className="font-medium">{user?.name}</div>
        <div className="text-xs text-chirag-muted mb-2">{user?.email || user?.phone}</div>
        <button onClick={logout} className="btn-outline w-full text-sm">Log out</button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <aside className="hidden md:flex md:flex-col w-60 bg-chirag-surface border-r border-chirag-border min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile overlay sidebar */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <aside className="relative w-64 bg-chirag-surface flex flex-col shadow-xl animate-slide-in">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
