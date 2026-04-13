-- Insert default skills for the platform
-- This provides a base set of skills that users can select from

INSERT INTO skills (id, name, category, description) VALUES
-- Technical Skills
(uuid_generate_v4(), 'JavaScript', 'technical', 'Programming language for web development'),
(uuid_generate_v4(), 'Python', 'technical', 'General-purpose programming language'),
(uuid_generate_v4(), 'Java', 'technical', 'Object-oriented programming language'),
(uuid_generate_v4(), 'C++', 'technical', 'Systems programming language'),
(uuid_generate_v4(), 'React', 'technical', 'JavaScript library for building user interfaces'),
(uuid_generate_v4(), 'Node.js', 'technical', 'JavaScript runtime for server-side development'),
(uuid_generate_v4(), 'Angular', 'technical', 'TypeScript-based web application framework'),
(uuid_generate_v4(), 'Vue.js', 'technical', 'Progressive JavaScript framework'),
(uuid_generate_v4(), 'HTML/CSS', 'technical', 'Web markup and styling languages'),
(uuid_generate_v4(), 'SQL', 'technical', 'Database query language'),
(uuid_generate_v4(), 'MongoDB', 'technical', 'NoSQL database'),
(uuid_generate_v4(), 'PostgreSQL', 'technical', 'Relational database management system'),
(uuid_generate_v4(), 'Git', 'technical', 'Version control system'),
(uuid_generate_v4(), 'Docker', 'technical', 'Containerization platform'),
(uuid_generate_v4(), 'AWS', 'technical', 'Amazon Web Services cloud platform'),
(uuid_generate_v4(), 'Machine Learning', 'technical', 'Artificial intelligence and data science'),
(uuid_generate_v4(), 'Data Analysis', 'technical', 'Statistical analysis and interpretation'),
(uuid_generate_v4(), 'Mobile Development', 'technical', 'iOS and Android app development'),

-- Soft Skills
(uuid_generate_v4(), 'Communication', 'soft_skill', 'Effective verbal and written communication'),
(uuid_generate_v4(), 'Leadership', 'soft_skill', 'Ability to lead and motivate teams'),
(uuid_generate_v4(), 'Problem Solving', 'soft_skill', 'Analytical and critical thinking skills'),
(uuid_generate_v4(), 'Teamwork', 'soft_skill', 'Collaboration and team participation'),
(uuid_generate_v4(), 'Time Management', 'soft_skill', 'Efficient task and schedule management'),
(uuid_generate_v4(), 'Adaptability', 'soft_skill', 'Flexibility in changing environments'),
(uuid_generate_v4(), 'Critical Thinking', 'soft_skill', 'Objective analysis and evaluation'),
(uuid_generate_v4(), 'Creativity', 'soft_skill', 'Innovative and original thinking'),
(uuid_generate_v4(), 'Presentation Skills', 'soft_skill', 'Public speaking and presentation abilities'),
(uuid_generate_v4(), 'Project Management', 'soft_skill', 'Planning and executing projects'),

-- Languages
(uuid_generate_v4(), 'English', 'language', 'English language proficiency'),
(uuid_generate_v4(), 'Hindi', 'language', 'Hindi language proficiency'),
(uuid_generate_v4(), 'Spanish', 'language', 'Spanish language proficiency'),
(uuid_generate_v4(), 'French', 'language', 'French language proficiency'),
(uuid_generate_v4(), 'German', 'language', 'German language proficiency'),
(uuid_generate_v4(), 'Mandarin', 'language', 'Mandarin Chinese proficiency'),

-- Certifications
(uuid_generate_v4(), 'AWS Certified', 'certification', 'Amazon Web Services certification'),
(uuid_generate_v4(), 'Google Cloud Certified', 'certification', 'Google Cloud Platform certification'),
(uuid_generate_v4(), 'Microsoft Azure Certified', 'certification', 'Microsoft Azure certification'),
(uuid_generate_v4(), 'Scrum Master', 'certification', 'Agile project management certification'),
(uuid_generate_v4(), 'PMP', 'certification', 'Project Management Professional certification')

ON CONFLICT (name) DO NOTHING;