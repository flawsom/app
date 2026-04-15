'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, apiPut, apiDelete, apiPost } from '@/lib/api';
import { Users, Settings, Shield, Loader2, Trash2, Download, Activity, Database } from 'lucide-react';

export default function AdminDashboard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const rtr = useRouter();
  const tab = searchParams.get('tab') || 'overview';
  const setTab = (t: string) => rtr.push(t === 'overview' ? '/dashboard/admin' : `/dashboard/admin?tab=${t}`);
  const [users, setUsers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [seeding, setSeeding] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersData, analyticsData] = await Promise.all([api('/api/users'), api('/api/analytics/overview')]);
      setUsers(usersData.users || []);
      setAnalytics(analyticsData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const updateUserRole = async (userId: string, role: string) => { try { await apiPut(`/api/users/${userId}`, { role }); await loadData(); } catch (e: any) { alert(e.message); } };
  const toggleUserActive = async (userId: string, active: boolean) => { try { await apiPut(`/api/users/${userId}`, { is_active: active }); await loadData(); } catch (e: any) { alert(e.message); } };
  const deleteUser = async (userId: string) => { if (!confirm('Delete this user?')) return; try { await apiDelete(`/api/users/${userId}`); await loadData(); } catch (e: any) { alert(e.message); } };
  const seedDemo = async () => { setSeeding(true); try { const res = await apiPost('/api/seed/demo', {}); alert(res.message); await loadData(); } catch (e: any) { alert(e.message); } setSeeding(false); };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="flex items-center gap-3"><div className="w-2 h-2 bg-[#00E5FF] rounded-full animate-pulse" /><span className="text-zinc-500 text-xs font-mono">LOADING...</span></div></div>;

  const filteredUsers = roleFilter ? users.filter(u => u.role === roleFilter) : users;

  const TABS = [
    { id: 'overview', label: 'System Overview', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'users', label: 'User Management', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  return (
    <div data-testid="admin-dashboard" className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="status-dot status-dot-active" /><span className="text-[10px] font-mono text-zinc-600">ADMIN</span></div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">System Admin</h1>
        </div>
        <div className="flex gap-2">
          <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/export/applications`} target="_blank"
            className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1.5 no-underline" data-testid="admin-export-apps">
            <Download className="w-3 h-3" /> EXPORT
          </a>
        </div>
      </div>

      <div className="flex gap-0.5 border-b border-zinc-800/50">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all ${tab === t.id ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}
            data-testid={`admin-tab-${t.id}`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === 'overview' && analytics && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'USERS', value: analytics.total_users, color: '#00E5FF' },
              { label: 'STUDENTS', value: analytics.total_students, color: '#A855F7' },
              { label: 'EMPLOYERS', value: analytics.total_employers, color: '#22C55E' },
              { label: 'MENTORS', value: analytics.total_mentors, color: '#EAB308' },
              { label: 'JOBS', value: analytics.total_jobs, color: '#3B82F6' },
            ].map((s, i) => (
              <div key={i} className="card" data-testid={`admin-stat-${i}`}>
                <span className="text-[10px] font-mono text-zinc-600">{s.label}</span>
                <p className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 className="text-xs font-semibold text-white mb-4">Role Distribution</h3>
            <div className="grid grid-cols-5 gap-2">
              {['student', 'mentor', 'employer', 'placement', 'admin'].map(role => {
                const count = users.filter(u => u.role === role).length;
                const pct = users.length > 0 ? (count / users.length) * 100 : 0;
                return (
                  <div key={role} className="text-center">
                    <div className="h-24 bg-black border border-zinc-800 relative flex items-end overflow-hidden mb-1.5 rounded-sm">
                      <div className="w-full bg-[#00E5FF] transition-all duration-700" style={{ height: `${pct}%` }} />
                    </div>
                    <p className="text-[9px] capitalize text-zinc-500 font-mono">{role}</p>
                    <p className="text-xs font-bold text-white">{count}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card"><span className="text-[10px] font-mono text-zinc-600">PLACEMENT RATE</span><p className="text-2xl font-bold font-mono text-[#22C55E]">{analytics.placement_rate}%</p></div>
            <div className="card"><span className="text-[10px] font-mono text-zinc-600">APPLICATIONS</span><p className="text-2xl font-bold font-mono text-[#00E5FF]">{analytics.total_applications}</p></div>
            <div className="card"><span className="text-[10px] font-mono text-zinc-600">SELECTED</span><p className="text-2xl font-bold font-mono text-[#22C55E]">{analytics.selected}</p></div>
            <div className="card"><span className="text-[10px] font-mono text-zinc-600">CERTIFICATES</span><p className="text-2xl font-bold font-mono text-[#A855F7]">{analytics.total_certificates}</p></div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {['', 'student', 'mentor', 'employer', 'placement', 'admin'].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`text-[10px] px-2.5 py-1 transition-colors rounded-sm ${roleFilter === r ? 'bg-[#00E5FF] text-black' : 'border border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}
                data-testid={`filter-${r || 'all'}`}>
                {r ? r.charAt(0).toUpperCase() + r.slice(1) : 'All'}
              </button>
            ))}
          </div>
          <table className="data-table" data-testid="admin-users-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} data-testid={`user-row-${u.id}`}>
                  <td className="font-medium text-white">{u.name}</td>
                  <td className="text-zinc-500 text-xs font-mono">{u.email}</td>
                  <td>
                    <select value={u.role} onChange={e => updateUserRole(u.id, e.target.value)}
                      className="text-[10px] bg-black border border-zinc-800 px-1.5 py-0.5 text-white rounded-sm" data-testid={`role-select-${u.id}`}>
                      <option value="student">Student</option><option value="mentor">Mentor</option>
                      <option value="employer">Employer</option><option value="placement">Placement</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={() => toggleUserActive(u.id, !u.is_active)}
                      className={`text-[10px] px-1.5 py-0.5 font-mono ${u.is_active ? 'badge-success' : 'badge-error'}`}
                      data-testid={`toggle-active-${u.id}`}>{u.is_active ? 'ACTIVE' : 'INACTIVE'}</button>
                  </td>
                  <td className="text-zinc-600 text-xs font-mono">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => deleteUser(u.id)} className="text-red-500/60 hover:text-red-400 p-1" data-testid={`delete-user-${u.id}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'settings' && (
        <div className="card max-w-lg space-y-2">
          <h3 className="text-xs font-semibold text-white mb-3">System Configuration</h3>
          {[
            { label: 'RBAC Enforcement', sub: 'Role-based access control', active: true },
            { label: 'AI Engine (GPT-5.2)', sub: 'OpenAI-powered recommendations', active: true },
            { label: 'Certificate Verification', sub: 'SHA256 blockchain hashing', active: true },
            { label: 'WebSocket Real-time', sub: 'Live updates and notifications', active: true },
            { label: 'Behavior Tracking', sub: 'Adaptive UI feedback engine', active: true },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 bg-black border border-zinc-800 rounded-sm">
              <div><p className="text-xs font-medium text-white">{item.label}</p><p className="text-[9px] text-zinc-600 font-mono">{item.sub}</p></div>
              <span className="badge-success text-[9px] px-1.5 py-0.5 font-mono">ACTIVE</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
