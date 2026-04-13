import express from 'express'
import { body, query, validationResult } from 'express-validator'
import { Pool } from 'pg'
import { authenticate, authorize } from '../middleware/auth'
import { asyncHandler, CustomError } from '../middleware/errorHandler'
import { ApiResponse, PaginatedResponse } from '../types'

const router = express.Router()

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// @route   GET /api/v1/students
// @desc    Get all students (admin/placement officer only)
// @access  Private
router.get('/', [
  authenticate,
  authorize('admin', 'placement_officer'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('department').optional().trim(),
  query('semester').optional().isInt({ min: 1, max: 8 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const offset = (page - 1) * limit
  const department = req.query.department as string
  const semester = req.query.semester as string

  let whereClause = 'WHERE 1=1'
  const queryParams: any[] = []
  let paramCount = 0

  if (department) {
    paramCount++
    whereClause += ` AND sp.department = $${paramCount}`
    queryParams.push(department)
  }

  if (semester) {
    paramCount++
    whereClause += ` AND sp.semester = $${paramCount}`
    queryParams.push(parseInt(semester))
  }

  // Count total records
  const countQuery = `
    SELECT COUNT(*) as total
    FROM student_profiles sp
    JOIN users u ON sp.user_id = u.id
    ${whereClause}
  `
  const countResult = await pool.query(countQuery, queryParams)
  const total = parseInt(countResult.rows[0].total)

  // Get students with pagination
  const studentsQuery = `
    SELECT 
      sp.*,
      u.email,
      u.is_active,
      u.is_verified,
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
      ) as skills,
      (
        SELECT COUNT(*)
        FROM applications a
        WHERE a.student_id = sp.id
      ) as application_count
    FROM student_profiles sp
    JOIN users u ON sp.user_id = u.id
    ${whereClause}
    ORDER BY sp.created_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `
  
  queryParams.push(limit, offset)
  const studentsResult = await pool.query(studentsQuery, queryParams)

  const response: PaginatedResponse<any> = {
    data: studentsResult.rows,
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

// @route   GET /api/v1/students/me
// @desc    Get current student profile
// @access  Private (Student only)
router.get('/me', [
  authenticate,
  authorize('student')
], asyncHandler(async (req, res) => {
  const userId = req.user!.id

  const profileQuery = `
    SELECT 
      sp.*,
      u.email,
      u.is_active,
      u.is_verified,
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
      ) as skills,
      (
        SELECT json_agg(
          json_build_object(
            'id', sb.id,
            'badge', json_build_object('id', b.id, 'name', b.name, 'badge_type', b.badge_type, 'points', b.points),
            'semester', sb.semester,
            'earned_date', sb.earned_date,
            'verification_status', sb.verification_status
          )
        )
        FROM student_badges sb
        JOIN badges b ON sb.badge_id = b.id
        WHERE sb.student_id = sp.id
      ) as badges
    FROM student_profiles sp
    JOIN users u ON sp.user_id = u.id
    WHERE sp.user_id = $1
  `

  const profileResult = await pool.query(profileQuery, [userId])

  if (profileResult.rows.length === 0) {
    throw new CustomError('Student profile not found', 404)
  }

  const response: ApiResponse = {
    success: true,
    data: profileResult.rows[0],
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   PUT /api/v1/students/me
// @desc    Update current student profile
// @access  Private (Student only)
router.put('/me', [
  authenticate,
  authorize('student'),
  body('first_name').optional().trim().isLength({ min: 1 }),
  body('last_name').optional().trim().isLength({ min: 1 }),
  body('student_id').optional().trim().isLength({ min: 1 }),
  body('department').optional().trim(),
  body('semester').optional().isInt({ min: 1, max: 8 }),
  body('cgpa').optional().isFloat({ min: 0, max: 10 }),
  body('phone').optional().trim(),
  body('linkedin_url').optional().isURL(),
  body('github_url').optional().isURL(),
  body('bio').optional().trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const userId = req.user!.id
  const updateFields = req.body

  // Check if profile exists
  const existingProfileQuery = 'SELECT id FROM student_profiles WHERE user_id = $1'
  const existingProfile = await pool.query(existingProfileQuery, [userId])

  if (existingProfile.rows.length === 0) {
    throw new CustomError('Student profile not found', 404)
  }

  // Build dynamic update query
  const allowedFields = [
    'first_name', 'last_name', 'student_id', 'department', 'semester', 
    'cgpa', 'phone', 'linkedin_url', 'github_url', 'bio'
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

  paramCount++
  queryParams.push(userId)

  const updateQuery = `
    UPDATE student_profiles 
    SET ${updatePairs.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $${paramCount}
    RETURNING *
  `

  const updateResult = await pool.query(updateQuery, queryParams)

  const response: ApiResponse = {
    success: true,
    message: 'Profile updated successfully',
    data: updateResult.rows[0],
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   POST /api/v1/students/me/skills
// @desc    Add skills to student profile
// @access  Private (Student only)
router.post('/me/skills', [
  authenticate,
  authorize('student'),
  body('skills').isArray({ min: 1 }),
  body('skills.*.skill_id').isUUID(),
  body('skills.*.proficiency_level').isInt({ min: 1, max: 5 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const userId = req.user!.id
  const { skills } = req.body

  // Get student profile ID
  const profileQuery = 'SELECT id FROM student_profiles WHERE user_id = $1'
  const profileResult = await pool.query(profileQuery, [userId])

  if (profileResult.rows.length === 0) {
    throw new CustomError('Student profile not found', 404)
  }

  const studentId = profileResult.rows[0].id

  // Verify all skills exist
  const skillIds = skills.map((s: any) => s.skill_id)
  const skillCheckQuery = 'SELECT id FROM skills WHERE id = ANY($1)'
  const skillCheckResult = await pool.query(skillCheckQuery, [skillIds])

  if (skillCheckResult.rows.length !== skillIds.length) {
    throw new CustomError('One or more skills not found', 400)
  }

  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')

    // Remove existing skills for this student
    await client.query('DELETE FROM student_skills WHERE student_id = $1', [studentId])

    // Insert new skills
    for (const skill of skills) {
      await client.query(
        'INSERT INTO student_skills (student_id, skill_id, proficiency_level) VALUES ($1, $2, $3)',
        [studentId, skill.skill_id, skill.proficiency_level]
      )
    }

    await client.query('COMMIT')

    const response: ApiResponse = {
      success: true,
      message: 'Skills updated successfully',
      timestamp: new Date().toISOString()
    }

    res.json(response)

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// @route   GET /api/v1/students/:id
// @desc    Get student profile by ID
// @access  Private (Admin/Placement Officer/Mentor)
router.get('/:id', [
  authenticate,
  authorize('admin', 'placement_officer', 'mentor', 'employer')
], asyncHandler(async (req, res) => {
  const studentId = req.params.id

  const profileQuery = `
    SELECT 
      sp.*,
      u.email,
      u.is_active,
      u.is_verified,
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
      ) as skills,
      (
        SELECT json_agg(
          json_build_object(
            'id', sb.id,
            'badge', json_build_object('id', b.id, 'name', b.name, 'badge_type', b.badge_type),
            'semester', sb.semester,
            'earned_date', sb.earned_date,
            'verification_status', sb.verification_status
          )
        )
        FROM student_badges sb
        JOIN badges b ON sb.badge_id = b.id
        WHERE sb.student_id = sp.id
      ) as badges,
      (
        SELECT COUNT(*)
        FROM applications a
        WHERE a.student_id = sp.id
      ) as application_count,
      (
        SELECT COUNT(*)
        FROM applications a
        WHERE a.student_id = sp.id AND a.status = 'selected'
      ) as placement_count
    FROM student_profiles sp
    JOIN users u ON sp.user_id = u.id
    WHERE sp.id = $1
  `

  const profileResult = await pool.query(profileQuery, [studentId])

  if (profileResult.rows.length === 0) {
    throw new CustomError('Student not found', 404)
  }

  // For employers, only return limited information based on consent
  if (req.user!.role === 'employer') {
    const student = profileResult.rows[0]
    const limitedProfile = {
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      department: student.department,
      semester: student.semester,
      cgpa: student.cgpa,
      skills: student.skills,
      badges: student.badges,
      // Don't include personal contact information
    }
    
    const response: ApiResponse = {
      success: true,
      data: limitedProfile,
      timestamp: new Date().toISOString()
    }

    return res.json(response)
  }

  const response: ApiResponse = {
    success: true,
    data: profileResult.rows[0],
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

export default router