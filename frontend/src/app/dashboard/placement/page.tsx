'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, apiPost } from '@/lib/api';
import { AnalyticsOverview } from '@/types';
import { BarChart3, Users, Briefcase, Award, TrendingUp, Loader2, Download, Mail, Activity } from 'lucide-react';

export default function PlacementDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [placementData, setPlacementData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [digestSending, setDigestSending] = useState(false);
  const [digestResult, setDigestResult] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsData, placementAnalytics, jobsData, usersData] = await Promise.all([
        api('/api/analytics/overview'), api('/api/analytics/placements'),
        api('/api/jobs'), api('/api/users'),
      ]);
      setAnalytics(analyticsData);
      setPlacementData(placementAnalytics);
      setJobs(jobsData.jobs || []);
      setUsers(usersData.users || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const sendDigest = async () => {
    setDigestSending(true);
    setDigestResult('');
    try {
      const data = await apiPost('/api/digest/send', {});
      setDigestResult(data.message || 'Sent!');
    } catch (e: any) { setDigestResult(`Error: ${e.message}`); }
    setDigestSending(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="flex items-center gap-3"><div className="w-2 h-2 bg-[#00E5FF] rounded-full animate-pulse" /><span className="text-zinc-500 text-xs font-mono">LOADING...</span></div></div>;

  const TABS = [
    { id: 'overview', label: 'Analytics', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'jobs', label: 'Job Postings', icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'students', label: 'Students', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <div data-testid="placement-dashboard" className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="status-dot status-dot-active" /><span className="text-[10px] font-mono text-zinc-600">PLACEMENT CELL</span></div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Placement Analytics</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/export/applications`} target="_blank"
            className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1.5 no-underline" data-testid="export-apps-csv">
            <Download className="w-3 h-3" /> EXPORT APPS
          </a>
          <button onClick={sendDigest} disabled={digestSending}
            className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50" data-testid="send-digest-btn">
            {digestSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
            {digestSending ? 'SENDING...' : 'SEND DIGEST'}
          </button>
          {digestResult && <span className="text-[10px] text-zinc-500 font-mono self-center">{digestResult}</span>}
        </div>
      </div>

      <div className="flex gap-0.5 border-b border-zinc-800/50">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all ${tab === t.id ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}
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
                <span className="text-[10px] font-mono text-zinc-600">{s.label}</span>
                <p className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 className="text-xs font-semibold text-white mb-4">Application Pipeline</h3>
            <div className="space-y-2.5">
              {analytics.applications_by_status.map((s, i) => {
                const pct = analytics.total_applications > 0 ? (s.count / analytics.total_applications) * 100 : 0;
                const colors: Record<string, string> = { submitted: '#EAB308', under_review: '#3B82F6', shortlisted: '#00E5FF', selected: '#22C55E', rejected: '#EF4444' };
                return (
                  <div key={i} className="flex items-center gap-3" data-testid={`pipeline-${s.status}`}>
                    <span className="text-xs w-24 capitalize text-zinc-400 font-mono">{s.status.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-4 bg-zinc-900 relative overflow-hidden rounded-sm">
                      <div className="h-full transition-all duration-700 rounded-sm" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: colors[s.status] || '#00E5FF' }} />
                    </div>
                    <span className="text-xs font-mono text-zinc-400 w-8 text-right">{s.count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {placementData?.job_type_distribution && (
            <div className="card">
              <h3 className="text-xs font-semibold text-white mb-4">Job Type Distribution</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(placementData.job_type_distribution).map(([type, count]: any) => (
                  <div key={type} className="bg-black p-3 border border-zinc-800 text-center rounded-sm">
                    <p className="text-xl font-bold font-mono text-[#00E5FF]">{count}</p>
                    <p className="text-[10px] text-zinc-500 capitalize mt-1 font-mono">{type}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'jobs' && (
        <div>
          {jobs.length === 0 ? <p className="text-zinc-700 text-center py-12 font-mono text-xs">NO JOB POSTINGS</p> : (
            <table className="data-table" data-testid="placement-jobs-table">
              <thead><tr><th>Title</th><th>Company</th><th>Type</th><th>Status</th><th>Applicants</th></tr></thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id}>
                    <td className="font-medium text-white">{j.title}</td><td>{j.company_name}</td>
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
          {users.filter(u => u.role === 'student').length === 0 ? <p className="text-zinc-700 text-center py-12 font-mono text-xs">NO STUDENTS</p> : (
            <table className="data-table" data-testid="placement-students-table">
              <thead><tr><th>Name</th><th>Email</th><th>Active</th><th>Joined</th></tr></thead>
              <tbody>
                {users.filter(u => u.role === 'student').map(u => (
                  <tr key={u.id}>
                    <td className="font-medium text-white">{u.name}</td>
                    <td className="text-zinc-500 text-xs font-mono">{u.email}</td>
                    <td><span className={`text-[10px] px-1.5 py-0.5 font-mono ${u.is_active ? 'badge-success' : 'badge-error'}`}>{u.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                    <td className="text-zinc-600 text-xs font-mono">{new Date(u.created_at).toLocaleDateString()}</td>
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
