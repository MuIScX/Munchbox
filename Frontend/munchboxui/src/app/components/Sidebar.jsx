'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  FileChartColumn, 
  Package, 
  UserCircle, 
  LineChart, 
  CookingPot, 
  Bell, 
  Settings, 
  HelpCircle,
  ClipboardClock,
  Menu,
  X
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname() || '/notifications'; 
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => setIsOpen(!isOpen);

  const navSections = [
    {
      title: 'QUICK ACCESS',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: Home, color: 'text-orange-500' },
        { name: 'View Reports', path: '/reports', icon: FileChartColumn, color: 'text-emerald-500' },
        { name: 'Manage Inventory', path: '/manageinventory/', icon: Package, color: 'text-blue-500' },
      ],
    },
    {
      title: 'SERVICE',
      items: [
        { name: 'Manage Staff', path: '/managestaff', icon: UserCircle, color: 'text-orange-500' },
        { name: 'Predict Ingredients', path: '/predict', icon: LineChart, color: 'text-emerald-500' },
        { name: 'Manage Menu', path: '/managemenu', icon: CookingPot, color: 'text-purple-500' },
        { name: 'Manage Inventory', path: '/manageinventory', icon: Package, color: 'text-blue-500' },
        { name: 'View Reports', path: '/service-reports', icon: FileChartColumn, color: 'text-emerald-500' },
        { name: 'Inventory Log', path: '/inventorylog', icon: ClipboardClock, color: 'text-yellow-500' },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        { name: 'Notifications', path: '/notifications', icon: Bell, color: 'text-yellow-500' },
        { name: 'Settings', path: '/settings', icon: Settings, color: 'text-slate-500' },
        { name: 'FAQ', path: '/faq', icon: HelpCircle, color: 'text-red-500' },
      ],
    },
  ];

  return (
    <>
      {/* --- Mobile Trigger Button --- */}
      <button 
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#111424] border border-blue-500/30 rounded-md text-white"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* --- Mobile Backdrop --- */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={toggleSidebar}
        />
      )}

      {/* --- Sidebar --- */}
   <aside className={`
  fixed inset-y-0 left-0 z-40 w-64 h-screen bg-[#111424] 
  text-slate-300 flex flex-col font-sans border-r border-blue-500/30 
  transition-transform duration-300 ease-in-out overflow-hidden
  
  ${isOpen ? 'translate-x-0' : '-translate-x-full'}
  lg:translate-x-0 lg:static 
`}>
        
        {/* Logo */}
        <div className="p-6 pt-8 mb-4">
          <h1 className="text-3xl font-extrabold text-orange-500 tracking-wide">
            MunchBox
          </h1>
        </div>

        {/* Navigation Sections */}
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
                        onClick={() => setIsOpen(false)} // Close sidebar on link click (mobile)
                        className={`flex items-center gap-4 px-2 py-3 rounded-lg transition-colors relative ${
                          isActive 
                            ? 'bg-[#1e233b] text-white font-semibold' 
                            : 'hover:bg-[#1e233b]/50 hover:text-white text-slate-300'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500 rounded-r-md" />
                        )}
                        
                        <item.icon className={`w-5 h-5 ${item.color}`} strokeWidth={2.5} />
                        <span className="text-[15px]">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Bottom Profile Area */}
        <div className="p-6 mt-auto flex items-center gap-3 border-t border-slate-800">
          <div className="w-10 h-10 rounded-full bg-slate-600 shrink-0"></div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium text-white truncate">Admin User</span>
            <span className="text-xs text-slate-500 truncate">admin@munchbox.com</span>
          </div>
        </div>
      </aside>
    </>
  );
}