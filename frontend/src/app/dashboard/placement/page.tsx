'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, apiPost } from '@/lib/api';
import { AnalyticsOverview } from '@/types';
import { BarChart3, Users, Briefcase, Award, TrendingUp, Loader2, Download, Mail, Activity, PieChart, Brain } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

const CHART_COLORS = ['#00E5FF', '#22C55E', '#EAB308', '#A855F7', '#EF4444', '#3B82F6'];

export default function PlacementDashboard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const rtr = useRouter();
  const tab = searchParams.get('tab') || 'overview';
  const setTab = (t: string) => rtr.push(t === 'overview' ? '/dashboard/placement' : `/dashboard/placement?tab=${t}`);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [charts, setCharts] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [digestSending, setDigestSending] = useState(false);
  const [digestResult, setDigestResult] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsData, chartsData, jobsData, usersData, healthData] = await Promise.all([
        api('/api/analytics/overview'),
        api('/api/analytics/charts').catch(() => null),
        api('/api/jobs'),
        api('/api/users'),
        api('/api/system-health').catch(() => null),
      ]);
      setAnalytics(analyticsData);
      setCharts(chartsData);
      setJobs(jobsData.jobs || []);
      setUsers(usersData.users || []);
      if (healthData) setSystemHealth(healthData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const sendDigest = async () => {
    setDigestSending(true); setDigestResult('');
    try { const d = await apiPost('/api/digest/send', {}); setDigestResult(d.message || 'Sent!'); }
    catch (e: any) { setDigestResult(`Error: ${e.message}`); }
    setDigestSending(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="flex items-center gap-3"><div className="w-2 h-2 bg-[#00E5FF] rounded-full animate-pulse" /><span className="text-[var(--text-muted)] text-xs font-mono">LOADING...</span></div></div>;

  const TABS = [
    { id: 'overview', label: 'Analytics', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'analytics', label: 'Charts', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'jobs', label: 'Job Postings', icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'students', label: 'Students', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <div data-testid="placement-dashboard" className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="status-dot status-dot-active" /><span className="text-[10px] font-mono text-[var(--text-muted)]">PLACEMENT CELL</span></div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Placement Analytics</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/export/applications`} target="_blank"
            className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1.5 no-underline" data-testid="export-apps-csv">
            <Download className="w-3 h-3" /> EXPORT CSV
          </a>
          <button onClick={sendDigest} disabled={digestSending}
            className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50" data-testid="send-digest-btn">
            {digestSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
            {digestSending ? 'SENDING...' : 'SEND DIGEST'}
          </button>
          {digestResult && <span className="text-[10px] text-[var(--text-muted)] font-mono self-center">{digestResult}</span>}
        </div>
      </div>

      <div className="flex gap-0.5 border-b overflow-x-auto" style={{ borderColor: 'var(--border-subtle)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${tab === t.id ? 'border-[var(--cyan)] text-[var(--cyan)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}
            data-testid={`placement-tab-${t.id}`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === 'overview' && analytics && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'STUDENTS', value: analytics.total_students, color: '#A855F7' },
              { label: 'EMPLOYERS', value: analytics.total_employers, color: '#22C55E' },
              { label: 'ACTIVE JOBS', value: analytics.active_jobs, color: '#00E5FF' },
              { label: 'APPLICATIONS', value: analytics.total_applications, color: '#EAB308' },
              { label: 'PLACEMENT %', value: `${analytics.placement_rate}%`, color: '#22C55E' },
              { label: 'CERTIFICATES', value: analytics.total_certificates, color: '#3B82F6' },
            ].map((s, i) => (
              <div key={i} className="card" data-testid={`analytics-${s.label.toLowerCase().replace(/[\s%]/g, '-')}`}>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">{s.label}</span>
                <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {systemHealth && (
            <div className="card" data-testid="system-health-panel">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[var(--cyan)]" />
                  <h3 className="text-xs font-semibold">Self-Learning Model</h3>
                </div>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-sm ${systemHealth.status === 'healthy' ? 'badge-success' : 'badge-warning'}`}>{systemHealth.status.toUpperCase()}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><span className="text-[9px] font-mono text-[var(--text-muted)]">MODEL VERSION</span><p className="text-lg font-bold font-mono text-[var(--cyan)]">v{systemHealth.model?.version || 0}</p></div>
                <div><span className="text-[9px] font-mono text-[var(--text-muted)]">OUTCOMES</span><p className="text-lg font-bold font-mono">{systemHealth.model?.outcomes_processed || 0}</p></div>
                <div><span className="text-[9px] font-mono text-[var(--text-muted)]">LEARNING RATE</span><p className="text-lg font-bold font-mono">{(systemHealth.model?.learning_rate || 0).toFixed(4)}</p></div>
                <div><span className="text-[9px] font-mono text-[var(--text-muted)]">CONVERSION</span><p className="text-lg font-bold font-mono text-[#22C55E]">{((systemHealth.metrics?.conversion_rate || 0) * 100).toFixed(1)}%</p></div>
              </div>
              {systemHealth.issues?.length > 0 && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  {systemHealth.issues.map((iss: any, i: number) => (
                    <p key={i} className="text-[10px] text-[#EAB308] font-mono">{iss.issue}: {iss.action}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'analytics' && charts && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly Applications Bar Chart */}
            <div className="card" data-testid="monthly-chart">
              <h3 className="text-xs font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5 text-[var(--cyan)]" /> Monthly Applications</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={charts.monthly}>
                  <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 4, fontSize: 11 }} />
                  <Bar dataKey="applications" fill="#00E5FF" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="selected" fill="#22C55E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Status Donut Chart */}
            <div className="card" data-testid="status-donut">
              <h3 className="text-xs font-semibold mb-4 flex items-center gap-2"><PieChart className="w-3.5 h-3.5 text-[#A855F7]" /> Application Status</h3>
              {charts.status_donut.length === 0 ? (
                <p className="text-[var(--text-muted)] text-xs text-center py-8 font-mono">NO DATA YET</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPie>
                    <Pie data={charts.status_donut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} label={({ name, value }: any) => `${name}: ${value}`} labelLine={false}>
                      {charts.status_donut.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: 4, fontSize: 11 }} />
                  </RechartsPie>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Skills Demand Radar */}
          <div className="card" data-testid="skill-demand-chart">
            <h3 className="text-xs font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5 text-[#EAB308]" /> Top Skills in Demand</h3>
            {charts.skill_demand.length === 0 ? (
              <p className="text-[var(--text-muted)] text-xs text-center py-8 font-mono">NO SKILLS DATA YET</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={charts.skill_demand.slice(0, 8)}>
                    <PolarGrid stroke="#333" />
                    <PolarAngleAxis dataKey="skill" tick={{ fill: '#888', fontSize: 9 }} />
                    <Radar dataKey="demand" stroke="#00E5FF" fill="#00E5FF" fillOpacity={0.15} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {charts.skill_demand.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-5 h-5 flex items-center justify-center text-[9px] font-bold font-mono rounded-sm" style={{ background: `${CHART_COLORS[i % CHART_COLORS.length]}20`, color: CHART_COLORS[i % CHART_COLORS.length] }}>{i + 1}</span>
                      <div className="flex-1"><span className="text-xs">{s.skill}</span></div>
                      <div className="w-20 h-1.5 bg-[var(--bg-elevated)] rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm" style={{ width: `${(s.demand / Math.max(...charts.skill_demand.map((x: any) => x.demand), 1)) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      </div>
                      <span className="text-xs font-mono text-[var(--text-muted)] w-6 text-right">{s.demand}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'jobs' && (
        <div>
          {jobs.length === 0 ? <p className="text-[var(--text-muted)] text-center py-12 font-mono text-xs">NO JOB POSTINGS</p> : (
            <table className="data-table" data-testid="placement-jobs-table">
              <thead><tr><th>Title</th><th>Company</th><th>Type</th><th>Status</th><th>Applicants</th></tr></thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id}>
                    <td className="font-medium">{j.title}</td><td>{j.company_name}</td>
                    <td className="capitalize font-mono">{j.job_type}</td>
                    <td><span className={`text-[10px] px-1.5 py-0.5 font-mono ${j.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{j.status.toUpperCase()}</span></td>
                    <td className="font-mono">{j.application_count || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'students' && (
        <div>
          {users.filter(u => u.role === 'student').length === 0 ? <p className="text-[var(--text-muted)] text-center py-12 font-mono text-xs">NO STUDENTS</p> : (
            <table className="data-table" data-testid="placement-students-table">
              <thead><tr><th>Name</th><th>Email</th><th>Active</th><th>Joined</th></tr></thead>
              <tbody>
                {users.filter(u => u.role === 'student').map(u => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.name}</td>
                    <td className="text-[var(--text-muted)] text-xs font-mono">{u.email}</td>
                    <td><span className={`text-[10px] px-1.5 py-0.5 font-mono ${u.is_active ? 'badge-success' : 'badge-error'}`}>{u.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                    <td className="text-[var(--text-muted)] text-xs font-mono">{new Date(u.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
