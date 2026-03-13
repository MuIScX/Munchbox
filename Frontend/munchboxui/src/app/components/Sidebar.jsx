'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthAPI } from '../../lib/api';
import {
  Home,
  FileChartColumn,
  Package,
  UserCircle,
  LineChart,
  Bell,
  Settings,
  HelpCircle,
  ClipboardClock,
  Menu,
  X,
  LogOut,
  ChevronUp
} from 'lucide-react';

function AnimatedCookingPot({ isActive, className }) {
  return (
    <>
      <style>{`
        @keyframes potLidFloat {
          0%, 100% { transform: rotate(-22deg); }
          50%       { transform: rotate(-30deg) translateY(-1px); }
        }
        .pot-lid-open {
          animation: potLidFloat 2s ease-in-out infinite;
          transform-origin: 20px 12px;
        }
        .pot-lid-closed {
          transform: rotate(0deg);
          transform-origin: 20px 12px;
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes steamUp {
          0%   { opacity: 0; transform: translateY(0px) scaleX(1); }
          40%  { opacity: 0.7; }
          100% { opacity: 0; transform: translateY(-7px) scaleX(1.3); }
        }
        .steam-1 { animation: steamUp 1.8s ease-in-out 0.1s infinite; transform-origin: center bottom; }
        .steam-2 { animation: steamUp 1.8s ease-in-out 0.7s infinite; transform-origin: center bottom; }
      `}</style>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20" height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ overflow: 'visible' }}
      >
        {isActive && (
          <g>
            <path className="steam-1" d="M9 11 Q8 8.5 9 6.5" strokeWidth="1.5" opacity="0" />
            <path className="steam-2" d="M15 11 Q14 8.5 15 6.5" strokeWidth="1.5" opacity="0" />
          </g>
        )}
        <path d="M4 13h16v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7z" />
        <path d="M2 15h2" />
        <path d="M20 15h2" />
        <g className={isActive ? 'pot-lid-open' : 'pot-lid-closed'}>
          <path d="M4 13 Q12 7 20 13" />
          <line x1="12" y1="8.5" x2="12" y2="6.5" />
          <circle cx="12" cy="6" r="1.2" fill="currentColor" stroke="none" />
        </g>
      </svg>
    </>
  );
}

function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchUser() {
      try {
        const res = await AuthAPI.me();
        const data = res.Data ?? res;
        if (!cancelled) {
          setUser({
            name: data.username ?? 'Unknown',
            email: data.email ?? '',
            role: data.permission === 1 ? 'User' : 'Admin',
            avatarUrl: undefined,
            initials: (data.username ?? 'U')
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2),
          });
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load user');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchUser();
    return () => { cancelled = true; };
  }, []);

  return { user, loading, error };
}

function UserAvatar({ user, loading }) {
  if (loading || !user) {
    return <div className="w-10 h-10 rounded-full bg-slate-700 animate-pulse shrink-0" />;
  }
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className="w-10 h-10 rounded-full object-cover shrink-0 ring-2 ring-orange-500/40"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 shrink-0 flex items-center justify-center ring-2 ring-orange-500/30">
      <span className="text-white text-sm font-bold tracking-wide">
        {user.initials ?? user.name.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname() || '/reports';
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, loading, error } = useCurrentUser();

  const handleLogout = () => {
    AuthAPI.logout();
    router.push('/login');
  };

  const navSections = [
    {
      title: 'QUICK ACCESS',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: Home, color: 'text-orange-500' },
        { name: 'View Reports', path: '/reports/', icon: FileChartColumn, color: 'text-emerald-500' },
        { name: 'Manage Inventory', path: '/manageinventory/', icon: Package, color: 'text-blue-500' },
      ],
    },
    {
      title: 'SERVICE',
      items: [
        { name: 'Manage Staff', path: '/managestaff', icon: UserCircle, color: 'text-orange-500' },
        { name: 'Predict Ingredients', path: '/predict', icon: LineChart, color: 'text-emerald-500' },
        { name: 'Manage Recipe', path: '/managemenu', icon: null, color: 'text-purple-500', animatedPot: true },
        { name: 'Manage Inventory', path: '/manageinventory', icon: Package, color: 'text-blue-500' },
        { name: 'View Reports', path: '/reports', icon: FileChartColumn, color: 'text-emerald-500' },
        { name: 'Inventory Log', path: '/inventorylog', icon: ClipboardClock, color: 'text-yellow-500' },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        { name: 'Settings', path: '/settings', icon: Settings, color: 'text-slate-500' },
        { name: 'FAQ', path: '/faq', icon: HelpCircle, color: 'text-red-500' },
      ],
    },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#111424] border border-blue-500/30 rounded-md text-white"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsOpen(false)} />
      )}

      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 h-screen bg-[#111424]
        text-slate-300 flex flex-col font-sans border-r border-blue-500/30
        transition-transform duration-300 ease-in-out overflow-hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static
      `}>
        <div className="p-6 pt-8 mb-4">
          <h1 className="text-3xl font-extrabold text-orange-500 tracking-wide">MunchBox</h1>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 space-y-8 no-scrollbar">
          {navSections.map((section, idx) => (
            <div key={idx}>
              <h2 className="text-xs font-bold text-slate-200 tracking-wider italic mb-4 px-2">
                {section.title}
              </h2>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.path}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-4 px-2 py-3 rounded-lg transition-colors relative ${
                          isActive
                            ? 'bg-[#1e233b] text-white font-semibold'
                            : 'hover:bg-[#1e233b]/50 hover:text-white text-slate-300'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500 rounded-r-md" />
                        )}
                        {item.animatedPot
                          ? <AnimatedCookingPot isActive={isActive} className={`w-5 h-5 ${item.color}`} />
                          : <item.icon className={`w-5 h-5 ${item.color}`} strokeWidth={2.5} />
                        }
                        <span className="text-[15px]">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-800">
          {profileOpen && (
            <div className="px-3 py-2 space-y-1 border-b border-slate-800 bg-[#0d1020]">
              <Link
                href="/profile"
                onClick={() => { setProfileOpen(false); setIsOpen(false); }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-[#1e233b] hover:text-white transition-colors"
              >
                <UserCircle className="w-4 h-4 text-orange-500" strokeWidth={2} />
                View Profile
              </Link>
              <Link
                href="/settings"
                onClick={() => { setProfileOpen(false); setIsOpen(false); }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-[#1e233b] hover:text-white transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-400" strokeWidth={2} />
                Account Settings
              </Link>
              <button
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" strokeWidth={2} />
                Sign Out
              </button>
            </div>
          )}

          <button
            onClick={() => setProfileOpen((prev) => !prev)}
            className="w-full p-4 flex items-center gap-3 hover:bg-[#1e233b]/60 transition-colors group"
          >
            <UserAvatar user={user} loading={loading} />
            <div className="flex flex-col flex-1 overflow-hidden text-left">
              {loading ? (
                <>
                  <div className="h-3.5 w-24 bg-slate-700 rounded animate-pulse mb-1.5" />
                  <div className="h-3 w-32 bg-slate-800 rounded animate-pulse" />
                </>
              ) : error ? (
                <span className="text-xs text-red-400">Could not load user</span>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{user?.name}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 shrink-0">
                      {user?.role}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 truncate">{user?.email}</span>
                </>
              )}
            </div>
            <ChevronUp
              className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 group-hover:text-slate-300 ${
                profileOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>
        </div>
      </aside>
    </>
  );
}