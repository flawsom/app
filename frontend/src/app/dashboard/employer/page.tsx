'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, apiPost, apiPut } from '@/lib/api';
import { Job, Application } from '@/types';
import { Briefcase, Users, Plus, Loader2, X, MessageSquare, Calendar, Activity, Brain, Target } from 'lucide-react';

interface BestCandidate {
  user_id: string; name: string; email: string; department: string;
  skills: string[]; hire_probability: number; reason: string;
  application_id: string; job_id: string; job_title: string; status: string;
  factors: { skills: number; experience: number; competition: number; profile: number; timing: number };
}

export default function EmployerDashboard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab') || 'overview';
  const setTab = (t: string) => router.push(t === 'overview' ? '/dashboard/employer' : `/dashboard/employer?tab=${t}`);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApps] = useState<Application[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{ appId: string; studentName: string } | null>(null);
  const [interviewModal, setInterviewModal] = useState<{ appId: string; studentName: string; jobTitle: string } | null>(null);
  const [feedback, setFeedback] = useState({ feedback: '', rating: 5 });
  const [interviewForm, setInterviewForm] = useState({ scheduled_date: '', interview_type: 'video', duration_minutes: 60, meeting_link: '' });
  const [bestCandidates, setBestCandidates] = useState<BestCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [nextAction, setNextAction] = useState<any>(null);
  const [jobForm, setJobForm] = useState({
    title: '', description: '', job_type: 'internship', location: '', is_remote: false,
    stipend_min: 0, stipend_max: 0, duration_months: 3, required_skills: '', status: 'active'
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profData, jobsData, appsData] = await Promise.all([api('/api/profile'), api('/api/jobs'), api('/api/applications')]);
      setProfile(profData.profile);
      setJobs(jobsData.jobs || []);
      setApps(appsData.applications || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const loadBestCandidates = async () => {
    setCandidatesLoading(true);
    try {
      const data = await api('/api/employer/best-candidates');
      setBestCandidates(data.candidates || []);
    } catch {}
    setCandidatesLoading(false);
  };

  useEffect(() => {
    api('/api/next-action').then(d => setNextAction(d)).catch(() => {});
  }, []);

  const createJob = async () => {
    try {
      await apiPost('/api/jobs', { ...jobForm, required_skills: jobForm.required_skills.split(',').map(s => s.trim()).filter(Boolean), stipend_min: Number(jobForm.stipend_min), stipend_max: Number(jobForm.stipend_max), duration_months: Number(jobForm.duration_months) });
      setShowCreateJob(false);
      setJobForm({ title: '', description: '', job_type: 'internship', location: '', is_remote: false, stipend_min: 0, stipend_max: 0, duration_months: 3, required_skills: '', status: 'active' });
      await loadData();
    } catch (e: any) { alert(e.message); }
  };

  const updateAppStatus = async (appId: string, status: string) => { try { await apiPut(`/api/applications/${appId}/status`, { status }); await loadData(); } catch (e: any) { alert(e.message); } };
  const submitFeedback = async () => { if (!feedbackModal) return; try { await apiPut(`/api/applications/${feedbackModal.appId}/feedback`, feedback); setFeedbackModal(null); setFeedback({ feedback: '', rating: 5 }); await loadData(); } catch (e: any) { alert(e.message); } };
  const scheduleInterview = async () => { if (!interviewModal) return; try { await apiPost('/api/interviews', { application_id: interviewModal.appId, ...interviewForm }); setInterviewModal(null); setInterviewForm({ scheduled_date: '', interview_type: 'video', duration_minutes: 60, meeting_link: '' }); await loadData(); } catch (e: any) { alert(e.message); } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="flex items-center gap-3"><div className="w-2 h-2 bg-[#00E5FF] rounded-full animate-pulse" /><span className="text-zinc-500 text-xs font-mono">LOADING...</span></div></div>;

  const TABS = [
    { id: 'overview', label: 'Command Center', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'candidates', label: 'Best Candidates', icon: <Brain className="w-3.5 h-3.5" /> },
    { id: 'jobs', label: 'Job Postings', icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'applicants', label: 'Applicants', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <div data-testid="employer-dashboard" className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="status-dot status-dot-active" /><span className="text-[10px] font-mono text-zinc-600">EMPLOYER</span></div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{profile?.company_name || user?.name}</h1>
        </div>
        <button onClick={() => setShowCreateJob(true)} className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1.5" data-testid="create-job-btn">
          <Plus className="w-3 h-3" /> POST JOB
        </button>
      </div>

      <div className="flex gap-0.5 border-b border-zinc-800/50">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-all ${tab === t.id ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}
            data-testid={`employer-tab-${t.id}`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Next Action */}
          {nextAction && (
            <div className="card-glow" data-testid="employer-next-action">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-[10px] font-mono text-[#00E5FF]">NEXT ACTION</span>
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${nextAction.urgency === 'HIGH' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>{nextAction.urgency}</span>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">{nextAction.next_action}</h2>
              <p className="text-xs text-zinc-400">{nextAction.reason}</p>
              <p className="text-sm font-semibold text-[#00E5FF] mt-1">{nextAction.impact}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card"><span className="text-[10px] font-mono text-zinc-600">ACTIVE JOBS</span><p className="text-2xl font-bold font-mono text-[#00E5FF]">{jobs.filter(j => j.status === 'active').length}</p></div>
            <div className="card"><span className="text-[10px] font-mono text-zinc-600">APPLICANTS</span><p className="text-2xl font-bold font-mono text-[#EAB308]">{applications.length}</p></div>
            <div className="card"><span className="text-[10px] font-mono text-zinc-600">SELECTED</span><p className="text-2xl font-bold font-mono text-[#22C55E]">{applications.filter(a => a.status === 'selected').length}</p></div>
          </div>
        </div>
      )}

      {/* Best Candidates - AI Ranked */}
      {tab === 'candidates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h2 className="text-sm font-semibold text-white flex items-center gap-2"><Brain className="w-4 h-4 text-[#00E5FF]" /> AI-Ranked Candidates</h2><p className="text-[10px] text-zinc-600 font-mono mt-1">CANDIDATES SORTED BY HIRE PROBABILITY</p></div>
            <button onClick={loadBestCandidates} disabled={candidatesLoading} className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50" data-testid="load-candidates-btn">
              {candidatesLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
              {candidatesLoading ? 'RANKING...' : 'RANK CANDIDATES'}
            </button>
          </div>
          {bestCandidates.length === 0 && !candidatesLoading ? (
            <div className="card text-center py-10"><Brain className="w-8 h-8 text-zinc-700 mx-auto mb-2" /><p className="text-zinc-600 text-xs font-mono">CLICK RANK CANDIDATES TO SEE AI-POWERED RANKINGS</p></div>
          ) : (
            <div className="space-y-2">
              {bestCandidates.map((c, i) => (
                <div key={c.user_id + c.job_id} className="card hover:border-[#00E5FF]/30 transition-all" data-testid={`candidate-${i}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-white">{c.name}</h3>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 ${c.status === 'selected' ? 'badge-success' : c.status === 'shortlisted' ? 'badge-info' : 'badge-warning'}`}>{c.status.replace(/_/g,' ').toUpperCase()}</span>
                      </div>
                      <p className="text-xs text-zinc-500">{c.department} / {c.job_title}</p>
                      <p className="text-[10px] text-zinc-600 mt-1 font-mono">{c.reason}</p>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {c.skills.slice(0, 5).map(s => <span key={s} className="text-[10px] bg-zinc-800 px-1.5 py-0.5 text-zinc-400 font-mono">{s}</span>)}
                      </div>
                    </div>
                    <div className="text-center shrink-0">
                      <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center" style={{ borderColor: c.hire_probability > 0.6 ? '#22C55E' : c.hire_probability > 0.3 ? '#EAB308' : '#EF4444' }}>
                        <span className="text-lg font-bold font-mono" style={{ color: c.hire_probability > 0.6 ? '#22C55E' : c.hire_probability > 0.3 ? '#EAB308' : '#EF4444' }}>{Math.round(c.hire_probability * 100)}%</span>
                      </div>
                      <span className="text-[8px] font-mono text-zinc-600 mt-1 block">HIRE PROB</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="space-y-3">
          {jobs.length === 0 ? <p className="text-zinc-700 text-center py-12 font-mono text-xs">NO JOB POSTINGS</p> : (
            jobs.map(j => (
              <div key={j.id} className="card flex items-start justify-between" data-testid={`emp-job-${j.id}`}>
                <div>
                  <h3 className="font-semibold text-sm text-white">{j.title}</h3>
                  <p className="text-[10px] text-zinc-500 font-mono mt-1">{j.job_type} / {j.location || 'Remote'} / {j.duration_months}mo</p>
                  <p className="text-[10px] text-zinc-600 mt-1 font-mono">{j.application_count || 0} applicants</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 font-mono ${j.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{j.status.toUpperCase()}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'applicants' && (
        <div>
          {applications.length === 0 ? <p className="text-zinc-700 text-center py-12 font-mono text-xs">NO APPLICANTS</p> : (
            <table className="data-table" data-testid="employer-applicants-table">
              <thead><tr><th>Student</th><th>Position</th><th>Status</th><th>Mentor</th><th>Actions</th></tr></thead>
              <tbody>
                {applications.map(a => (
                  <tr key={a.id} data-testid={`applicant-row-${a.id}`}>
                    <td className="text-white">{a.student_name}</td><td>{a.job_title}</td>
                    <td><span className={`text-[10px] px-1.5 py-0.5 font-mono ${a.status === 'selected' ? 'badge-success' : a.status === 'rejected' ? 'badge-error' : 'badge-warning'}`}>{a.status.replace(/_/g,' ').toUpperCase()}</span></td>
                    <td><span className={`text-[10px] px-1.5 py-0.5 font-mono ${a.mentor_approval_status === 'approved' ? 'badge-success' : 'badge-warning'}`}>{a.mentor_approval_status.toUpperCase()}</span></td>
                    <td className="flex gap-1.5">
                      {a.status === 'submitted' && a.mentor_approval_status === 'approved' && (
                        <>
                          <button onClick={() => updateAppStatus(a.id, 'shortlisted')} className="btn-primary text-[10px] px-2 py-1" data-testid={`shortlist-${a.id}`}>SHORTLIST</button>
                          <button onClick={() => updateAppStatus(a.id, 'rejected')} className="btn-danger text-[10px] px-2 py-1" data-testid={`reject-${a.id}`}>REJECT</button>
                        </>
                      )}
                      {a.status === 'shortlisted' && (
                        <>
                          <button onClick={() => updateAppStatus(a.id, 'selected')} className="btn-primary text-[10px] px-2 py-1" data-testid={`select-${a.id}`}>SELECT</button>
                          <button onClick={() => setInterviewModal({ appId: a.id, studentName: a.student_name || '', jobTitle: a.job_title || '' })} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1" data-testid={`schedule-${a.id}`}><Calendar className="w-2.5 h-2.5" /> INTERVIEW</button>
                        </>
                      )}
                      {a.status === 'selected' && !a.employer_feedback && (
                        <button onClick={() => setFeedbackModal({ appId: a.id, studentName: a.student_name || '' })} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1" data-testid={`feedback-${a.id}`}><MessageSquare className="w-2.5 h-2.5" /> FEEDBACK</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Create Job Modal */}
      {showCreateJob && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="create-job-modal">
          <div className="bg-[#0F0F12] border border-zinc-800 w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 rounded-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Post New Job</h2>
              <button onClick={() => setShowCreateJob(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">TITLE</label><input value={jobForm.title} onChange={e => setJobForm(f => ({ ...f, title: e.target.value }))} className="input-field" data-testid="job-title-input" /></div>
              <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">DESCRIPTION</label><textarea value={jobForm.description} onChange={e => setJobForm(f => ({ ...f, description: e.target.value }))} className="input-field h-20 resize-none" data-testid="job-desc-input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">TYPE</label>
                  <select value={jobForm.job_type} onChange={e => setJobForm(f => ({ ...f, job_type: e.target.value }))} className="input-field" data-testid="job-type-select">
                    <option value="internship">Internship</option><option value="training">Training</option><option value="placement">Placement</option><option value="project">Project</option>
                  </select></div>
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">LOCATION</label><input value={jobForm.location} onChange={e => setJobForm(f => ({ ...f, location: e.target.value }))} className="input-field" data-testid="job-location-input" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">MIN STIPEND</label><input type="number" value={jobForm.stipend_min} onChange={e => setJobForm(f => ({ ...f, stipend_min: Number(e.target.value) }))} className="input-field font-mono" data-testid="job-stipend-min" /></div>
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">MAX STIPEND</label><input type="number" value={jobForm.stipend_max} onChange={e => setJobForm(f => ({ ...f, stipend_max: Number(e.target.value) }))} className="input-field font-mono" data-testid="job-stipend-max" /></div>
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">DURATION (MO)</label><input type="number" value={jobForm.duration_months} onChange={e => setJobForm(f => ({ ...f, duration_months: Number(e.target.value) }))} className="input-field font-mono" data-testid="job-duration-input" /></div>
              </div>
              <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">REQUIRED SKILLS</label><input value={jobForm.required_skills} onChange={e => setJobForm(f => ({ ...f, required_skills: e.target.value }))} className="input-field" placeholder="Python, React, SQL" data-testid="job-skills-input" /></div>
              <button onClick={createJob} className="btn-primary w-full py-2.5" data-testid="submit-job-btn">POST JOB</button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="feedback-modal">
          <div className="bg-[#0F0F12] border border-zinc-800 w-full max-w-md p-5 rounded-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Feedback</h2>
              <button onClick={() => setFeedbackModal(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-zinc-500 mb-3 font-mono">FOR: {feedbackModal.studentName}</p>
            <div className="space-y-3">
              <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">RATING</label>
                <div className="flex gap-1.5">
                  {[1,2,3,4,5].map(r => (
                    <button key={r} onClick={() => setFeedback(f => ({...f, rating: r}))}
                      className={`w-8 h-8 text-xs font-bold transition-colors rounded-sm ${feedback.rating >= r ? 'bg-[#00E5FF] text-black' : 'border border-zinc-800 text-zinc-600 hover:border-zinc-600'}`}
                      data-testid={`rating-${r}`}>{r}</button>
                  ))}
                </div>
              </div>
              <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">FEEDBACK</label>
                <textarea value={feedback.feedback} onChange={e => setFeedback(f => ({...f, feedback: e.target.value}))}
                  className="input-field h-20 resize-none" placeholder="Detailed feedback..." data-testid="feedback-text" /></div>
              <p className="text-[9px] text-zinc-600 font-mono">RATING 4+ AUTO-TRIGGERS CERTIFICATE</p>
              <button onClick={submitFeedback} className="btn-primary w-full py-2.5" data-testid="submit-feedback-btn">SUBMIT</button>
            </div>
          </div>
        </div>
      )}

      {/* Interview Modal */}
      {interviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="interview-modal">
          <div className="bg-[#0F0F12] border border-zinc-800 w-full max-w-md p-5 rounded-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Schedule Interview</h2>
              <button onClick={() => setInterviewModal(null)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-zinc-500 mb-3 font-mono">{interviewModal.studentName} / {interviewModal.jobTitle}</p>
            <div className="space-y-3">
              <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">DATE & TIME</label>
                <input type="datetime-local" value={interviewForm.scheduled_date} onChange={e => setInterviewForm(f => ({...f, scheduled_date: e.target.value}))} className="input-field font-mono" data-testid="interview-date-input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">TYPE</label>
                  <select value={interviewForm.interview_type} onChange={e => setInterviewForm(f => ({...f, interview_type: e.target.value}))} className="input-field" data-testid="interview-type-select">
                    <option value="video">Video</option><option value="phone">Phone</option><option value="in_person">In Person</option><option value="technical">Technical</option>
                  </select></div>
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">DURATION (MIN)</label>
                  <input type="number" value={interviewForm.duration_minutes} onChange={e => setInterviewForm(f => ({...f, duration_minutes: Number(e.target.value)}))} className="input-field font-mono" data-testid="interview-duration-input" /></div>
              </div>
              <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">MEETING LINK</label>
                <input value={interviewForm.meeting_link} onChange={e => setInterviewForm(f => ({...f, meeting_link: e.target.value}))} className="input-field" placeholder="https://meet..." data-testid="interview-link-input" /></div>
              <button onClick={scheduleInterview} className="btn-primary w-full py-2.5" data-testid="schedule-interview-btn">SCHEDULE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
