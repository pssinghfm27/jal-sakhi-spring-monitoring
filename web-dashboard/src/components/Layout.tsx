// SPDX-License-Identifier: MIT
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar with hamburger */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-chirag-surface border-b border-chirag-border sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-chirag-bg transition-colors"
            aria-label="Open navigation"
          >
            <svg className="w-6 h-6 text-chirag-text" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-chirag-primary flex items-center justify-center text-white font-bold text-xs">J</div>
            <span className="font-semibold text-sm">Jal Sakhi</span>
          </div>
        </div>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
