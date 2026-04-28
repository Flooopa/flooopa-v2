'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  MessageSquare,
  Brain,
  Settings,
  Plug,
  HelpCircle,
  Menu,
  X,
  Moon,
  Sun,
  ChevronRight,
  Users,
  Terminal,
  Database,
} from 'lucide-react';
import { UserButton } from '@clerk/nextjs';
import { useTheme } from '@/components/ThemeProvider';
import { RealtimeProvider } from '@/components/RealtimeProvider';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/board', label: 'Board', icon: ClipboardList },
  { href: '/feed', label: 'Feed', icon: MessageSquare },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/context', label: 'Context', icon: Database },
  { href: '/workspace', label: 'Workspace', icon: Users },
  { href: '/logs', label: 'Logs', icon: Terminal },
  { href: '/api-config', label: 'API Config', icon: Plug },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/help', label: 'Help', icon: HelpCircle },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const activeItem = navItems.find((item) => item.href === pathname);

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-60 bg-white dark:bg-card border-r border-border flex flex-col',
          'transform transition-transform duration-200 ease-in-out',
          'lg:transform-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-border">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <span className="font-semibold text-sm tracking-tight">Orchestrator</span>
          <button
            className="lg:hidden ml-auto p-1.5 rounded-md hover:bg-muted"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative',
                  isActive
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                )}
                <Icon className={cn('w-4 h-4', isActive && 'text-primary')} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 w-full transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <div className="flex items-center gap-3 px-3 py-2">
            <UserButton afterSignOutUrl="/sign-in" appearance={{ elements: { avatarBox: 'w-6 h-6' } }} />
            <span className="text-sm text-muted-foreground">Account</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white dark:bg-card border-b border-border flex items-center px-4 lg:px-6 gap-4">
          <button
            className="lg:hidden p-2 rounded-md hover:bg-muted"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">AI Orchestrator</span>
            {activeItem && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-medium">{activeItem.label}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Connection status */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <RealtimeProvider>
            {children}
          </RealtimeProvider>
        </main>
      </div>
    </div>
  );
}
