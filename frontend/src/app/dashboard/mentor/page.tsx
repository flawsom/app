'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api, apiPut } from '@/lib/api';
import { Application } from '@/types';
import { FileText, Users, CheckCircle, XCircle, Loader2, Clock, Activity } from 'lucide-react';

export default function MentorDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [applications, setApps] = useState<Application[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [appsData, studentsData] = await Promise.all([
        api('/api/applications'), api('/api/mentor/students'),
      ]);
      setApps(appsData.applications || []);
      setStudents(studentsData.students || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const reviewApp = async (appId: string, approval: string) => {
    try {
      await apiPut(`/api/applications/${appId}/mentor-review`, { approval, comments: reviewComment });
      setReviewComment('');
      await loadData();
    } catch (e: any) { alert(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="flex items-center gap-3"><div className="w-2 h-2 bg-[#00E5FF] rounded-full animate-pulse" /><span className="text-zinc-500 text-xs font-mono">LOADING...</span></div></div>;

  const pendingApps = applications.filter(a => a.mentor_approval_status === 'pending');
  const reviewedApps = applications.filter(a => a.mentor_approval_status !== 'pending');

  const TABS = [
    { id: 'overview', label: 'Command Center', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'approvals', label: `Approvals (${pendingApps.length})`, icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'students', label: 'Students', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <div data-testid="mentor-dashboard" className="space-y-5 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1"><span className="status-dot status-dot-active" /><span className="text-[10px] font-mono text-zinc-600">MENTOR ACTIVE</span></div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{user?.name}</h1>
      </div>

      <div className="flex gap-0.5 border-b border-zinc-800/50 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${tab === t.id ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}
            data-testid={`mentor-tab-${t.id}`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card"><span className="text-[10px] font-mono text-zinc-600">PENDING</span><p className="text-2xl font-bold font-mono text-[#EAB308]">{pendingApps.length}</p></div>
          <div className="card"><span className="text-[10px] font-mono text-zinc-600">APPROVED</span><p className="text-2xl font-bold font-mono text-[#22C55E]">{applications.filter(a => a.mentor_approval_status === 'approved').length}</p></div>
          <div className="card"><span className="text-[10px] font-mono text-zinc-600">REJECTED</span><p className="text-2xl font-bold font-mono text-[#EF4444]">{applications.filter(a => a.mentor_approval_status === 'rejected').length}</p></div>
          <div className="card"><span className="text-[10px] font-mono text-zinc-600">STUDENTS</span><p className="text-2xl font-bold font-mono text-[#00E5FF]">{students.length}</p></div>
        </div>
      )}

      {tab === 'approvals' && (
        <div className="space-y-3">
          {pendingApps.length === 0 ? (
            <p className="text-zinc-700 text-center py-12 font-mono text-xs">NO PENDING APPROVALS</p>
          ) : (
            pendingApps.map(a => (
              <div key={a.id} className="card border-l-2 border-l-[#EAB308]" data-testid={`pending-app-${a.id}`}>
                <div className="mb-2">
                  <h3 className="font-semibold text-sm text-white">{a.student_name} <span className="text-zinc-600">applied for</span> <span className="text-[#00E5FF]">{a.job_title}</span></h3>
                  <p className="text-[10px] text-zinc-600 font-mono mt-1">{a.company_name} / {new Date(a.applied_at).toLocaleDateString()}</p>
                  {a.cover_letter && <p className="text-xs text-zinc-500 mt-2 bg-black p-2 border border-zinc-800 rounded-sm">{a.cover_letter}</p>}
                </div>
                <div className="mt-3 space-y-2">
                  <input value={reviewComment} onChange={e => setReviewComment(e.target.value)} className="input-field" placeholder="Comments (optional)..." data-testid={`review-comment-${a.id}`} />
                  <div className="flex gap-2">
                    <button onClick={() => reviewApp(a.id, 'approved')} className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1.5" data-testid={`approve-${a.id}`}>
                      <CheckCircle className="w-3 h-3" /> APPROVE
                    </button>
                    <button onClick={() => reviewApp(a.id, 'rejected')} className="btn-danger text-[10px] px-3 py-1.5 flex items-center gap-1.5" data-testid={`reject-app-${a.id}`}>
                      <XCircle className="w-3 h-3" /> REJECT
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
          {reviewedApps.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-white mb-3">Previously Reviewed</h3>
              <table className="data-table">
                <thead><tr><th>Student</th><th>Position</th><th>Decision</th><th>Date</th></tr></thead>
                <tbody>
                  {reviewedApps.map(a => (
                    <tr key={a.id}>
                      <td className="text-white">{a.student_name}</td><td>{a.job_title}</td>
                      <td><span className={`text-[10px] px-1.5 py-0.5 font-mono ${a.mentor_approval_status === 'approved' ? 'badge-success' : 'badge-error'}`}>{a.mentor_approval_status.toUpperCase()}</span></td>
                      <td className="text-zinc-600 text-xs font-mono">{new Date(a.applied_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'students' && (
        <div className="space-y-3">
          {students.length === 0 ? (
            <p className="text-zinc-700 text-center py-12 font-mono text-xs">NO STUDENTS ASSIGNED</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {students.map((s, i) => (
                <div key={i} className="card" data-testid={`student-card-${i}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-zinc-800 flex items-center justify-center text-[#00E5FF] font-bold text-xs rounded-sm">
                      {s.user?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-white">{s.user?.name}</h3>
                      <p className="text-[10px] text-zinc-600 font-mono">{s.profile?.department || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-black p-2 border border-zinc-800 rounded-sm"><span className="text-[9px] text-zinc-600 font-mono">APPS</span><p className="font-bold text-white">{s.total_applications}</p></div>
                    <div className="bg-black p-2 border border-zinc-800 rounded-sm"><span className="text-[9px] text-zinc-600 font-mono">PENDING</span><p className="font-bold text-[#EAB308]">{s.pending_approvals}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
