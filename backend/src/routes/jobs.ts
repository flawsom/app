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

// @route   GET /api/v1/jobs
// @desc    Get all job postings
// @access  Public/Private
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['internship', 'training', 'placement', 'project']),
  query('location').optional().trim(),
  query('remote').optional().isBoolean(),
  query('skills').optional()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const offset = (page - 1) * limit
  const jobType = req.query.type as string
  const location = req.query.location as string
  const isRemote = req.query.remote === 'true'
  const skills = req.query.skills as string

  let whereClause = "WHERE jp.status = 'active' AND jp.application_deadline > CURRENT_DATE"
  const queryParams: any[] = []
  let paramCount = 0

  if (jobType) {
    paramCount++
    whereClause += ` AND jp.job_type = $${paramCount}`
    queryParams.push(jobType)
  }

  if (location) {
    paramCount++
    whereClause += ` AND jp.location ILIKE $${paramCount}`
    queryParams.push(`%${location}%`)
  }

  if (isRemote) {
    whereClause += ` AND jp.is_remote = true`
  }

  if (skills) {
    const skillArray = skills.split(',').map(s => s.trim())
    paramCount++
    whereClause += ` AND EXISTS (
      SELECT 1 FROM unnest(jp.required_skills) AS skill_id
      JOIN skills s ON s.id = skill_id
      WHERE s.name = ANY($${paramCount})
    )`
    queryParams.push(skillArray)
  }

  // Count total records
  const countQuery = `
    SELECT COUNT(*) as total
    FROM job_postings jp
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    ${whereClause}
  `
  const countResult = await pool.query(countQuery, queryParams)
  const total = parseInt(countResult.rows[0].total)

  // Get job postings with pagination
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
      ) as preferred_skills_details,
      (
        SELECT COUNT(*)
        FROM applications a
        WHERE a.job_posting_id = jp.id
      ) as application_count
    FROM job_postings jp
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    ${whereClause}
    ORDER BY jp.created_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `
  
  queryParams.push(limit, offset)
  const jobsResult = await pool.query(jobsQuery, queryParams)

  const response: PaginatedResponse<any> = {
    data: jobsResult.rows,
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

// @route   POST /api/v1/jobs
// @desc    Create job posting
// @access  Private (Employer/Placement Officer)
router.post('/', [
  authenticate,
  authorize('employer', 'placement_officer'),
  body('title').trim().isLength({ min: 1, max: 200 }),
  body('description').trim().isLength({ min: 10 }),
  body('job_type').isIn(['internship', 'training', 'placement', 'project']),
  body('location').trim().isLength({ min: 1 }),
  body('is_remote').optional().isBoolean(),
  body('stipend_min').optional().isInt({ min: 0 }),
  body('stipend_max').optional().isInt({ min: 0 }),
  body('duration_months').optional().isInt({ min: 1, max: 24 }),
  body('required_skills').isArray({ min: 1 }),
  body('preferred_skills').optional().isArray(),
  body('application_deadline').isISO8601(),
  body('start_date').isISO8601(),
  body('max_applicants').optional().isInt({ min: 1 }),
  body('conversion_opportunity').optional().isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const userId = req.user!.id
  let employerId: string

  // Get employer profile ID
  if (req.user!.role === 'employer') {
    const employerQuery = 'SELECT id FROM employer_profiles WHERE user_id = $1'
    const employerResult = await pool.query(employerQuery, [userId])
    
    if (employerResult.rows.length === 0) {
      throw new CustomError('Employer profile not found', 404)
    }
    
    employerId = employerResult.rows[0].id
  } else {
    // For placement officers, they can create jobs on behalf of employers
    // For now, we'll require employer_id in the request body
    if (!req.body.employer_id) {
      throw new CustomError('Employer ID required for placement officer', 400)
    }
    employerId = req.body.employer_id
  }

  const {
    title,
    description,
    job_type,
    location,
    is_remote = false,
    stipend_min,
    stipend_max,
    duration_months,
    required_skills,
    preferred_skills = [],
    application_deadline,
    start_date,
    max_applicants,
    conversion_opportunity = false,
    eligibility_criteria = {}
  } = req.body

  // Validate skills exist
  const allSkills = [...required_skills, ...preferred_skills]
  if (allSkills.length > 0) {
    const skillCheckQuery = 'SELECT id FROM skills WHERE id = ANY($1)'
    const skillCheckResult = await pool.query(skillCheckQuery, [allSkills])
    
    if (skillCheckResult.rows.length !== allSkills.length) {
      throw new CustomError('One or more skills not found', 400)
    }
  }

  // Validate dates
  const deadlineDate = new Date(application_deadline)
  const startDate = new Date(start_date)
  const now = new Date()

  if (deadlineDate <= now) {
    throw new CustomError('Application deadline must be in the future', 400)
  }

  if (startDate <= deadlineDate) {
    throw new CustomError('Start date must be after application deadline', 400)
  }

  const jobId = uuidv4()
  const insertQuery = `
    INSERT INTO job_postings (
      id, employer_id, title, description, job_type, location, is_remote,
      stipend_min, stipend_max, duration_months, required_skills, preferred_skills,
      eligibility_criteria, application_deadline, start_date, max_applicants,
      conversion_opportunity, created_by, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'active'
    ) RETURNING *
  `

  const insertResult = await pool.query(insertQuery, [
    jobId, employerId, title, description, job_type, location, is_remote,
    stipend_min, stipend_max, duration_months, required_skills, preferred_skills,
    eligibility_criteria, application_deadline, start_date, max_applicants,
    conversion_opportunity, userId
  ])

  const response: ApiResponse = {
    success: true,
    message: 'Job posting created successfully',
    data: insertResult.rows[0],
    timestamp: new Date().toISOString()
  }

  res.status(201).json(response)
}))

// @route   GET /api/v1/jobs/:id
// @desc    Get job posting by ID
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const jobId = req.params.id

  const jobQuery = `
    SELECT 
      jp.*,
      ep.company_name,
      ep.company_website,
      ep.company_size,
      ep.industry,
      ep.contact_person,
      ep.contact_email,
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
      ) as preferred_skills_details,
      (
        SELECT COUNT(*)
        FROM applications a
        WHERE a.job_posting_id = jp.id
      ) as application_count,
      (
        SELECT COUNT(*)
        FROM applications a
        WHERE a.job_posting_id = jp.id AND a.status = 'selected'
      ) as selection_count
    FROM job_postings jp
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    WHERE jp.id = $1
  `

  const jobResult = await pool.query(jobQuery, [jobId])

  if (jobResult.rows.length === 0) {
    throw new CustomError('Job posting not found', 404)
  }

  const response: ApiResponse = {
    success: true,
    data: jobResult.rows[0],
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   PUT /api/v1/jobs/:id
// @desc    Update job posting
// @access  Private (Employer/Placement Officer - own jobs only)
router.put('/:id', [
  authenticate,
  authorize('employer', 'placement_officer'),
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('description').optional().trim().isLength({ min: 10 }),
  body('location').optional().trim().isLength({ min: 1 }),
  body('is_remote').optional().isBoolean(),
  body('stipend_min').optional().isInt({ min: 0 }),
  body('stipend_max').optional().isInt({ min: 0 }),
  body('duration_months').optional().isInt({ min: 1, max: 24 }),
  body('required_skills').optional().isArray({ min: 1 }),
  body('preferred_skills').optional().isArray(),
  body('application_deadline').optional().isISO8601(),
  body('start_date').optional().isISO8601(),
  body('max_applicants').optional().isInt({ min: 1 }),
  body('status').optional().isIn(['draft', 'active', 'paused', 'closed'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const jobId = req.params.id
  const userId = req.user!.id
  const updateFields = req.body

  // Check if job exists and user has permission to update
  let jobCheckQuery = `
    SELECT jp.*, ep.user_id as employer_user_id
    FROM job_postings jp
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    WHERE jp.id = $1
  `
  
  const jobCheckResult = await pool.query(jobCheckQuery, [jobId])

  if (jobCheckResult.rows.length === 0) {
    throw new CustomError('Job posting not found', 404)
  }

  const job = jobCheckResult.rows[0]

  // Check permissions
  if (req.user!.role === 'employer' && job.employer_user_id !== userId) {
    throw new CustomError('You can only update your own job postings', 403)
  }

  // Build dynamic update query
  const allowedFields = [
    'title', 'description', 'location', 'is_remote', 'stipend_min', 'stipend_max',
    'duration_months', 'required_skills', 'preferred_skills', 'application_deadline',
    'start_date', 'max_applicants', 'status', 'conversion_opportunity'
  ]
  
  const updatePairs: string[] = []
  const queryParams: any[] = []
  let paramCount = 0

  Object.keys(updateFields).forEach(field => {
    if (allowedFields.includes(field) && updateFields[field] !== undefined) {
      paramCount++
      updatePairs.push(`${field} = $${paramCount}`)
      queryParams.push(updateFields[field])
    }
  })

  if (updatePairs.length === 0) {
    throw new CustomError('No valid fields to update', 400)
  }

  // Validate skills if provided
  if (updateFields.required_skills || updateFields.preferred_skills) {
    const allSkills = [
      ...(updateFields.required_skills || job.required_skills),
      ...(updateFields.preferred_skills || job.preferred_skills)
    ]
    
    if (allSkills.length > 0) {
      const skillCheckQuery = 'SELECT id FROM skills WHERE id = ANY($1)'
      const skillCheckResult = await pool.query(skillCheckQuery, [allSkills])
      
      if (skillCheckResult.rows.length !== allSkills.length) {
        throw new CustomError('One or more skills not found', 400)
      }
    }
  }

  paramCount++
  queryParams.push(jobId)

  const updateQuery = `
    UPDATE job_postings 
    SET ${updatePairs.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${paramCount}
    RETURNING *
  `

  const updateResult = await pool.query(updateQuery, queryParams)

  const response: ApiResponse = {
    success: true,
    message: 'Job posting updated successfully',
    data: updateResult.rows[0],
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   DELETE /api/v1/jobs/:id
// @desc    Delete job posting
// @access  Private (Employer/Placement Officer - own jobs only)
router.delete('/:id', [
  authenticate,
  authorize('employer', 'placement_officer', 'admin')
], asyncHandler(async (req, res) => {
  const jobId = req.params.id
  const userId = req.user!.id

  // Check if job exists and user has permission to delete
  let jobCheckQuery = `
    SELECT jp.*, ep.user_id as employer_user_id
    FROM job_postings jp
    JOIN employer_profiles ep ON jp.employer_id = ep.id
    WHERE jp.id = $1
  `
  
  const jobCheckResult = await pool.query(jobCheckQuery, [jobId])

  if (jobCheckResult.rows.length === 0) {
    throw new CustomError('Job posting not found', 404)
  }

  const job = jobCheckResult.rows[0]

  // Check permissions (admin can delete any job)
  if (req.user!.role !== 'admin' && req.user!.role === 'employer' && job.employer_user_id !== userId) {
    throw new CustomError('You can only delete your own job postings', 403)
  }

  // Check if there are any applications
  const applicationCheckQuery = 'SELECT COUNT(*) as count FROM applications WHERE job_posting_id = $1'
  const applicationCheckResult = await pool.query(applicationCheckQuery, [jobId])
  const applicationCount = parseInt(applicationCheckResult.rows[0].count)

  if (applicationCount > 0) {
    // Instead of deleting, mark as closed
    const closeQuery = 'UPDATE job_postings SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2'
    await pool.query(closeQuery, ['closed', jobId])

    const response: ApiResponse = {
      success: true,
      message: 'Job posting closed due to existing applications',
      timestamp: new Date().toISOString()
    }

    return res.json(response)
  }

  // Delete job posting
  const deleteQuery = 'DELETE FROM job_postings WHERE id = $1'
  await pool.query(deleteQuery, [jobId])

  const response: ApiResponse = {
    success: true,
    message: 'Job posting deleted successfully',
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

export default router