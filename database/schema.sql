-- Project UNIFY Database Schema
-- PostgreSQL 15+ compatible

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('student', 'mentor', 'placement_officer', 'employer', 'admin');
CREATE TYPE skill_category AS ENUM ('technical', 'soft_skill', 'language', 'certification');
CREATE TYPE badge_type AS ENUM ('academic', 'technical', 'soft_skill', 'certification', 'achievement');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE company_size AS ENUM ('startup', 'small', 'medium', 'large', 'enterprise');
CREATE TYPE job_type AS ENUM ('internship', 'training', 'placement', 'project');
CREATE TYPE posting_status AS ENUM ('draft', 'active', 'paused', 'closed', 'expired');
CREATE TYPE application_status AS ENUM ('submitted', 'under_review', 'shortlisted', 'interview_scheduled', 'selected', 'rejected', 'withdrawn');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE interview_type AS ENUM ('phone', 'video', 'in_person', 'technical', 'hr');
CREATE TYPE interview_status AS ENUM ('scheduled', 'completed', 'cancelled', 'rescheduled');
CREATE TYPE certificate_type AS ENUM ('internship_completion', 'training_completion', 'skill_certification', 'achievement');
CREATE TYPE certificate_status AS ENUM ('draft', 'issued', 'verified', 'revoked');

-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Student Profiles
CREATE TABLE student_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(50) UNIQUE,
    department VARCHAR(100),
    semester INTEGER,
    cgpa DECIMAL(3,2),
    phone VARCHAR(20),
    linkedin_url VARCHAR(255),
    github_url VARCHAR(255),
    resume_url VARCHAR(255),
    profile_image_url VARCHAR(255),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills and Competencies
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category skill_category,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5),
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, skill_id)
);

-- Badge System
CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    badge_type badge_type,
    criteria JSONB,
    image_url VARCHAR(255),
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
    semester INTEGER,
    earned_date DATE,
    verification_status verification_status DEFAULT 'pending',
    verifier_id UUID REFERENCES users(id),
    blockchain_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, badge_id, semester)
);

-- Faculty and Mentors
CREATE TABLE mentor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50) UNIQUE,
    department VARCHAR(100),
    designation VARCHAR(100),
    specialization TEXT[],
    phone VARCHAR(20),
    office_location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mentor_student_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID REFERENCES mentor_profiles(id) ON DELETE CASCADE,
    student_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
    assigned_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mentor_id, student_id)
);

-- Employers and Companies
CREATE TABLE employer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(200) NOT NULL,
    company_website VARCHAR(255),
    company_size company_size,
    industry VARCHAR(100),
    contact_person VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    address TEXT,
    verification_status verification_status DEFAULT 'pending',
    verification_documents JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Postings and Opportunities
CREATE TABLE job_postings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employer_id UUID REFERENCES employer_profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    job_type job_type,
    location VARCHAR(100),
    is_remote BOOLEAN DEFAULT false,
    stipend_min INTEGER,
    stipend_max INTEGER,
    duration_months INTEGER,
    required_skills UUID[],
    preferred_skills UUID[],
    eligibility_criteria JSONB,
    application_deadline DATE,
    start_date DATE,
    max_applicants INTEGER,
    status posting_status DEFAULT 'draft',
    conversion_opportunity BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Applications and Workflow
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
    job_posting_id UUID REFERENCES job_postings(id) ON DELETE CASCADE,
    mentor_id UUID REFERENCES mentor_profiles(id),
    cover_letter TEXT,
    status application_status DEFAULT 'submitted',
    mentor_approval_status approval_status DEFAULT 'pending',
    mentor_comments TEXT,
    employer_feedback TEXT,
    matching_score DECIMAL(5,2),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mentor_reviewed_at TIMESTAMP,
    employer_reviewed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, job_posting_id)
);

-- Interview Management
CREATE TABLE interviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    interview_type interview_type,
    scheduled_date TIMESTAMP,
    duration_minutes INTEGER DEFAULT 60,
    location VARCHAR(255),
    meeting_link VARCHAR(255),
    interviewer_notes TEXT,
    candidate_feedback TEXT,
    status interview_status DEFAULT 'scheduled',
    calendar_event_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Certificates and Achievements
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES student_profiles(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id),
    certificate_type certificate_type,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    issuer_name VARCHAR(200),
    issue_date DATE,
    expiry_date DATE,
    certificate_url VARCHAR(255),
    badge_json JSONB,
    blockchain_hash VARCHAR(255),
    blockchain_tx_id VARCHAR(255),
    verification_url VARCHAR(255),
    status certificate_status DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics and Reporting
CREATE TABLE user_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50),
    activity_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100),
    metric_value DECIMAL(10,2),
    metric_data JSONB,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    action_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_student_profiles_user_id ON student_profiles(user_id);
CREATE INDEX idx_student_profiles_department ON student_profiles(department);
CREATE INDEX idx_student_profiles_student_id ON student_profiles(student_id);
CREATE INDEX idx_job_postings_status ON job_postings(status);
CREATE INDEX idx_job_postings_employer_id ON job_postings(employer_id);
CREATE INDEX idx_job_postings_job_type ON job_postings(job_type);
CREATE INDEX idx_applications_student_id ON applications(student_id);
CREATE INDEX idx_applications_job_posting_id ON applications(job_posting_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_mentor_approval ON applications(mentor_approval_status);
CREATE INDEX idx_certificates_student_id ON certificates(student_id);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_user_activities_user_id ON user_activities(user_id);
CREATE INDEX idx_user_activities_created_at ON user_activities(created_at);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- Full-text search indexes
CREATE INDEX idx_job_postings_search ON job_postings USING gin(to_tsvector('english', title || ' ' || description));
CREATE INDEX idx_student_profiles_search ON student_profiles USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || COALESCE(bio, '')));

-- Functions and Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_student_profiles_updated_at BEFORE UPDATE ON student_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mentor_profiles_updated_at BEFORE UPDATE ON mentor_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employer_profiles_updated_at BEFORE UPDATE ON employer_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_postings_updated_at BEFORE UPDATE ON job_postings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interviews_updated_at BEFORE UPDATE ON interviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();