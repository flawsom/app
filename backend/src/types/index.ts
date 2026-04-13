// User Types
export type UserRole = 'student' | 'mentor' | 'placement_officer' | 'employer' | 'admin'

export interface User {
  id: string
  email: string
  password_hash: string
  role: UserRole
  is_active: boolean
  is_verified: boolean
  created_at: Date
  updated_at: Date
}

export interface JWTPayload {
  sub: string
  email: string
  role: UserRole
  iat: number
  exp: number
}

// Student Types
export interface StudentProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  student_id: string
  department: string
  semester: number
  cgpa: number
  phone?: string
  linkedin_url?: string
  github_url?: string
  resume_url?: string
  profile_image_url?: string
  bio?: string
  created_at: Date
  updated_at: Date
}

export interface Skill {
  id: string
  name: string
  category: 'technical' | 'soft_skill' | 'language' | 'certification'
  description?: string
  created_at: Date
}

export interface StudentSkill {
  id: string
  student_id: string
  skill_id: string
  proficiency_level: number
  verified: boolean
  created_at: Date
}

// Job Types
export interface JobPosting {
  id: string
  employer_id: string
  title: string
  description: string
  job_type: 'internship' | 'training' | 'placement' | 'project'
  location: string
  is_remote: boolean
  stipend_min?: number
  stipend_max?: number
  duration_months?: number
  required_skills: string[]
  preferred_skills: string[]
  eligibility_criteria: Record<string, any>
  application_deadline: Date
  start_date: Date
  max_applicants?: number
  status: 'draft' | 'active' | 'paused' | 'closed' | 'expired'
  conversion_opportunity: boolean
  created_by: string
  created_at: Date
  updated_at: Date
}

// Application Types
export interface Application {
  id: string
  student_id: string
  job_posting_id: string
  mentor_id?: string
  cover_letter?: string
  status: 'submitted' | 'under_review' | 'shortlisted' | 'interview_scheduled' | 'selected' | 'rejected' | 'withdrawn'
  mentor_approval_status: 'pending' | 'approved' | 'rejected'
  mentor_comments?: string
  employer_feedback?: string
  matching_score?: number
  applied_at: Date
  mentor_reviewed_at?: Date
  employer_reviewed_at?: Date
  updated_at: Date
}

// Mentor Types
export interface MentorProfile {
  id: string
  user_id: string
  first_name: string
  last_name: string
  employee_id: string
  department: string
  designation: string
  specialization: string[]
  phone?: string
  office_location?: string
  created_at: Date
  updated_at: Date
}

// Employer Types
export interface EmployerProfile {
  id: string
  user_id: string
  company_name: string
  company_website?: string
  company_size: 'startup' | 'small' | 'medium' | 'large' | 'enterprise'
  industry: string
  contact_person: string
  contact_email: string
  contact_phone?: string
  address?: string
  verification_status: 'pending' | 'verified' | 'rejected'
  verification_documents?: Record<string, any>
  created_at: Date
  updated_at: Date
}

// Certificate Types
export interface Certificate {
  id: string
  student_id: string
  application_id?: string
  certificate_type: 'internship_completion' | 'training_completion' | 'skill_certification' | 'achievement'
  title: string
  description: string
  issuer_name: string
  issue_date: Date
  expiry_date?: Date
  certificate_url?: string
  badge_json?: Record<string, any>
  blockchain_hash?: string
  blockchain_tx_id?: string
  verification_url?: string
  status: 'draft' | 'issued' | 'verified' | 'revoked'
  created_at: Date
  updated_at: Date
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  timestamp?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// Request Types
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  role: UserRole
  first_name: string
  last_name: string
}

export interface JobPostingRequest {
  title: string
  description: string
  job_type: 'internship' | 'training' | 'placement' | 'project'
  location: string
  is_remote: boolean
  stipend_min?: number
  stipend_max?: number
  duration_months?: number
  required_skills: string[]
  preferred_skills: string[]
  eligibility_criteria?: Record<string, any>
  application_deadline: string
  start_date: string
  max_applicants?: number
  conversion_opportunity: boolean
}

export interface ApplicationRequest {
  job_posting_id: string
  cover_letter?: string
}

// Database Query Types
export interface QueryOptions {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  filters?: Record<string, any>
}

// Recommendation Types
export interface JobRecommendation {
  job: JobPosting
  matching_score: number
  reasons: string[]
  skills_match: Array<{
    skill: string
    matched: boolean
    required: boolean
  }>
}

// Analytics Types
export interface PlacementMetrics {
  total_students: number
  total_applications: number
  total_placements: number
  placement_rate: number
  average_stipend: number
  top_companies: Array<{
    company_name: string
    placement_count: number
  }>
  department_wise_stats: Array<{
    department: string
    student_count: number
    placement_count: number
    placement_rate: number
  }>
  monthly_trends: Array<{
    month: string
    applications: number
    placements: number
  }>
}

// Error Types
export interface AppError extends Error {
  statusCode: number
  isOperational: boolean
}

// Middleware Types
export interface AuthenticatedRequest extends Request {
  user?: User
}

// File Upload Types
export interface FileUpload {
  fieldname: string
  originalname: string
  encoding: string
  mimetype: string
  size: number
  destination: string
  filename: string
  path: string
}

// Notification Types
export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  action_url?: string
  created_at: Date
}

// Cache Types
export interface CacheOptions {
  ttl?: number // Time to live in seconds
  key: string
}

// Email Types
export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: Array<{
    filename: string
    path: string
  }>
}

// Blockchain Types
export interface BlockchainTransaction {
  hash: string
  blockNumber: number
  transactionIndex: number
  from: string
  to: string
  gasUsed: string
  status: boolean
}

export interface CertificateVerification {
  is_valid: boolean
  certificate: Certificate
  blockchain_verification: {
    transaction_hash: string
    block_number: number
    timestamp: Date
    verified: boolean
  }
}