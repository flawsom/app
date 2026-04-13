'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, apiPost } from '@/lib/api';
import { Notification } from '@/types';
import {
  Briefcase, FileText, Award, Users, BarChart3,
  Settings, LogOut, Bell, GraduationCap, Building2, Menu, X, Zap, Activity,
  Target, TrendingUp, Medal
} from 'lucide-react';
import ChatBot from '@/components/ChatBot';

const ROLE_NAV: Record<string, { label: string; icon: React.ReactNode; href: string }[]> = {
  student: [
    { label: 'Command Center', icon: <Activity className="w-4 h-4" />, href: '/dashboard/student' },
    { label: 'Match Engine', icon: <Target className="w-4 h-4" />, href: '/dashboard/student?tab=jobs' },
    { label: 'Applications', icon: <FileText className="w-4 h-4" />, href: '/dashboard/student?tab=applications' },
    { label: 'Leaderboard', icon: <Medal className="w-4 h-4" />, href: '/dashboard/student?tab=leaderboard' },
    { label: 'Certificates', icon: <Award className="w-4 h-4" />, href: '/dashboard/student?tab=certificates' },
    { label: 'Momentum', icon: <Zap className="w-4 h-4" />, href: '/dashboard/student?tab=momentum' },
  ],
  mentor: [
    { label: 'Command Center', icon: <Activity className="w-4 h-4" />, href: '/dashboard/mentor' },
    { label: 'Approvals', icon: <FileText className="w-4 h-4" />, href: '/dashboard/mentor?tab=approvals' },
    { label: 'Students', icon: <Users className="w-4 h-4" />, href: '/dashboard/mentor?tab=students' },
  ],
  employer: [
    { label: 'Command Center', icon: <Activity className="w-4 h-4" />, href: '/dashboard/employer' },
    { label: 'Job Postings', icon: <Briefcase className="w-4 h-4" />, href: '/dashboard/employer?tab=jobs' },
    { label: 'Applicants', icon: <Users className="w-4 h-4" />, href: '/dashboard/employer?tab=applicants' },
  ],
  placement: [
    { label: 'Command Center', icon: <Activity className="w-4 h-4" />, href: '/dashboard/placement' },
    { label: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, href: '/dashboard/placement?tab=analytics' },
    { label: 'Jobs', icon: <Briefcase className="w-4 h-4" />, href: '/dashboard/placement?tab=jobs' },
    { label: 'Students', icon: <Users className="w-4 h-4" />, href: '/dashboard/placement?tab=students' },
  ],
  admin: [
    { label: 'Command Center', icon: <Activity className="w-4 h-4" />, href: '/dashboard/admin' },
    { label: 'Users', icon: <Users className="w-4 h-4" />, href: '/dashboard/admin?tab=users' },
    { label: 'Settings', icon: <Settings className="w-4 h-4" />, href: '/dashboard/admin?tab=settings' },
  ],
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  student: <GraduationCap className="w-3.5 h-3.5" />,
  mentor: <Users className="w-3.5 h-3.5" />,
  employer: <Building2 className="w-3.5 h-3.5" />,
  placement: <BarChart3 className="w-3.5 h-3.5" />,
  admin: <Settings className="w-3.5 h-3.5" />,
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (user === false) router.push('/login');
  }, [user, router]);

  useEffect(() => {
    if (!user || user === false || user === null) return;
    const fetchNotifs = async () => {
      try {
        const data = await api('/api/notifications');
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user || user === false || user === null) return;
    apiPost('/api/behavior/track', { event_type: 'page_view', target: pathname }).catch(() => {});
  }, [pathname, user]);

  if (!user || user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-void)' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--cyan)', boxShadow: '0 0 12px var(--cyan-glow)' }} />
          <span className="text-[var(--text-muted)] text-xs font-mono tracking-wider">INITIALIZING...</span>
        </div>
      </div>
    );
  }
  if (user === false) return null;

  const navItems = ROLE_NAV[user.role] || [];

  const handleLogout = async () => { await logout(); router.push('/'); };

  const markAllRead = async () => {
    try {
      await api('/api/notifications/read-all', { method: 'PUT' });
      setNotifications(n => n.map(x => ({ ...x, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-void)' }} data-testid="dashboard-layout">
      {/* ═══ SIDEBAR ═══ */}
      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-56 glass-strong flex flex-col transition-transform duration-500 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`} data-testid="dashboard-sidebar">
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/')}>
            <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <span className="text-black font-bold text-[10px]">U</span>
            </div>
            <span className="font-bold text-sm tracking-tight">UNIFY</span>
          </div>
          <button className="lg:hidden text-[var(--text-muted)]" onClick={() => setSidebarOpen(false)}><X className="w-4 h-4" /></button>
        </div>

        <div className="px-4 pt-5 pb-2">
          <div className="flex items-center gap-2 px-1">
            <span className="status-dot status-dot-active" />
            <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">{user.role}</span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => {
            const baseHref = item.href.split('?')[0];
            const isActive = pathname === baseHref && !item.href.includes('?');
            return (
              <button key={item.href} onClick={() => { router.push(item.href); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs transition-all duration-300 rounded-md group ${isActive ? 'glass text-[var(--cyan)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-white/[0.02]'}`}
                style={isActive ? { boxShadow: '0 0 15px rgba(0,229,255,0.08), inset 0 0 15px rgba(0,229,255,0.03)' } : {}}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}>
                <span className={`transition-all duration-300 ${isActive ? 'text-[var(--cyan)]' : 'group-hover:text-[var(--text-secondary)]'}`}>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/5 transition-all duration-300 rounded-md" data-testid="nav-logout">
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-20 glass-strong h-14 flex items-center px-4 md:px-6 justify-between" data-testid="dashboard-header">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-[var(--text-muted)]" onClick={() => setSidebarOpen(true)} data-testid="mobile-menu-btn">
              <Menu className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2.5 text-[10px] text-[var(--text-muted)] font-mono tracking-wider">
              {ROLE_ICONS[user.role]}
              <span className="uppercase">{user.role}</span>
              <span className="text-[var(--cyan)]">/</span>
              <span>ACTIVE</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button onClick={() => setShowNotifs(!showNotifs)} className="relative p-2 hover:bg-white/[0.03] transition-colors rounded-md" data-testid="notif-bell">
                <Bell className="w-4 h-4 text-[var(--text-muted)]" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[8px] font-bold text-black rounded-full" style={{ background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan-glow)' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-80 glass-strong rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto" data-testid="notif-panel">
                  <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <span className="font-bold text-xs">Notifications</span>
                    {unreadCount > 0 && <button onClick={markAllRead} className="text-[9px] font-mono text-[var(--cyan)] hover:underline tracking-wider">CLEAR ALL</button>}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-6 text-xs text-[var(--text-muted)] text-center font-mono">NO SIGNALS</div>
                  ) : (
                    notifications.slice(0, 8).map(n => (
                      <div key={n.id} className={`px-4 py-3 border-b text-xs transition-colors ${!n.read ? 'bg-[var(--cyan)]/[0.03]' : ''}`} style={{ borderColor: 'rgba(255,255,255,0.02)' }}>
                        <p className="font-medium text-[var(--text-primary)]">{n.title}</p>
                        <p className="text-[var(--text-muted)] text-[10px] mt-0.5">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {/* User Avatar */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--cyan)' }}>
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="hidden sm:inline text-xs font-medium text-[var(--text-secondary)]">{user.name}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
        <ChatBot />
      </div>
    </div>
  );
}
