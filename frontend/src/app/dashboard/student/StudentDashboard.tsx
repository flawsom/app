'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, apiPost, apiPut } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Application, Recommendation, Certificate, Job } from '@/types';
import {
  Brain, Briefcase, FileText, Award, Star, MapPin, Clock, ArrowRight,
  Loader2, RefreshCw, Search, Upload, ExternalLink, TrendingUp, AlertTriangle,
  Zap, Activity, Target, ChevronRight, Flame, Trophy, Crown, Rocket, User,
  Medal, Users, BarChart3, Shield, Crosshair, Gauge, X
} from 'lucide-react';
import { ShareGuaranteeModal } from '@/components/ShareGuaranteeModal';

interface SkillGap {
  skill: string; demand_count: number; total_jobs_requiring: number;
  learning_resource: string; platform: string;
}
interface ProfileStrength {
  score: number; max_score: number;
  sections: { field: string; label: string; weight: number; filled: boolean }[];
  suggestions: string[];
}
interface Momentum {
  current_streak: number; longest_streak: number; total_actions: number;
  milestones: { id: string; title: string; achieved: boolean; icon: string }[];
  weekly_activity: number[]; level: number; xp: number; xp_to_next: number;
  total_applications: number; total_selections: number; total_certificates: number;
}
interface ActivityItem { type: string; action: string; status: string; timestamp: string; meta: Record<string, string>; }
interface LeaderboardEntry {
  user_id: string; name: string; department: string; xp: number; level: number;
  applications: number; selections: number; certificates: number; skills_count: number;
  streak: number; longest_streak: number; profile_strength: number;
  days_to_placement: number | null; is_you: boolean; rank: number;
}
interface DeptRanking { department: string; students: number; total_xp: number; avg_xp: number; selections: number; avg_profile: number; }
interface LeaderboardData {
  rankings: LeaderboardEntry[]; your_rank: LeaderboardEntry | null;
  total_students: number; departments: DeptRanking[];
  fastest_to_placement: LeaderboardEntry[]; category: string;
}
interface NextAction {
  next_action: string; reason: string; impact: string; urgency: string;
  action_url?: string; job_id?: string; probability?: number;
}
interface ControlData {
  risk: string; momentum: number; action_required: string; deadline: string;
  stats: { total_applications: number; selected: number; rejected: number; unapplied_jobs: number; profile_completeness: number; skills_count: number; };
  weekly: { target: number; done: number; remaining: number; };
}
interface HireProbability {
  probability: number; job_id: string; job_title: string; company: string;
  factors: { skills: number; experience: number; competition: number; profile: number; timing: number; };
  improvement: string[];
}
interface PredictiveAlert {
  job_id: string; title: string; company: string; probability: number;
  urgency: string; message: string; hours_until_deadline: number | null;
}
interface BehaviorData {
  obedience_score: number; friction_point: string | null; fix: string | null;
  total_events: number; page_views: number; actions_taken: number;
  avg_time_to_action_seconds: number | null; drop_off_rate: number | null;
  recommendations_shown: number; recommendations_followed: number;
}
interface ModelWeights {
  weights: Record<string, number>; version: number; outcomes_processed: number;
}

const MILESTONE_ICONS: Record<string, React.ReactNode> = {
  rocket: <Rocket className="w-3.5 h-3.5" />, fire: <Flame className="w-3.5 h-3.5" />,
  star: <Star className="w-3.5 h-3.5" />, trophy: <Trophy className="w-3.5 h-3.5" />,
  award: <Award className="w-3.5 h-3.5" />, zap: <Zap className="w-3.5 h-3.5" />,
  crown: <Crown className="w-3.5 h-3.5" />, user: <User className="w-3.5 h-3.5" />,
};

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#EF4444', HIGH: '#F97316', MEDIUM: '#EAB308', LOW: '#22C55E'
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = searchParams.get('tab') || 'overview';
  const setTab = (t: string) => router.push(t === 'overview' ? '/dashboard/student' : `/dashboard/student?tab=${t}`);
  const [profile, setProfile] = useState<any>(null);
  const [recommendations, setRecs] = useState<Recommendation[]>([]);
  const [applications, setApps] = useState<Application[]>([]);
  const [certificates, setCerts] = useState<Certificate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [skillGaps, setSkillGaps] = useState<{gaps: SkillGap[], skill_coverage: number, total_gaps: number} | null>(null);
  const [profileStrength, setProfileStrength] = useState<ProfileStrength | null>(null);
  const [momentum, setMomentum] = useState<Momentum | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [lbCategory, setLbCategory] = useState('xp');
  const [lbLoading, setLbLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recsLoading, setRecsLoading] = useState(false);
  const [gapLoading, setGapLoading] = useState(false);
  const [applyingJob, setApplyingJob] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRemote, setFilterRemote] = useState('');
  const [editProfile, setEditProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [resumeData, setResumeData] = useState<{file_name: string; file_data: string} | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [profileForm, setProfileForm] = useState({ first_name: '', last_name: '', department: '', semester: 6, cgpa: 0, skills: '', bio: '', resume_text: '', phone: '', linkedin_url: '', github_url: '' });
  // Intelligence layer state
  const [nextAction, setNextAction] = useState<NextAction | null>(null);
  const [controlData, setControlData] = useState<ControlData | null>(null);
  const [hireProbabilities, setHireProbs] = useState<Record<string, HireProbability>>({});
  const [probLoading, setProbLoading] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  const [behaviorData, setBehaviorData] = useState<BehaviorData | null>(null);
  const [modelWeights, setModelWeights] = useState<ModelWeights | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profData, appsData, certsData, jobsData, interviewData, momentumData, activityData, strengthData] = await Promise.all([
        api('/api/profile'),
        api('/api/applications'),
        api('/api/certificates'),
        api('/api/jobs?status=active'),
        api('/api/interviews').catch(() => ({ interviews: [] })),
        api('/api/momentum').catch(() => null),
        api('/api/activity-stream').catch(() => ({ activities: [] })),
        api('/api/profile/strength').catch(() => null),
      ]);
      setProfile(profData.profile);
      setApps(appsData.applications || []);
      setCerts(certsData.certificates || []);
      setJobs(jobsData.jobs || []);
      setInterviews(interviewData.interviews || []);
      if (momentumData) setMomentum(momentumData);
      setActivities(activityData.activities || []);
      if (strengthData) setProfileStrength(strengthData);
      if (profData.profile) {
        setProfileForm({
          first_name: profData.profile.first_name || '', last_name: profData.profile.last_name || '',
          department: profData.profile.department || '', semester: profData.profile.semester || 6,
          cgpa: profData.profile.cgpa || 0, skills: (profData.profile.skills || []).join(', '),
          bio: profData.profile.bio || '', resume_text: profData.profile.resume_text || '',
          phone: profData.profile.phone || '', linkedin_url: profData.profile.linkedin_url || '',
          github_url: profData.profile.github_url || '',
        });
      }
      // Load intelligence data
      const [naData, ctrlData, alertsData, behavData, weightsData] = await Promise.all([
        api('/api/next-action').catch(() => null),
        api('/api/control').catch(() => null),
        api('/api/alerts').catch(() => ({ alerts: [] })),
        api('/api/user-behavior').catch(() => null),
        api('/api/model/weights').catch(() => null),
      ]);
      if (naData) setNextAction(naData);
      if (ctrlData) setControlData(ctrlData);
      setAlerts(alertsData?.alerts || []);
      if (behavData) setBehaviorData(behavData);
      if (weightsData) setModelWeights(weightsData);
      // Load recommendations
      try { const recsData = await api('/api/recommendations'); setRecs(recsData.recommendations || []); } catch {}
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const generateRecs = async () => { setRecsLoading(true); try { const data = await apiPost('/api/recommendations/generate', {}); setRecs(data.recommendations || []); } catch (e) { console.error(e); } setRecsLoading(false); };
  const analyzeGaps = async () => { setGapLoading(true); try { const data = await api('/api/skill-gap'); setSkillGaps(data); } catch (e) { console.error(e); } setGapLoading(false); };
  const loadLeaderboard = async (cat?: string) => { const c = cat || lbCategory; setLbLoading(true); try { const data = await api(`/api/leaderboard?category=${c}`); setLeaderboard(data); } catch (e) { console.error(e); } setLbLoading(false); };
  const applyToJob = async (jobId: string) => { setApplyingJob(jobId); try { await apiPost('/api/applications', { job_id: jobId }); await loadData(); } catch (e: any) { alert(e.message); } setApplyingJob(null); };
  const saveProfile = async () => { try { await apiPut('/api/profile', { ...profileForm, skills: profileForm.skills.split(',').map(s => s.trim()).filter(Boolean), semester: Number(profileForm.semester), cgpa: Number(profileForm.cgpa) }); setEditProfile(false); await loadData(); } catch (e: any) { alert(e.message); } };
  const uploadResume = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); const reader = new FileReader(); reader.onload = async () => { try { const data = reader.result as string; await apiPost('/api/upload/resume', { file_data: data, file_name: file.name }); setResumeData({ file_name: file.name, file_data: data }); await loadData(); } catch (err: any) { alert(err.message); } setUploading(false); }; reader.readAsDataURL(file); };

  const loadResume = async () => {
    if (resumeData) { setShowResume(true); return; }
    // Try loading from profile resume_url
    if (profile?.resume_url) {
      setShowResume(true);
    }
  };

  const getHireProbability = async (jobId: string) => {
    if (hireProbabilities[jobId]) return;
    setProbLoading(jobId);
    try {
      const data = await apiPost<HireProbability>(`/api/probability/${jobId}`, {});
      setHireProbs(prev => ({ ...prev, [jobId]: data }));
    } catch {}
    setProbLoading(null);
  };

  const appliedJobIds = new Set(applications.map(a => a.job_id));
  const filteredJobs = jobs.filter(j => {
    if (searchQuery && !j.title.toLowerCase().includes(searchQuery.toLowerCase()) && !j.description.toLowerCase().includes(searchQuery.toLowerCase()) && !(j.company_name || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterType && j.job_type !== filterType) return false;
    if (filterRemote === 'remote' && !j.is_remote) return false;
    if (filterRemote === 'onsite' && j.is_remote) return false;
    return true;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-[#00E5FF] rounded-full animate-pulse" />
        <span className="text-zinc-500 text-xs font-mono">LOADING SYSTEM STATE...</span>
      </div>
    </div>
  );

  const TABS = [
    { id: 'overview', label: 'Command Center', icon: <Crosshair className="w-3.5 h-3.5" /> },
    { id: 'jobs', label: 'Match Engine', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'applications', label: 'Applications', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'certificates', label: 'Certificates', icon: <Award className="w-3.5 h-3.5" /> },
    { id: 'skills', label: 'Skill Gap', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Medal className="w-3.5 h-3.5" /> },
    { id: 'momentum', label: 'Momentum', icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'profile', label: 'Profile Engine', icon: <User className="w-3.5 h-3.5" /> },
  ];

  return (
    <div data-testid="student-dashboard" className="space-y-5 animate-fade-in">
      {/* System Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="status-dot status-dot-active" />
            <span className="text-[10px] font-mono text-zinc-600 uppercase">Decision Engine Active</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{user?.name}</h1>
        </div>
        {controlData && (
          <div className="flex items-center gap-4" data-testid="control-header">
            <div className="text-right">
              <span className="text-[10px] font-mono text-zinc-600 block">RISK</span>
              <span className="text-lg font-bold font-mono" style={{ color: RISK_COLORS[controlData.risk] || '#fff' }}>{controlData.risk}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono text-zinc-600 block">MOMENTUM</span>
              <span className="text-lg font-bold font-mono text-[#00E5FF]">{controlData.momentum}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-zinc-800/50 overflow-x-auto" data-testid="student-tabs">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-all ${tab === t.id ? 'border-[#00E5FF] text-[#00E5FF]' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}
            data-testid={`student-tab-${t.id}`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ═══ COMMAND CENTER ═══ */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* NEXT ACTION — Decision Engine Hero */}
          {nextAction && (
            <div className="relative overflow-hidden border rounded-md p-5" style={{
              background: 'linear-gradient(135deg, rgba(0,229,255,0.06) 0%, rgba(0,0,0,0) 60%)',
              borderColor: nextAction.urgency === 'HIGH' ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.06)',
              boxShadow: nextAction.urgency === 'HIGH' ? '0 0 30px rgba(0,229,255,0.08)' : 'none',
            }} data-testid="next-action-panel">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Crosshair className="w-4 h-4 text-[#00E5FF]" />
                    <span className="text-[10px] font-mono text-[#00E5FF] tracking-wider">NEXT ACTION</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${
                      nextAction.urgency === 'HIGH' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      nextAction.urgency === 'MEDIUM' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-green-500/10 text-green-400 border border-green-500/20'
                    }`}>{nextAction.urgency}</span>
                  </div>
                  <h2 className="text-lg font-bold text-white mb-1">{nextAction.next_action}</h2>
                  <p className="text-xs text-zinc-400 mb-1">{nextAction.reason}</p>
                  <p className="text-sm font-semibold text-[#00E5FF]">{nextAction.impact}</p>
                </div>
                {nextAction.probability != null && (
                  <div className="text-center shrink-0">
                    <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center" style={{ borderColor: '#00E5FF', boxShadow: '0 0 20px rgba(0,229,255,0.15)' }}>
                      <span className="text-xl font-bold font-mono text-[#00E5FF]">{Math.round(nextAction.probability * 100)}%</span>
                    </div>
                    <span className="text-[8px] font-mono text-zinc-600 mt-1 block">HIRE PROB</span>
                  </div>
                )}
              </div>
              {nextAction.action_url && (
                <button onClick={() => {
                  const tabMatch = nextAction.action_url?.match(/tab=(\w+)/);
                  if (tabMatch) setTab(tabMatch[1]);
                  else if (nextAction.job_id) { setTab('jobs'); }
                }} className="mt-3 btn-primary text-[10px] px-4 py-2 flex items-center gap-1.5" data-testid="next-action-btn">
                  <ArrowRight className="w-3 h-3" /> TAKE ACTION
                </button>
              )}
            </div>
          )}

          {/* Control System + Stats */}
          {controlData && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="control-stats">
              <div className="card" style={{ borderLeft: `3px solid ${RISK_COLORS[controlData.risk]}` }}>
                <span className="text-[10px] font-mono text-zinc-600">APPLICATIONS</span>
                <p className="text-2xl font-bold font-mono text-[#00E5FF]">{controlData.stats.total_applications}</p>
              </div>
              <div className="card">
                <span className="text-[10px] font-mono text-zinc-600">SELECTED</span>
                <p className="text-2xl font-bold font-mono text-[#22C55E]">{controlData.stats.selected}</p>
              </div>
              <div className="card">
                <span className="text-[10px] font-mono text-zinc-600">UNAPPLIED</span>
                <p className="text-2xl font-bold font-mono text-[#F97316]">{controlData.stats.unapplied_jobs}</p>
              </div>
              <div className="card">
                <span className="text-[10px] font-mono text-zinc-600">PROFILE</span>
                <p className="text-2xl font-bold font-mono text-[#A855F7]">{controlData.stats.profile_completeness}%</p>
              </div>
              <div className="card">
                <span className="text-[10px] font-mono text-zinc-600">WEEKLY</span>
                <p className="text-2xl font-bold font-mono text-white">{controlData.weekly.done}<span className="text-zinc-600">/{controlData.weekly.target}</span></p>
              </div>
            </div>
          )}

          {/* Two Column: AI Recs + Activity/Control */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* AI Recommendations */}
            <div className="lg:col-span-8 card-glow" data-testid="ai-recommendations-panel">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#00E5FF]" />
                  <h2 className="text-sm font-semibold text-white">AI Match Engine</h2>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 rounded-sm">GPT-5.2</span>
                </div>
                <button onClick={generateRecs} disabled={recsLoading} className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50" data-testid="generate-recs-btn">
                  {recsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {recsLoading ? 'ANALYZING...' : 'GENERATE'}
                </button>
              </div>
              {recommendations.length === 0 ? (
                <div className="text-center py-8">
                  <Brain className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-xs mb-1">No recommendations yet</p>
                  <p className="text-[10px] text-zinc-600 font-mono mb-3">FILL YOUR PROFILE WITH SKILLS, THEN GENERATE</p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => setTab('profile')} className="btn-secondary text-[10px] px-3 py-1.5" data-testid="setup-profile-btn">SET UP PROFILE</button>
                    <button onClick={generateRecs} disabled={recsLoading} className="btn-primary text-[10px] px-3 py-1.5 disabled:opacity-50" data-testid="generate-recs-inline">GENERATE NOW</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {recommendations.slice(0, 5).map((r, i) => (
                    <div key={i} className="bg-black border border-zinc-800 p-3 hover:border-[#00E5FF]/30 transition-all duration-200 rounded-sm" data-testid={`rec-${i}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-sm text-white truncate">{r.title}</h3>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 shrink-0 ${r.score >= 80 ? 'badge-success' : r.score >= 60 ? 'badge-info' : 'badge-warning'}`}>{r.score}%</span>
                          </div>
                          <p className="text-xs text-zinc-500">{r.company} {r.location && `/ ${r.location}`}</p>
                          <p className="text-[10px] text-zinc-600 mt-1 font-mono">{r.reason}</p>
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {r.required_skills.slice(0, 4).map(s => {
                              const studentSkills = profile?.skills?.map((sk: string) => sk.toLowerCase()) || [];
                              const hasSkill = studentSkills.includes(s.toLowerCase());
                              return (<span key={s} className={`text-[10px] px-1.5 py-0.5 font-mono ${hasSkill ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{hasSkill ? '+' : '-'} {s}</span>);
                            })}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="score-bar w-16"><div className="score-bar-fill" style={{ width: `${r.score}%` }} /></div>
                          {!appliedJobIds.has(r.job_id) ? (
                            <button onClick={() => applyToJob(r.job_id)} disabled={applyingJob === r.job_id}
                              className="btn-primary text-[10px] px-2.5 py-1 disabled:opacity-50" data-testid={`apply-rec-${i}`}>
                              {applyingJob === r.job_id ? '...' : 'APPLY'}
                            </button>
                          ) : (<span className="badge-success text-[10px] px-2 py-0.5 font-mono">APPLIED</span>)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Control + Activity */}
            <div className="lg:col-span-4 space-y-4">
              {/* Control Directive */}
              {controlData && (
                <div className="card" style={{ borderTop: `2px solid ${RISK_COLORS[controlData.risk]}` }} data-testid="control-directive">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-3.5 h-3.5" style={{ color: RISK_COLORS[controlData.risk] }} />
                    <h3 className="text-xs font-semibold text-white">Control System</h3>
                  </div>
                  <p className="text-xs text-zinc-300 mb-1">{controlData.action_required}</p>
                  <p className="text-[10px] font-mono text-zinc-600">DEADLINE: {controlData.deadline}</p>
                  {/* Weekly progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[9px] font-mono text-zinc-600 mb-1">
                      <span>WEEKLY PROGRESS</span>
                      <span>{controlData.weekly.done}/{controlData.weekly.target}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#00E5FF] to-[#22C55E] transition-all duration-500" style={{ width: `${Math.min(100, (controlData.weekly.done / Math.max(controlData.weekly.target, 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Stream */}
              <div className="card" data-testid="activity-stream-panel">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <h3 className="text-xs font-semibold text-white">Activity Stream</h3>
                </div>
                {activities.length === 0 ? (
                  <div className="text-center py-6">
                    <Activity className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                    <p className="text-zinc-600 text-[10px] font-mono mb-2">YOUR ACTIONS WILL APPEAR HERE</p>
                    <button onClick={() => setTab('jobs')} className="text-[10px] text-[#00E5FF] hover:underline font-mono" data-testid="browse-jobs-link">BROWSE JOBS TO START</button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {activities.slice(0, 8).map((a, i) => (
                      <div key={i} className="py-2 px-2 bg-black/50 border border-zinc-800/50 rounded-sm animate-stream-in" style={{animationDelay: `${i * 0.05}s`}} data-testid={`activity-${i}`}>
                        <p className="text-xs text-zinc-300 truncate">{a.action}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[9px] font-mono px-1 py-0.5 ${a.status === 'selected' ? 'badge-success' : a.status === 'rejected' ? 'badge-error' : a.status === 'pending' ? 'badge-warning' : 'badge-info'}`}>{a.status}</span>
                          {a.timestamp && <span className="text-[9px] text-zinc-700 font-mono">{new Date(a.timestamp).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming Interviews */}
          {interviews.filter(i => i.status === 'scheduled').length > 0 && (
            <div className="card-glow" data-testid="interviews-panel">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-[#EAB308]" />
                <h3 className="text-xs font-semibold text-white">Scheduled Interviews</h3>
              </div>
              {interviews.filter(i => i.status === 'scheduled').map((iv, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div>
                    <p className="font-medium text-sm text-white">{iv.job_title}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{iv.interview_type} / {new Date(iv.scheduled_date).toLocaleString()}</p>
                  </div>
                  {iv.meeting_link && <a href={iv.meeting_link} target="_blank" className="text-[10px] text-[#00E5FF] hover:underline font-mono" data-testid={`join-interview-${idx}`}>JOIN</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ MATCH ENGINE (Browse Jobs + Hire Probability) ═══ */}
      {tab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="input-field pl-9" placeholder="Search jobs, companies..." data-testid="job-search-input" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-field w-auto" data-testid="filter-type">
              <option value="">All Types</option><option value="internship">Internship</option><option value="training">Training</option><option value="placement">Placement</option><option value="project">Project</option>
            </select>
            <select value={filterRemote} onChange={e => setFilterRemote(e.target.value)} className="input-field w-auto" data-testid="filter-remote">
              <option value="">All</option><option value="remote">Remote</option><option value="onsite">On-site</option>
            </select>
          </div>
          <p className="text-[10px] text-zinc-600 font-mono">{filteredJobs.length} RESULTS</p>
          {filteredJobs.length === 0 ? <p className="text-zinc-700 text-center py-12 font-mono text-xs">NO MATCHES FOUND</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredJobs.map(j => {
                const prob = hireProbabilities[j.id];
                return (
                <div key={j.id} className="card hover:border-[#00E5FF]/30 transition-all" data-testid={`job-card-${j.id}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-white truncate">{j.title}</h3>
                      <p className="text-xs text-zinc-500">{j.company_name}</p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 capitalize font-mono shrink-0">{j.job_type}</span>
                  </div>
                  <p className="text-xs text-zinc-500 line-clamp-2 mb-2">{j.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600 mb-2 font-mono">
                    {j.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{j.location}</span>}
                    {j.duration_months && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{j.duration_months}mo</span>}
                    {j.stipend_min && <span>${j.stipend_min}-${j.stipend_max}</span>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap mb-3">
                    {j.required_skills.slice(0, 4).map(s => <span key={s} className="text-[10px] bg-zinc-800 px-1.5 py-0.5 text-zinc-400 font-mono">{s}</span>)}
                  </div>
                  {/* Hire Probability */}
                  {prob ? (
                    <div className="bg-black/50 border border-zinc-800 p-2 rounded-sm mb-3" data-testid={`prob-${j.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-[#00E5FF]">HIRE PROBABILITY</span>
                        <span className="text-sm font-bold font-mono text-[#00E5FF]">{Math.round(prob.probability * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-sm overflow-hidden mb-2">
                        <div className="h-full rounded-sm transition-all" style={{ width: `${prob.probability * 100}%`, background: prob.probability > 0.5 ? '#22C55E' : prob.probability > 0.3 ? '#EAB308' : '#EF4444' }} />
                      </div>
                      <div className="flex gap-2 text-[9px] font-mono text-zinc-600">
                        <span>Skills:{Math.round(prob.factors.skills * 100)}%</span>
                        <span>Comp:{Math.round(prob.factors.competition * 100)}%</span>
                      </div>
                      {prob.improvement.length > 0 && (
                        <p className="text-[9px] text-zinc-500 mt-1">{prob.improvement[0]}</p>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => getHireProbability(j.id)} disabled={probLoading === j.id}
                      className="text-[10px] text-[#00E5FF] hover:underline font-mono mb-3 flex items-center gap-1" data-testid={`calc-prob-${j.id}`}>
                      {probLoading === j.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gauge className="w-3 h-3" />}
                      {probLoading === j.id ? 'CALCULATING...' : 'CALCULATE HIRE PROBABILITY'}
                    </button>
                  )}
                  {!appliedJobIds.has(j.id) ? (
                    <button onClick={() => applyToJob(j.id)} disabled={applyingJob === j.id}
                      className="btn-primary text-xs w-full py-2 disabled:opacity-50" data-testid={`apply-job-${j.id}`}>
                      {applyingJob === j.id ? 'PROCESSING...' : 'APPLY NOW'}
                    </button>
                  ) : (<div className="badge-success text-xs text-center py-2 font-mono">APPLIED</div>)}
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {/* ═══ APPLICATIONS ═══ */}
      {tab === 'applications' && (
        <div>
          {applications.length === 0 ? <p className="text-zinc-700 text-center py-12 font-mono text-xs">NO APPLICATIONS YET</p> : (
            <div className="overflow-x-auto">
              <table className="data-table" data-testid="applications-table">
                <thead><tr><th>Position</th><th>Company</th><th>Status</th><th>Mentor</th><th>Applied</th></tr></thead>
                <tbody>
                  {applications.map(a => (
                    <tr key={a.id} data-testid={`app-row-${a.id}`}>
                      <td className="font-medium text-white">{a.job_title}</td>
                      <td>{a.company_name}</td>
                      <td><span className={`text-[10px] px-1.5 py-0.5 font-mono ${a.status === 'selected' ? 'badge-success' : a.status === 'rejected' ? 'badge-error' : a.status === 'shortlisted' ? 'badge-info' : 'badge-warning'}`}>{a.status.replace(/_/g, ' ').toUpperCase()}</span></td>
                      <td><span className={`text-[10px] px-1.5 py-0.5 font-mono ${a.mentor_approval_status === 'approved' ? 'badge-success' : a.mentor_approval_status === 'rejected' ? 'badge-error' : 'badge-warning'}`}>{a.mentor_approval_status.toUpperCase()}</span></td>
                      <td className="text-zinc-600 text-xs font-mono">{new Date(a.applied_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ CERTIFICATES ═══ */}
      {tab === 'certificates' && (
        <div>
          {certificates.length === 0 ? <p className="text-zinc-700 text-center py-12 font-mono text-xs">NO CERTIFICATES YET</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {certificates.map(c => (
                <div key={c.id} className="card border-l-2 border-l-[#22C55E]" data-testid={`cert-${c.id}`}>
                  <div className="flex items-start justify-between mb-2"><h3 className="font-semibold text-sm text-white">{c.title}</h3><Award className="w-4 h-4 text-[#22C55E]" /></div>
                  <p className="text-xs text-zinc-500 mb-1">{c.issuer_name}</p>
                  <p className="text-[10px] text-zinc-600 mb-2">{c.description}</p>
                  {c.blockchain_hash && (
                    <div className="bg-black p-2 border border-zinc-800 rounded-sm space-y-1">
                      <p className="text-[9px] font-mono text-zinc-600 break-all">HASH: {c.blockchain_hash}</p>
                      <div className="flex gap-3">
                        <a href={`/verify/${c.blockchain_hash}`} target="_blank" className="text-[10px] text-[#00E5FF] hover:underline font-mono inline-flex items-center gap-1">VERIFY <ExternalLink className="w-2.5 h-2.5" /></a>
                        <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/certificates/${c.id}/pdf`} target="_blank" className="text-[10px] text-[#22C55E] hover:underline font-mono inline-flex items-center gap-1" data-testid={`download-cert-${c.id}`}>VIEW PDF <ArrowRight className="w-2.5 h-2.5" /></a>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ SKILL GAP ANALYZER ═══ */}
      {tab === 'skills' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h2 className="text-sm font-semibold text-white flex items-center gap-2"><TrendingUp className="w-4 h-4 text-[#00E5FF]" /> Skill Gap Analyzer</h2><p className="text-[10px] text-zinc-600 mt-1 font-mono">COMPARE YOUR SKILLS VS MARKET DEMAND</p></div>
            <button onClick={analyzeGaps} disabled={gapLoading} className="btn-primary text-[10px] px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50" data-testid="analyze-gaps-btn">
              {gapLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}{gapLoading ? 'ANALYZING...' : 'ANALYZE'}
            </button>
          </div>
          {skillGaps ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="card"><span className="text-[10px] font-mono text-zinc-600">COVERAGE</span><p className="text-2xl font-bold font-mono text-[#00E5FF]">{skillGaps.skill_coverage}%</p></div>
                <div className="card"><span className="text-[10px] font-mono text-zinc-600">GAPS</span><p className="text-2xl font-bold font-mono text-[#EAB308]">{skillGaps.total_gaps}</p></div>
                <div className="card"><span className="text-[10px] font-mono text-zinc-600">HIGH PRIORITY</span><p className="text-2xl font-bold font-mono text-[#EF4444]">{skillGaps.gaps.filter(g => g.demand_count >= 2).length}</p></div>
              </div>
              {skillGaps.gaps.length > 0 && (
                <div className="card">
                  <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-[#EAB308]" /> Missing Skills</h3>
                  <div className="space-y-1.5">
                    {skillGaps.gaps.map((g, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-black border border-zinc-800 hover:border-[#00E5FF]/30 transition-colors rounded-sm" data-testid={`gap-${i}`}>
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-red-500/10 flex items-center justify-center text-red-400 text-[10px] font-bold font-mono rounded-sm">{g.demand_count}</span>
                          <div><p className="text-xs font-medium text-white">{g.skill}</p><p className="text-[9px] text-zinc-600 font-mono">{g.total_jobs_requiring} JOBS REQUIRE THIS</p></div>
                        </div>
                        <a href={g.learning_resource} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#00E5FF] hover:underline font-mono flex items-center gap-1" data-testid={`learn-${i}`}>{g.platform} <ExternalLink className="w-2.5 h-2.5" /></a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card text-center py-10"><Brain className="w-8 h-8 text-zinc-700 mx-auto mb-2" /><p className="text-zinc-600 text-xs font-mono">CLICK ANALYZE TO MAP SKILL GAPS</p></div>
          )}
        </div>
      )}

      {/* ═══ LEADERBOARD ═══ */}
      {tab === 'leaderboard' && (
        <div className="space-y-4">
          {!leaderboard && !lbLoading && (
            <div className="card text-center py-10">
              <Medal className="w-10 h-10 text-[#EAB308] mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white mb-1">Student Leaderboard</h3>
              <p className="text-[10px] text-zinc-600 font-mono mb-4">REAL-TIME RANKINGS ACROSS ALL STUDENTS</p>
              <button onClick={() => loadLeaderboard()} className="btn-primary text-[10px] px-4 py-2" data-testid="load-leaderboard-btn">LOAD LEADERBOARD</button>
            </div>
          )}
          {lbLoading && <div className="flex items-center justify-center py-16 gap-3"><div className="w-2 h-2 bg-[#EAB308] rounded-full animate-pulse" /><span className="text-zinc-500 text-xs font-mono">CALCULATING RANKINGS...</span></div>}
          {leaderboard && !lbLoading && (
            <>
              {leaderboard.your_rank && (
                <div className="card-glow" data-testid="your-rank-panel">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#EAB308]/10 border border-[#EAB308]/30 flex items-center justify-center text-[#EAB308] font-bold font-mono text-lg rounded-sm">#{leaderboard.your_rank.rank}</div>
                      <div><p className="text-sm font-semibold text-white">{leaderboard.your_rank.name} <span className="text-[10px] text-[#00E5FF] font-mono ml-1">YOU</span></p><p className="text-[10px] text-zinc-500 font-mono">{leaderboard.your_rank.department} / LVL {leaderboard.your_rank.level} / {leaderboard.your_rank.xp} XP</p></div>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-600">OF {leaderboard.total_students} STUDENTS</span>
                  </div>
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {[{id:'xp',label:'XP'},{id:'applications',label:'APPLICATIONS'},{id:'selections',label:'PLACEMENTS'},{id:'streak',label:'STREAKS'},{id:'profile',label:'PROFILE'}].map(c => (
                  <button key={c.id} onClick={() => {setLbCategory(c.id); loadLeaderboard(c.id);}}
                    className={`text-[10px] px-2.5 py-1.5 font-mono transition-colors rounded-sm ${lbCategory === c.id ? 'bg-[#EAB308] text-black' : 'border border-zinc-800 text-zinc-500 hover:border-zinc-600'}`} data-testid={`lb-cat-${c.id}`}>{c.label}</button>
                ))}
              </div>
              <div className="card" data-testid="leaderboard-rankings">
                <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2"><Trophy className="w-3.5 h-3.5 text-[#EAB308]" /> Top Performers</h3>
                {leaderboard.rankings.length === 0 ? <p className="text-zinc-700 text-center py-8 font-mono text-xs">NO STUDENTS RANKED YET</p> : (
                  <div className="space-y-1">
                    {leaderboard.rankings.slice(0, 20).map((r, i) => (
                      <div key={r.user_id} className={`flex items-center gap-3 p-2 rounded-sm transition-colors ${r.is_you ? 'bg-[#00E5FF]/5 border border-[#00E5FF]/20' : 'bg-black/30 border border-transparent hover:border-zinc-800'}`} data-testid={`lb-row-${i}`}>
                        <span className={`w-7 h-7 flex items-center justify-center font-bold font-mono text-xs rounded-sm shrink-0 ${r.rank===1?'bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/30':r.rank===2?'bg-zinc-600/20 text-zinc-300 border border-zinc-600/30':r.rank===3?'bg-amber-700/20 text-amber-500 border border-amber-700/30':'bg-zinc-900 text-zinc-600 border border-zinc-800'}`}>{r.rank}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2"><p className="text-xs font-medium text-white truncate">{r.name}</p>{r.is_you && <span className="text-[8px] font-mono px-1 py-0.5 bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/20 rounded-sm">YOU</span>}</div>
                          <p className="text-[9px] text-zinc-600 font-mono">{r.department} / LVL {r.level}</p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 text-right">
                          <div><span className="text-[8px] font-mono text-zinc-700 block">XP</span><span className="text-xs font-bold font-mono text-[#00E5FF]">{r.xp}</span></div>
                          <div><span className="text-[8px] font-mono text-zinc-700 block">APPS</span><span className="text-xs font-mono text-zinc-400">{r.applications}</span></div>
                          <div className="hidden sm:block"><span className="text-[8px] font-mono text-zinc-700 block">PLACED</span><span className="text-xs font-mono text-[#22C55E]">{r.selections}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card" data-testid="dept-rankings">
                  <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2"><Users className="w-3.5 h-3.5 text-[#A855F7]" /> Department Rankings</h3>
                  {leaderboard.departments.length === 0 ? <p className="text-zinc-700 text-center py-6 font-mono text-[10px]">SET YOUR DEPARTMENT IN PROFILE TO APPEAR HERE</p> : (
                    <div className="space-y-2">
                      {leaderboard.departments.map((d, i) => (
                        <div key={d.department} className="flex items-center gap-3 p-2 bg-black/30 border border-zinc-800/50 rounded-sm" data-testid={`dept-${i}`}>
                          <span className="w-6 h-6 flex items-center justify-center text-[10px] font-bold font-mono bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20 rounded-sm">{i+1}</span>
                          <div className="flex-1"><p className="text-xs font-medium text-white">{d.department}</p><p className="text-[9px] text-zinc-600 font-mono">{d.students} students / {d.selections} placed</p></div>
                          <div className="text-right"><span className="text-xs font-bold font-mono text-[#A855F7]">{d.avg_xp}</span><span className="text-[8px] text-zinc-600 font-mono block">AVG XP</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="card" data-testid="fastest-placement">
                  <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2"><Rocket className="w-3.5 h-3.5 text-[#22C55E]" /> Fastest to Placement</h3>
                  {leaderboard.fastest_to_placement.length === 0 ? <p className="text-zinc-700 text-center py-6 font-mono text-[10px]">APPLY AND GET SELECTED TO APPEAR HERE</p> : (
                    <div className="space-y-2">
                      {leaderboard.fastest_to_placement.map((r, i) => (
                        <div key={r.user_id} className={`flex items-center gap-3 p-2 rounded-sm ${r.is_you ? 'bg-[#22C55E]/5 border border-[#22C55E]/20' : 'bg-black/30 border border-zinc-800/50'}`}>
                          <span className="w-6 h-6 flex items-center justify-center text-[10px] font-bold font-mono bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20 rounded-sm">{i+1}</span>
                          <div className="flex-1"><p className="text-xs font-medium text-white">{r.name} {r.is_you && <span className="text-[8px] text-[#00E5FF] font-mono ml-1">YOU</span>}</p><p className="text-[9px] text-zinc-600 font-mono">{r.department}</p></div>
                          <div className="text-right"><span className="text-xs font-bold font-mono text-[#22C55E]">{r.days_to_placement}d</span><span className="text-[8px] text-zinc-600 font-mono block">TO PLACEMENT</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ MOMENTUM SYSTEM ═══ */}
      {tab === 'momentum' && (
        <div className="space-y-4">
          {momentum ? (
            <>
              <div className="card-glow" data-testid="momentum-level">
                <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><Zap className="w-4 h-4 text-[#EAB308]" /><span className="text-sm font-semibold text-white">Level {momentum.level}</span></div><span className="text-[10px] font-mono text-zinc-500">{momentum.xp} XP / {momentum.xp + momentum.xp_to_next} XP</span></div>
                <div className="w-full h-2 bg-zinc-800 rounded-sm overflow-hidden"><div className="h-full bg-gradient-to-r from-[#EAB308] to-[#00E5FF] transition-all duration-1000" style={{ width: `${Math.min(100,(momentum.xp/Math.max(momentum.xp+momentum.xp_to_next,1))*100)}%` }} /></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card"><span className="text-[10px] font-mono text-zinc-600">STREAK</span><p className="text-2xl font-bold font-mono text-[#EAB308]">{momentum.current_streak}d</p></div>
                <div className="card"><span className="text-[10px] font-mono text-zinc-600">LONGEST</span><p className="text-2xl font-bold font-mono text-zinc-400">{momentum.longest_streak}d</p></div>
                <div className="card"><span className="text-[10px] font-mono text-zinc-600">TOTAL APPS</span><p className="text-2xl font-bold font-mono text-[#00E5FF]">{momentum.total_applications}</p></div>
                <div className="card"><span className="text-[10px] font-mono text-zinc-600">SELECTED</span><p className="text-2xl font-bold font-mono text-[#22C55E]">{momentum.total_selections}</p></div>
              </div>
              <div className="card" data-testid="weekly-activity">
                <h3 className="text-xs font-semibold text-white mb-3">Weekly Activity</h3>
                <div className="flex items-end gap-1.5 h-16">
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => { const val = momentum.weekly_activity[i]||0; const max = Math.max(...momentum.weekly_activity,1); return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1"><div className="w-full bg-zinc-800 rounded-sm overflow-hidden" style={{height:'40px'}}><div className="w-full bg-[#00E5FF] rounded-sm transition-all duration-500" style={{height:`${(val/max)*100}%`,marginTop:'auto'}}/></div><span className="text-[8px] font-mono text-zinc-600">{day}</span></div>
                  );})}
                </div>
              </div>
              <div className="card" data-testid="milestones-panel">
                <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2"><Trophy className="w-3.5 h-3.5 text-[#EAB308]" /> Milestones</h3>
                {momentum.milestones.length === 0 ? <p className="text-zinc-700 text-xs font-mono text-center py-4">START APPLYING TO UNLOCK MILESTONES</p> : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {momentum.milestones.map((m, i) => (<div key={i} className="bg-black border border-zinc-800 p-2.5 flex items-center gap-2 rounded-sm" data-testid={`milestone-${m.id}`}><div className="w-7 h-7 bg-[#EAB308]/10 flex items-center justify-center text-[#EAB308] rounded-sm">{MILESTONE_ICONS[m.icon] || <Star className="w-3.5 h-3.5" />}</div><span className="text-[10px] text-zinc-300 font-medium">{m.title}</span></div>))}
                  </div>
                )}
              </div>
            </>
          ) : <div className="card text-center py-10"><Zap className="w-8 h-8 text-zinc-700 mx-auto mb-2" /><p className="text-zinc-600 text-xs font-mono">MOMENTUM TRACKING ACTIVE</p></div>}
        </div>
      )}

      {/* ═══ PROFILE ENGINE ═══ */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-3">
            {profileStrength && (
              <div className="card-glow" data-testid="profile-strength-panel">
                <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-[#00E5FF]" /> Profile Strength</h3>
                <div className="relative w-24 h-24 mx-auto mb-3">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" stroke="#27272A" strokeWidth="6" fill="none" /><circle cx="50" cy="50" r="40" stroke="#00E5FF" strokeWidth="6" fill="none" strokeDasharray={`${profileStrength.score*2.51} 251`} strokeLinecap="round" className="transition-all duration-1000" /></svg>
                  <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-bold font-mono text-[#00E5FF]">{profileStrength.score}%</span></div>
                </div>
                <div className="space-y-1.5">
                  {profileStrength.sections.map((s, i) => (<div key={i} className="flex items-center justify-between text-[10px]"><span className={s.filled ? 'text-zinc-300' : 'text-zinc-600'}>{s.label}</span><span className={`font-mono ${s.filled ? 'text-[#22C55E]' : 'text-zinc-700'}`}>{s.filled ? '+'+s.weight : '-'+s.weight}</span></div>))}
                </div>
                {profileStrength.suggestions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800"><span className="text-[9px] font-mono text-[#EAB308]">SUGGESTIONS</span>{profileStrength.suggestions.map((s, i) => <p key={i} className="text-[10px] text-zinc-500 mt-1">- {s}</p>)}</div>
                )}
              </div>
            )}

            {/* Placement Guarantee — single prominent Share Your Guarantee button */}
            {profile && (
              <div className="card-glow" data-testid="guarantee-share-panel">
                <h3 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-[#00E5FF]" /> Placement Guarantee
                </h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed mb-3">
                  Share your UNIFY-verified placement profile. Employers see your live hire
                  probability, verified skills, and certificates — no login required.
                </p>
                <button
                  data-testid="share-guarantee-btn"
                  onClick={() => setShowShareModal(true)}
                  className="w-full btn-primary text-xs py-2.5 flex items-center justify-center gap-2"
                >
                  <Shield className="w-3.5 h-3.5" /> SHARE YOUR GUARANTEE
                </button>
                <p className="text-[10px] font-mono text-zinc-600 mt-2 text-center">
                  COPY · LINKEDIN · WHATSAPP · X
                </p>
              </div>
            )}
          </div>
          <div className="lg:col-span-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Profile Data</h2>
              <div className="flex gap-2">
                <input type="file" ref={fileRef} onChange={uploadResume} accept=".pdf,.doc,.docx" className="hidden" />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50" data-testid="upload-resume-btn"><Upload className="w-3 h-3" /> {uploading ? 'UPLOADING...' : 'UPLOAD'}</button>
                {(profile?.resume_url || resumeData) && (
                  <button onClick={() => setShowResume(true)} className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1.5" data-testid="view-resume-btn"><FileText className="w-3 h-3" /> VIEW RESUME</button>
                )}
                <button onClick={() => editProfile ? saveProfile() : setEditProfile(true)} className={editProfile ? 'btn-primary text-[10px] px-3 py-1.5' : 'btn-secondary text-[10px] px-3 py-1.5'} data-testid="edit-profile-btn">{editProfile ? 'SAVE' : 'EDIT'}</button>
              </div>
            </div>
            <div className="card space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">FIRST NAME</label><input value={profileForm.first_name} onChange={e => setProfileForm(p => ({...p, first_name: e.target.value}))} disabled={!editProfile} className="input-field" data-testid="profile-first-name" /></div>
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">LAST NAME</label><input value={profileForm.last_name} onChange={e => setProfileForm(p => ({...p, last_name: e.target.value}))} disabled={!editProfile} className="input-field" data-testid="profile-last-name" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">DEPARTMENT</label><input value={profileForm.department} onChange={e => setProfileForm(p => ({...p, department: e.target.value}))} disabled={!editProfile} className="input-field" data-testid="profile-department" /></div>
                <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">CGPA</label><input type="number" step="0.1" value={profileForm.cgpa} onChange={e => setProfileForm(p => ({...p, cgpa: parseFloat(e.target.value)}))} disabled={!editProfile} className="input-field font-mono" data-testid="profile-cgpa" /></div>
              </div>
              <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">SKILLS (COMMA-SEPARATED)</label><input value={profileForm.skills} onChange={e => setProfileForm(p => ({...p, skills: e.target.value}))} disabled={!editProfile} className="input-field" placeholder="Python, React, ML" data-testid="profile-skills" /></div>
              <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">BIO</label><textarea value={profileForm.bio} onChange={e => setProfileForm(p => ({...p, bio: e.target.value}))} disabled={!editProfile} className="input-field h-16 resize-none" data-testid="profile-bio" /></div>
              <div><label className="text-[10px] font-mono text-zinc-500 block mb-1">RESUME TEXT</label><textarea value={profileForm.resume_text} onChange={e => setProfileForm(p => ({...p, resume_text: e.target.value}))} disabled={!editProfile} className="input-field h-24 resize-none" placeholder="Paste resume content for AI matching..." data-testid="profile-resume" /></div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RESUME VIEWER MODAL ═══ */}
      {showResume && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" data-testid="resume-viewer-modal">
          <div className="dash-container border rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[var(--cyan)]" />
                <h2 className="text-sm font-bold">Resume</h2>
                {resumeData && <span className="text-[10px] font-mono text-[var(--text-muted)]">{resumeData.file_name}</span>}
              </div>
              <div className="flex items-center gap-2">
                {profile?.resume_url && (
                  <a href={`${process.env.NEXT_PUBLIC_API_URL}${profile.resume_url}`} target="_blank"
                    className="btn-secondary text-[10px] px-3 py-1.5 flex items-center gap-1" data-testid="download-resume-btn">
                    <ExternalLink className="w-3 h-3" /> DOWNLOAD
                  </a>
                )}
                <button onClick={() => setShowResume(false)} className="p-1.5 hover:bg-white/5 rounded transition-colors" data-testid="close-resume-modal">
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-5">
              {resumeData?.file_data ? (
                resumeData.file_data.startsWith('data:application/pdf') ? (
                  <iframe src={resumeData.file_data} className="w-full h-[70vh] rounded border" style={{ borderColor: 'var(--border-subtle)' }} title="Resume PDF" />
                ) : (
                  <div className="text-center py-10">
                    <FileText className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                    <p className="text-sm text-[var(--text-secondary)] mb-2">Resume uploaded: <strong>{resumeData.file_name}</strong></p>
                    <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/download/resume/${user?.id}`} target="_blank"
                      className="btn-primary text-[10px] px-4 py-2 inline-flex items-center gap-1.5" data-testid="open-resume-link">
                      <ExternalLink className="w-3 h-3" /> Open in New Tab
                    </a>
                  </div>
                )
              ) : profile?.resume_url ? (
                <div className="text-center py-10">
                  <FileText className="w-12 h-12 text-[var(--cyan)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-secondary)] mb-4">Resume is stored on server</p>
                  <a href={`${process.env.NEXT_PUBLIC_API_URL}${profile.resume_url}`} target="_blank"
                    className="btn-primary text-[10px] px-4 py-2 inline-flex items-center gap-1.5" data-testid="open-resume-link">
                    <ExternalLink className="w-3 h-3" /> Open Resume
                  </a>
                </div>
              ) : (
                <div className="text-center py-10">
                  <Upload className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-muted)]">No resume uploaded yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SHARE YOUR GUARANTEE MODAL ═══ */}
      {profile && (
        <ShareGuaranteeModal
          userId={profile.user_id}
          displayName={user?.name}
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
