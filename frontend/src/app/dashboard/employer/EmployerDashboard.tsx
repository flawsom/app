'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSearchParams, useRouter } from 'next/navigation';
import { api, apiPost, apiPut } from '@/lib/api';
import { Job, Application } from '@/types';
import {
  Briefcase, Users, Plus, Loader2, X,
  MessageSquare, Calendar, Activity, Brain, Target
} from 'lucide-react';

export default function EmployerDashboard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tab = searchParams.get('tab') || 'overview';

  const setTab = useCallback((t: string) => {
    router.push(t === 'overview'
      ? '/dashboard/employer'
      : `/dashboard/employer?tab=${t}`);
  }, [router]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApps] = useState<Application[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<any>(null);
  const [interviewModal, setInterviewModal] = useState<any>(null);
  const [feedback, setFeedback] = useState({ feedback: '', rating: 5 });
  const [interviewForm, setInterviewForm] = useState({
    scheduled_date: '',
    interview_type: 'video',
    duration_minutes: 60,
    meeting_link: ''
  });
  const [bestCandidates, setBestCandidates] = useState<any[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [nextAction, setNextAction] = useState<any>(null);

  const [jobForm, setJobForm] = useState({
    title: '',
    description: '',
    job_type: 'internship',
    location: '',
    is_remote: false,
    stipend_min: 0,
    stipend_max: 0,
    duration_months: 3,
    required_skills: '',
    status: 'active'
  });

  // ✅ FIX: stable loader
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [prof, jobs, apps] = await Promise.all([
        api('/api/profile'),
        api('/api/jobs'),
        api('/api/applications')
      ]);
      setProfile(prof.profile);
      setJobs(jobs.jobs || []);
      setApps(apps.applications || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    api('/api/next-action')
      .then(setNextAction)
      .catch(() => {});
  }, []);

  const loadBestCandidates = async () => {
    setCandidatesLoading(true);
    try {
      const data = await api('/api/employer/best-candidates');
      setBestCandidates(data.candidates || []);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const createJob = async () => {
    await apiPost('/api/jobs', {
      ...jobForm,
      required_skills: jobForm.required_skills.split(',').map(s => s.trim()),
    });
    setShowCreateJob(false);
    await loadData();
  };

  const updateAppStatus = async (id: string, status: string) => {
    await apiPut(`/api/applications/${id}/status`, { status });
    await loadData();
  };

  const submitFeedback = async () => {
    if (!feedbackModal) return;
    await apiPut(`/api/applications/${feedbackModal.appId}/feedback`, feedback);
    setFeedbackModal(null);
    await loadData();
  };

  const scheduleInterview = async () => {
    if (!interviewModal) return;
    await apiPost('/api/interviews', {
      application_id: interviewModal.appId,
      ...interviewForm
    });
    setInterviewModal(null);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const TABS = [
    { id: 'overview', label: 'Command Center', icon: <Activity /> },
    { id: 'candidates', label: 'Best Candidates', icon: <Brain /> },
    { id: 'jobs', label: 'Job Postings', icon: <Briefcase /> },
    { id: 'applicants', label: 'Applicants', icon: <Users /> },
  ];

  return (
    <div className="space-y-5">

      {/* HEADER */}
      <div className="flex justify-between">
        <h1>{profile?.company_name || user?.name}</h1>
        <button onClick={() => setShowCreateJob(true)}>
          <Plus /> POST JOB
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-2">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div>
          <p>Jobs: {jobs.length}</p>
          <p>Applications: {applications.length}</p>
        </div>
      )}

      {/* CANDIDATES */}
      {tab === 'candidates' && (
        <div>
          <button onClick={loadBestCandidates}>
            {candidatesLoading ? 'Loading...' : 'Rank Candidates'}
          </button>
        </div>
      )}

      {/* JOBS */}
      {tab === 'jobs' && jobs.map(j => (
        <div key={j.id}>{j.title}</div>
      ))}

      {/* APPLICANTS */}
      {tab === 'applicants' && applications.map(a => (
        <div key={a.id}>{a.student_name}</div>
      ))}
    </div>
  );
}