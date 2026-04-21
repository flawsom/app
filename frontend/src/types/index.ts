export interface User {
  id: string;
  _id: string;
  email: string;
  name: string;
  role: 'student' | 'mentor' | 'placement' | 'employer' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface StudentProfile {
  id?: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  semester?: number;
  cgpa?: number;
  phone?: string;
  linkedin_url?: string;
  github_url?: string;
  resume_text?: string;
  skills?: string[];
  bio?: string;
}

export interface MentorProfile {
  id?: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  designation?: string;
  specialization?: string[];
  phone?: string;
}

export interface EmployerProfile {
  id?: string;
  user_id: string;
  company_name?: string;
  company_website?: string;
  industry?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  verification_status?: string;
}

export interface Job {
  id: string;
  _id: string;
  employer_id: string;
  title: string;
  description: string;
  job_type: string;
  location?: string;
  is_remote: boolean;
  stipend_min?: number;
  stipend_max?: number;
  duration_months?: number;
  required_skills: string[];
  status: string;
  application_deadline?: string;
  company_name?: string;
  application_count?: number;
  created_at: string;
}

export interface Application {
  id: string;
  _id: string;
  student_id: string;
  student_name?: string;
  job_id: string;
  job_title?: string;
  company_name?: string;
  cover_letter?: string;
  cover_letter_source?: string;
  status: string;
  mentor_approval_status: string;
  mentor_comments?: string;
  employer_feedback?: string;
  matching_score?: number;
  applied_at: string;
}

export interface Certificate {
  id: string;
  student_id: string;
  application_id?: string;
  certificate_type: string;
  title: string;
  description?: string;
  issuer_name?: string;
  issue_date?: string;
  blockchain_hash?: string;
  status: string;
}

export interface Recommendation {
  job_id: string;
  title: string;
  company: string;
  location?: string;
  job_type: string;
  stipend_min?: number;
  stipend_max?: number;
  score: number;
  reason: string;
  required_skills: string[];
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  action_url?: string;
  created_at: string;
}

export interface AnalyticsOverview {
  total_users: number;
  total_students: number;
  total_employers: number;
  total_mentors: number;
  total_jobs: number;
  active_jobs: number;
  total_applications: number;
  selected: number;
  rejected: number;
  shortlisted: number;
  pending: number;
  under_review: number;
  total_certificates: number;
  placement_rate: number;
  conversion_rate: number;
  applications_by_status: { status: string; count: number }[];
}
