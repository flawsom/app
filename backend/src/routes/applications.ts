import express from 'express'
import { body, query, validationResult } from 'express-validator'
import { Pool } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import { authenticate, authorize } from '../middleware/auth'
import { asyncHandler, CustomError } from '../middleware/errorHandler'
import { ApiResponse, PaginatedResponse } from '../types'

const router = express.Router()

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// @route   POST /api/v1/applications
// @desc    Submit job application
// @access  Private (Student only)
router.post('/', [
  authenticate,
  authorize('student'),
  body('job_posting_id').isUUID(),
  body('cover_letter').optional().trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const userId = req.user!.id
  const { job_posting_id, cover_letter } = req.body

  // Get student profile
  const studentQuery = 'SELECT id FROM student_profiles WHERE user_id = $1'
  const studentResult = await pool.query(studentQuery, [userId])

  if (studentResult.rows.length === 0) {
    throw new CustomError('Student profile not found', 404)
  }

  const studentId = studentResult.rows[0].id

  // Check if job posting exists and is active
  const jobQuery = `
    SELECT jp.*, ep.company_name
    FROM job_postings jp
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    WHERE jp.id = $1 AND jp.status = 'active' AND jp.application_deadline > CURRENT_DATE
  `
  const jobResult = await pool.query(jobQuery, [job_posting_id])

  if (jobResult.rows.length === 0) {
    throw new CustomError('Job posting not found or not accepting applications', 404)
  }

  const job = jobResult.rows[0]

  // Check if student already applied
  const existingApplicationQuery = 'SELECT id FROM applications WHERE student_id = $1 AND job_posting_id = $2'
  const existingApplication = await pool.query(existingApplicationQuery, [studentId, job_posting_id])

  if (existingApplication.rows.length > 0) {
    throw new CustomError('You have already applied for this position', 400)
  }

  // Check if max applicants reached
  if (job.max_applicants) {
    const applicationCountQuery = 'SELECT COUNT(*) as count FROM applications WHERE job_posting_id = $1'
    const applicationCountResult = await pool.query(applicationCountQuery, [job_posting_id])
    const currentApplications = parseInt(applicationCountResult.rows[0].count)

    if (currentApplications >= job.max_applicants) {
      throw new CustomError('Maximum number of applications reached for this position', 400)
    }
  }

  // Get assigned mentor
  const mentorQuery = `
    SELECT mp.id
    FROM mentor_student_assignments msa
    JOIN mentor_profiles mp ON msa.mentor_id = mp.id
    WHERE msa.student_id = $1 AND msa.is_active = true
    LIMIT 1
  `
  const mentorResult = await pool.query(mentorQuery, [studentId])
  const mentorId = mentorResult.rows.length > 0 ? mentorResult.rows[0].id : null

  // Calculate basic matching score (simplified version)
  // In production, this would be handled by the AI service
  let matchingScore = 0
  // This is a placeholder - real matching would be more sophisticated
  matchingScore = Math.random() * 40 + 60 // Random score between 60-100

  const applicationId = uuidv4()
  const insertQuery = `
    INSERT INTO applications (
      id, student_id, job_posting_id, mentor_id, cover_letter, 
      matching_score, status, mentor_approval_status
    ) VALUES ($1, $2, $3, $4, $5, $6, 'submitted', 'pending')
    RETURNING *
  `

  const insertResult = await pool.query(insertQuery, [
    applicationId, studentId, job_posting_id, mentorId, cover_letter, matchingScore
  ])

  // Create notification for mentor if assigned
  if (mentorId) {
    const mentorUserQuery = 'SELECT user_id FROM mentor_profiles WHERE id = $1'
    const mentorUserResult = await pool.query(mentorUserQuery, [mentorId])
    
    if (mentorUserResult.rows.length > 0) {
      const mentorUserId = mentorUserResult.rows[0].user_id
      await pool.query(
        'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
        [
          mentorUserId,
          'New Application Approval Required',
          `A student has applied for ${job.title} at ${job.company_name} and needs your approval.`,
          'warning'
        ]
      )
    }
  }

  const response: ApiResponse = {
    success: true,
    message: 'Application submitted successfully',
    data: insertResult.rows[0],
    timestamp: new Date().toISOString()
  }

  res.status(201).json(response)
}))

// @route   GET /api/v1/applications/me
// @desc    Get current student's applications
// @access  Private (Student only)
router.get('/me', [
  authenticate,
  authorize('student'),
  query('status').optional().isIn(['submitted', 'under_review', 'shortlisted', 'interview_scheduled', 'selected', 'rejected', 'withdrawn'])
], asyncHandler(async (req, res) => {
  const userId = req.user!.id
  const status = req.query.status as string

  // Get student profile
  const studentQuery = 'SELECT id FROM student_profiles WHERE user_id = $1'
  const studentResult = await pool.query(studentQuery, [userId])

  if (studentResult.rows.length === 0) {
    throw new CustomError('Student profile not found', 404)
  }

  const studentId = studentResult.rows[0].id

  let whereClause = 'WHERE a.student_id = $1'
  const queryParams = [studentId]

  if (status) {
    whereClause += ' AND a.status = $2'
    queryParams.push(status)
  }

  const applicationsQuery = `
    SELECT 
      a.*,
      jp.title as job_title,
      jp.job_type,
      jp.location,
      jp.stipend_min,
      jp.stipend_max,
      jp.application_deadline,
      jp.start_date,
      ep.company_name,
      ep.company_size,
      ep.industry,
      mp.first_name as mentor_first_name,
      mp.last_name as mentor_last_name
    FROM applications a
    JOIN job_postings jp ON a.job_posting_id = jp.id
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    LEFT JOIN mentor_profiles mp ON a.mentor_id = mp.id
    ${whereClause}
    ORDER BY a.applied_at DESC
  `

  const applicationsResult = await pool.query(applicationsQuery, queryParams)

  const response: ApiResponse = {
    success: true,
    data: applicationsResult.rows,
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   PUT /api/v1/applications/:id/mentor-approval
// @desc    Mentor approval for application
// @access  Private (Mentor only)
router.put('/:id/mentor-approval', [
  authenticate,
  authorize('mentor'),
  body('approval_status').isIn(['approved', 'rejected']),
  body('comments').optional().trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const applicationId = req.params.id
  const userId = req.user!.id
  const { approval_status, comments } = req.body

  // Get mentor profile
  const mentorQuery = 'SELECT id FROM mentor_profiles WHERE user_id = $1'
  const mentorResult = await pool.query(mentorQuery, [userId])

  if (mentorResult.rows.length === 0) {
    throw new CustomError('Mentor profile not found', 404)
  }

  const mentorId = mentorResult.rows[0].id

  // Check if application exists and belongs to this mentor
  const applicationQuery = `
    SELECT a.*, sp.first_name, sp.last_name, jp.title as job_title, ep.company_name
    FROM applications a
    JOIN student_profiles sp ON a.student_id = sp.id
    JOIN job_postings jp ON a.job_posting_id = jp.id
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    WHERE a.id = $1 AND a.mentor_id = $2
  `
  const applicationResult = await pool.query(applicationQuery, [applicationId, mentorId])

  if (applicationResult.rows.length === 0) {
    throw new CustomError('Application not found or not assigned to you', 404)
  }

  const application = applicationResult.rows[0]

  if (application.mentor_approval_status !== 'pending') {
    throw new CustomError('Application has already been reviewed', 400)
  }

  // Update application
  const updateQuery = `
    UPDATE applications 
    SET mentor_approval_status = $1, mentor_comments = $2, mentor_reviewed_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `

  const updateResult = await pool.query(updateQuery, [approval_status, comments, applicationId])

  // Create notification for student
  const studentUserQuery = 'SELECT user_id FROM student_profiles WHERE id = $1'
  const studentUserResult = await pool.query(studentUserQuery, [application.student_id])

  if (studentUserResult.rows.length > 0) {
    const studentUserId = studentUserResult.rows[0].user_id
    const notificationMessage = approval_status === 'approved' 
      ? `Your application for ${application.job_title} at ${application.company_name} has been approved by your mentor.`
      : `Your application for ${application.job_title} at ${application.company_name} has been rejected by your mentor. ${comments ? 'Reason: ' + comments : ''}`

    await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [
        studentUserId,
        `Application ${approval_status === 'approved' ? 'Approved' : 'Rejected'}`,
        notificationMessage,
        approval_status === 'approved' ? 'success' : 'error'
      ]
    )
  }

  const response: ApiResponse = {
    success: true,
    message: `Application ${approval_status} successfully`,
    data: updateResult.rows[0],
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   GET /api/v1/applications
// @desc    Get applications (for mentors, placement officers, employers)
// @access  Private
router.get('/', [
  authenticate,
  authorize('mentor', 'placement_officer', 'employer', 'admin'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional(),
  query('job_id').optional().isUUID()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const userId = req.user!.id
  const userRole = req.user!.role
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const offset = (page - 1) * limit
  const status = req.query.status as string
  const jobId = req.query.job_id as string

  let whereClause = 'WHERE 1=1'
  const queryParams: any[] = []
  let paramCount = 0

  // Role-based filtering
  if (userRole === 'mentor') {
    const mentorQuery = 'SELECT id FROM mentor_profiles WHERE user_id = $1'
    const mentorResult = await pool.query(mentorQuery, [userId])
    
    if (mentorResult.rows.length === 0) {
      throw new CustomError('Mentor profile not found', 404)
    }
    
    paramCount++
    whereClause += ` AND a.mentor_id = $${paramCount}`
    queryParams.push(mentorResult.rows[0].id)
  } else if (userRole === 'employer') {
    const employerQuery = 'SELECT id FROM employer_profiles WHERE user_id = $1'
    const employerResult = await pool.query(employerQuery, [userId])
    
    if (employerResult.rows.length === 0) {
      throw new CustomError('Employer profile not found', 404)
    }
    
    paramCount++
    whereClause += ` AND jp.employer_id = $${paramCount}`
    queryParams.push(employerResult.rows[0].id)
  }

  if (status) {
    paramCount++
    whereClause += ` AND a.status = $${paramCount}`
    queryParams.push(status)
  }

  if (jobId) {
    paramCount++
    whereClause += ` AND a.job_posting_id = $${paramCount}`
    queryParams.push(jobId)
  }

  // Count total records
  const countQuery = `
    SELECT COUNT(*) as total
    FROM applications a
    JOIN job_postings jp ON a.job_posting_id = jp.id
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    ${whereClause}
  `
  const countResult = await pool.query(countQuery, queryParams)
  const total = parseInt(countResult.rows[0].total)

  // Get applications with pagination
  const applicationsQuery = `
    SELECT 
      a.*,
      sp.first_name as student_first_name,
      sp.last_name as student_last_name,
      sp.student_id,
      sp.department,
      sp.semester,
      sp.cgpa,
      jp.title as job_title,
      jp.job_type,
      jp.location,
      jp.stipend_min,
      jp.stipend_max,
      ep.company_name,
      mp.first_name as mentor_first_name,
      mp.last_name as mentor_last_name
    FROM applications a
    JOIN student_profiles sp ON a.student_id = sp.id
    JOIN job_postings jp ON a.job_posting_id = jp.id
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    LEFT JOIN mentor_profiles mp ON a.mentor_id = mp.id
    ${whereClause}
    ORDER BY a.applied_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `
  
  queryParams.push(limit, offset)
  const applicationsResult = await pool.query(applicationsQuery, queryParams)

  const response: PaginatedResponse<any> = {
    data: applicationsResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  }

  res.json({
    success: true,
    ...response,
    timestamp: new Date().toISOString()
  })
}))

export default router