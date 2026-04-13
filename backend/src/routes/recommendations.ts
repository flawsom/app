import express from 'express'
import { Pool } from 'pg'
import { authenticate, authorize } from '../middleware/auth'
import { asyncHandler, CustomError } from '../middleware/errorHandler'
import { ApiResponse } from '../types'

const router = express.Router()

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// Simple matching algorithm (placeholder for AI service)
function calculateMatchingScore(studentSkills: any[], jobSkills: string[]): number {
  if (!studentSkills || studentSkills.length === 0) return 0
  if (!jobSkills || jobSkills.length === 0) return 50 // Base score if no specific skills required

  const studentSkillNames = studentSkills.map(s => s.skill.name.toLowerCase())
  const matchedSkills = jobSkills.filter(skill => 
    studentSkillNames.some(studentSkill => 
      studentSkill.includes(skill.toLowerCase()) || skill.toLowerCase().includes(studentSkill)
    )
  )

  const matchPercentage = (matchedSkills.length / jobSkills.length) * 100
  const skillBonus = studentSkills.reduce((acc, skill) => acc + skill.proficiency_level, 0) / studentSkills.length * 5
  
  return Math.min(95, matchPercentage + skillBonus + Math.random() * 10)
}

// @route   GET /api/v1/recommendations/jobs
// @desc    Get job recommendations for student
// @access  Private (Student only)
router.get('/jobs', [
  authenticate,
  authorize('student')
], asyncHandler(async (req, res) => {
  const userId = req.user!.id
  const limit = parseInt(req.query.limit as string) || 5

  // Get student profile with skills
  const studentQuery = `
    SELECT 
      sp.*,
      (
        SELECT json_agg(
          json_build_object(
            'id', ss.id,
            'skill', json_build_object('id', s.id, 'name', s.name, 'category', s.category),
            'proficiency_level', ss.proficiency_level,
            'verified', ss.verified
          )
        )
        FROM student_skills ss
        JOIN skills s ON ss.skill_id = s.id
        WHERE ss.student_id = sp.id
      ) as skills
    FROM student_profiles sp
    WHERE sp.user_id = $1
  `

  const studentResult = await pool.query(studentQuery, [userId])

  if (studentResult.rows.length === 0) {
    throw new CustomError('Student profile not found', 404)
  }

  const student = studentResult.rows[0]

  // Get active job postings that student hasn't applied to
  const jobsQuery = `
    SELECT 
      jp.*,
      ep.company_name,
      ep.company_website,
      ep.company_size,
      ep.industry,
      (
        SELECT json_agg(
          json_build_object('id', s.id, 'name', s.name, 'category', s.category)
        )
        FROM unnest(jp.required_skills) AS skill_id
        JOIN skills s ON s.id = skill_id
      ) as required_skills_details,
      (
        SELECT json_agg(
          json_build_object('id', s.id, 'name', s.name, 'category', s.category)
        )
        FROM unnest(jp.preferred_skills) AS skill_id
        JOIN skills s ON s.id = skill_id
      ) as preferred_skills_details
    FROM job_postings jp
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    WHERE jp.status = 'active' 
      AND jp.application_deadline > CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM applications a 
        WHERE a.job_posting_id = jp.id AND a.student_id = $1
      )
    ORDER BY jp.created_at DESC
    LIMIT 20
  `

  const jobsResult = await pool.query(jobsQuery, [student.id])

  // Calculate matching scores and generate recommendations
  const recommendations = jobsResult.rows.map(job => {
    const requiredSkillNames = job.required_skills_details 
      ? job.required_skills_details.map((s: any) => s.name)
      : []
    
    const matchingScore = calculateMatchingScore(student.skills || [], requiredSkillNames)
    
    // Generate reasons for recommendation
    const reasons = []
    
    if (student.department && job.title.toLowerCase().includes(student.department.toLowerCase())) {
      reasons.push(`Matches your ${student.department} background`)
    }
    
    if (student.skills && student.skills.length > 0) {
      const matchedSkills = student.skills.filter((studentSkill: any) =>
        requiredSkillNames.some((jobSkill: string) =>
          jobSkill.toLowerCase().includes(studentSkill.skill.name.toLowerCase()) ||
          studentSkill.skill.name.toLowerCase().includes(jobSkill.toLowerCase())
        )
      )
      
      if (matchedSkills.length > 0) {
        reasons.push(`You have ${matchedSkills.length} matching skill${matchedSkills.length > 1 ? 's' : ''}`)
      }
    }
    
    if (job.conversion_opportunity) {
      reasons.push('Offers full-time conversion opportunity')
    }
    
    if (job.is_remote) {
      reasons.push('Remote work available')
    }

    if (reasons.length === 0) {
      reasons.push('Good learning opportunity for your career')
    }

    // Skills match analysis
    const skillsMatch = requiredSkillNames.map((jobSkill: string) => {
      const studentHasSkill = student.skills && student.skills.some((studentSkill: any) =>
        jobSkill.toLowerCase().includes(studentSkill.skill.name.toLowerCase()) ||
        studentSkill.skill.name.toLowerCase().includes(jobSkill.toLowerCase())
      )
      
      return {
        skill: jobSkill,
        matched: studentHasSkill,
        required: true
      }
    })

    return {
      job: {
        id: job.id,
        title: job.title,
        description: job.description,
        job_type: job.job_type,
        location: job.location,
        is_remote: job.is_remote,
        stipend_min: job.stipend_min,
        stipend_max: job.stipend_max,
        duration_months: job.duration_months,
        application_deadline: job.application_deadline,
        start_date: job.start_date,
        conversion_opportunity: job.conversion_opportunity,
        employer: {
          company_name: job.company_name,
          company_website: job.company_website,
          company_size: job.company_size,
          industry: job.industry
        },
        required_skills: requiredSkillNames,
        preferred_skills: job.preferred_skills_details 
          ? job.preferred_skills_details.map((s: any) => s.name)
          : []
      },
      matching_score: matchingScore / 100, // Convert to 0-1 scale
      reasons,
      skills_match: skillsMatch
    }
  })

  // Sort by matching score and take top recommendations
  const sortedRecommendations = recommendations
    .sort((a, b) => b.matching_score - a.matching_score)
    .slice(0, limit)

  const response: ApiResponse = {
    success: true,
    data: {
      recommendations: sortedRecommendations,
      student_profile: {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        department: student.department,
        semester: student.semester,
        cgpa: student.cgpa,
        skills_count: student.skills ? student.skills.length : 0
      }
    },
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   POST /api/v1/recommendations/feedback
// @desc    Provide feedback on recommendations
// @access  Private (Student only)
router.post('/feedback', [
  authenticate,
  authorize('student')
], asyncHandler(async (req, res) => {
  const userId = req.user!.id
  const { job_id, feedback_type, reason } = req.body

  // Validate input
  if (!job_id || !feedback_type) {
    throw new CustomError('Job ID and feedback type are required', 400)
  }

  const validFeedbackTypes = ['like', 'dislike', 'applied', 'not_interested']
  if (!validFeedbackTypes.includes(feedback_type)) {
    throw new CustomError('Invalid feedback type', 400)
  }

  // Get student profile
  const studentQuery = 'SELECT id FROM student_profiles WHERE user_id = $1'
  const studentResult = await pool.query(studentQuery, [userId])

  if (studentResult.rows.length === 0) {
    throw new CustomError('Student profile not found', 404)
  }

  const studentId = studentResult.rows[0].id

  // Log the feedback (in a real system, this would be used to improve recommendations)
  await pool.query(
    'INSERT INTO user_activities (user_id, activity_type, activity_data) VALUES ($1, $2, $3)',
    [
      userId,
      'recommendation_feedback',
      JSON.stringify({
        job_id,
        feedback_type,
        reason,
        timestamp: new Date().toISOString()
      })
    ]
  )

  const response: ApiResponse = {
    success: true,
    message: 'Feedback recorded successfully',
    data: {
      job_id,
      feedback_type,
      reason
    },
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   GET /api/v1/recommendations/analytics
// @desc    Get recommendation analytics (for admin/placement officers)
// @access  Private (Admin/Placement Officer only)
router.get('/analytics', [
  authenticate,
  authorize('admin', 'placement_officer')
], asyncHandler(async (req, res) => {
  // Get recommendation engagement metrics
  const engagementQuery = `
    SELECT 
      activity_data->>'feedback_type' as feedback_type,
      COUNT(*) as count
    FROM user_activities 
    WHERE activity_type = 'recommendation_feedback'
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY activity_data->>'feedback_type'
  `

  const engagementResult = await pool.query(engagementQuery)

  // Get top recommended job types
  const jobTypesQuery = `
    SELECT 
      jp.job_type,
      COUNT(*) as recommendation_count
    FROM user_activities ua
    JOIN job_postings jp ON jp.id = (ua.activity_data->>'job_id')::uuid
    WHERE ua.activity_type = 'recommendation_feedback'
      AND ua.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY jp.job_type
    ORDER BY recommendation_count DESC
  `

  const jobTypesResult = await pool.query(jobTypesQuery)

  // Get application conversion rate from recommendations
  const conversionQuery = `
    SELECT 
      COUNT(CASE WHEN ua.activity_data->>'feedback_type' = 'applied' THEN 1 END) as applied_count,
      COUNT(*) as total_feedback_count
    FROM user_activities ua
    WHERE ua.activity_type = 'recommendation_feedback'
      AND ua.created_at >= CURRENT_DATE - INTERVAL '30 days'
  `

  const conversionResult = await pool.query(conversionQuery)
  const conversion = conversionResult.rows[0]
  const conversionRate = conversion.total_feedback_count > 0 
    ? (conversion.applied_count / conversion.total_feedback_count * 100).toFixed(2)
    : 0

  const response: ApiResponse = {
    success: true,
    data: {
      engagement_metrics: engagementResult.rows,
      top_job_types: jobTypesResult.rows,
      conversion_rate: parseFloat(conversionRate as string),
      period: 'Last 30 days'
    },
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

export default router