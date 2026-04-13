-- Project UNIFY Seed Data
-- Demo data for testing and development

-- Insert demo skills
INSERT INTO skills (id, name, category, description) VALUES
(uuid_generate_v4(), 'JavaScript', 'technical', 'Programming language for web development'),
(uuid_generate_v4(), 'Python', 'technical', 'General-purpose programming language'),
(uuid_generate_v4(), 'React', 'technical', 'JavaScript library for building user interfaces'),
(uuid_generate_v4(), 'Node.js', 'technical', 'JavaScript runtime for server-side development'),
(uuid_generate_v4(), 'SQL', 'technical', 'Database query language'),
(uuid_generate_v4(), 'Communication', 'soft_skill', 'Effective verbal and written communication'),
(uuid_generate_v4(), 'Leadership', 'soft_skill', 'Ability to lead and motivate teams'),
(uuid_generate_v4(), 'Problem Solving', 'soft_skill', 'Analytical and critical thinking skills'),
(uuid_generate_v4(), 'English', 'language', 'English language proficiency'),
(uuid_generate_v4(), 'Hindi', 'language', 'Hindi language proficiency');

-- Insert demo badges
INSERT INTO badges (id, name, description, badge_type, criteria, points) VALUES
(uuid_generate_v4(), 'Academic Excellence', 'Awarded for maintaining high CGPA', 'academic', '{"min_cgpa": 8.5}', 100),
(uuid_generate_v4(), 'JavaScript Master', 'Proficiency in JavaScript programming', 'technical', '{"skill": "JavaScript", "min_level": 4}', 75),
(uuid_generate_v4(), 'Team Player', 'Excellent collaboration skills', 'soft_skill', '{"projects": 3, "feedback": "positive"}', 50),
(uuid_generate_v4(), 'Innovation Award', 'Creative problem-solving achievement', 'achievement', '{"project_type": "innovative"}', 150);

-- Insert demo users and profiles
DO $$
DECLARE
    student_user_id UUID;
    mentor_user_id UUID;
    placement_user_id UUID;
    employer_user_id UUID;
    admin_user_id UUID;
    student_profile_id UUID;
    mentor_profile_id UUID;
    employer_profile_id UUID;
    skill_js_id UUID;
    skill_python_id UUID;
    skill_react_id UUID;
    job_posting_id UUID;
BEGIN
    -- Get skill IDs
    SELECT id INTO skill_js_id FROM skills WHERE name = 'JavaScript' LIMIT 1;
    SELECT id INTO skill_python_id FROM skills WHERE name = 'Python' LIMIT 1;
    SELECT id INTO skill_react_id FROM skills WHERE name = 'React' LIMIT 1;

    -- Demo Student User
    student_user_id := uuid_generate_v4();
    INSERT INTO users (id, email, password_hash, role, is_active, is_verified) VALUES
    (student_user_id, 'student@demo.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj.P8kQvT.Pu', 'student', true, true);
    
    student_profile_id := uuid_generate_v4();
    INSERT INTO student_profiles (id, user_id, first_name, last_name, student_id, department, semester, cgpa, phone, bio) VALUES
    (student_profile_id, student_user_id, 'Alex', 'Johnson', 'CS2021001', 'Computer Science', 6, 8.5, '+91-9876543210', 'Passionate computer science student with interests in web development and AI.');

    -- Add skills to student
    INSERT INTO student_skills (student_id, skill_id, proficiency_level, verified) VALUES
    (student_profile_id, skill_js_id, 4, true),
    (student_profile_id, skill_python_id, 3, true),
    (student_profile_id, skill_react_id, 4, false);

    -- Demo Mentor User
    mentor_user_id := uuid_generate_v4();
    INSERT INTO users (id, email, password_hash, role, is_active, is_verified) VALUES
    (mentor_user_id, 'mentor@demo.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj.P8kQvT.Pu', 'mentor', true, true);
    
    mentor_profile_id := uuid_generate_v4();
    INSERT INTO mentor_profiles (id, user_id, first_name, last_name, employee_id, department, designation, specialization, phone, office_location) VALUES
    (mentor_profile_id, mentor_user_id, 'Dr. Sarah', 'Wilson', 'FAC001', 'Computer Science', 'Associate Professor', ARRAY['Web Development', 'Machine Learning'], '+91-9876543211', 'Room 301, CS Block');

    -- Assign mentor to student
    INSERT INTO mentor_student_assignments (mentor_id, student_id) VALUES
    (mentor_profile_id, student_profile_id);

    -- Demo Placement Officer User
    placement_user_id := uuid_generate_v4();
    INSERT INTO users (id, email, password_hash, role, is_active, is_verified) VALUES
    (placement_user_id, 'placement@demo.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj.P8kQvT.Pu', 'placement_officer', true, true);

    -- Demo Employer User
    employer_user_id := uuid_generate_v4();
    INSERT INTO users (id, email, password_hash, role, is_active, is_verified) VALUES
    (employer_user_id, 'employer@demo.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj.P8kQvT.Pu', 'employer', true, true);
    
    employer_profile_id := uuid_generate_v4();
    INSERT INTO employer_profiles (id, user_id, company_name, company_website, company_size, industry, contact_person, contact_email, contact_phone, verification_status) VALUES
    (employer_profile_id, employer_user_id, 'TechCorp Solutions', 'https://techcorp.com', 'medium', 'Information Technology', 'John Smith', 'john@techcorp.com', '+91-9876543212', 'verified');

    -- Demo Admin User
    admin_user_id := uuid_generate_v4();
    INSERT INTO users (id, email, password_hash, role, is_active, is_verified) VALUES
    (admin_user_id, 'admin@demo.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj.P8kQvT.Pu', 'admin', true, true);

    -- Demo Job Postings
    job_posting_id := uuid_generate_v4();
    INSERT INTO job_postings (id, employer_id, title, description, job_type, location, is_remote, stipend_min, stipend_max, duration_months, required_skills, preferred_skills, application_deadline, start_date, status, conversion_opportunity, created_by) VALUES
    (job_posting_id, employer_profile_id, 'Frontend Developer Intern', 'We are looking for a passionate frontend developer intern to join our team. You will work on exciting web applications using modern technologies like React, JavaScript, and CSS.', 'internship', 'Bangalore', false, 15000, 25000, 6, ARRAY[skill_js_id, skill_react_id], ARRAY[skill_python_id], CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '45 days', 'active', true, employer_user_id);

    INSERT INTO job_postings (id, employer_id, title, description, job_type, location, is_remote, stipend_min, stipend_max, duration_months, required_skills, preferred_skills, application_deadline, start_date, status, conversion_opportunity, created_by) VALUES
    (uuid_generate_v4(), employer_profile_id, 'Python Developer Intern', 'Join our backend development team as a Python intern. Work on scalable web services, APIs, and data processing systems.', 'internship', 'Mumbai', true, 18000, 28000, 4, ARRAY[skill_python_id], ARRAY[skill_js_id], CURRENT_DATE + INTERVAL '20 days', CURRENT_DATE + INTERVAL '35 days', 'active', false, employer_user_id);

    INSERT INTO job_postings (id, employer_id, title, description, job_type, location, is_remote, stipend_min, stipend_max, duration_months, required_skills, preferred_skills, application_deadline, start_date, status, conversion_opportunity, created_by) VALUES
    (uuid_generate_v4(), employer_profile_id, 'Full Stack Training Program', 'Comprehensive 3-month training program covering both frontend and backend technologies. Perfect for students looking to gain industry experience.', 'training', 'Delhi', false, 12000, 20000, 3, ARRAY[skill_js_id], ARRAY[skill_react_id, skill_python_id], CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '30 days', 'active', true, employer_user_id);

    -- Demo Application
    INSERT INTO applications (student_id, job_posting_id, mentor_id, cover_letter, status, mentor_approval_status, matching_score) VALUES
    (student_profile_id, job_posting_id, mentor_profile_id, 'I am very interested in this frontend developer position. My experience with React and JavaScript makes me a great fit for this role.', 'submitted', 'approved', 85.5);

    -- Demo Notifications
    INSERT INTO notifications (user_id, title, message, type) VALUES
    (student_user_id, 'New Job Recommendation', 'We found a new internship opportunity that matches your profile!', 'info'),
    (mentor_user_id, 'Approval Request', 'Alex Johnson has applied for a new internship and needs your approval.', 'warning'),
    (employer_user_id, 'New Application', 'You have received a new application for Frontend Developer Intern position.', 'success');

    -- Demo Certificates
    INSERT INTO certificates (student_id, certificate_type, title, description, issuer_name, issue_date, status) VALUES
    (student_profile_id, 'skill_certification', 'JavaScript Proficiency Certificate', 'Certified proficient in JavaScript programming language', 'Project UNIFY', CURRENT_DATE - INTERVAL '30 days', 'issued');

    -- Demo System Metrics
    INSERT INTO system_metrics (metric_name, metric_value, metric_data) VALUES
    ('total_students', 150, '{"department_breakdown": {"CS": 60, "IT": 45, "ECE": 45}}'),
    ('total_applications', 89, '{"this_month": 23, "last_month": 31}'),
    ('placement_rate', 78.5, '{"target": 85, "improvement_needed": 6.5}'),
    ('active_job_postings', 12, '{"internships": 8, "training": 3, "placements": 1}');

END $$;

-- Insert additional demo data for better testing
INSERT INTO user_activities (user_id, activity_type, activity_data, ip_address) 
SELECT 
    u.id,
    'login',
    '{"timestamp": "' || NOW() || '", "success": true}',
    '192.168.1.100'::inet
FROM users u 
WHERE u.email IN ('student@demo.com', 'mentor@demo.com', 'employer@demo.com')
LIMIT 3;

-- Create some sample interview records
INSERT INTO interviews (application_id, interview_type, scheduled_date, duration_minutes, location, status)
SELECT 
    a.id,
    'video',
    CURRENT_TIMESTAMP + INTERVAL '7 days',
    60,
    'Google Meet',
    'scheduled'
FROM applications a
LIMIT 1;

COMMIT;