import express from 'express'
import { query, validationResult } from 'express-validator'
import { getPool } from '../database/connection'
import { authenticate, authorize } from '../middleware/auth'
import { asyncHandler, CustomError } from '../middleware/errorHandler'
import { ApiResponse } from '../types'

const router = express.Router()

// @route   GET /api/v1/skills
// @desc    Get all skills
// @access  Public
router.get('/', [
  query('category').optional().isIn(['technical', 'soft_skill', 'language', 'certification']),
  query('search').optional().trim()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const category = req.query.category as string
  const search = req.query.search as string

  let whereClause = 'WHERE 1=1'
  const queryParams: any[] = []
  let paramCount = 0

  if (category) {
    paramCount++
    whereClause += ` AND category = $${paramCount}`
    queryParams.push(category)
  }

  if (search) {
    paramCount++
    whereClause += ` AND name ILIKE $${paramCount}`
    queryParams.push(`%${search}%`)
  }

  const skillsQuery = `
    SELECT id, name, category, description, created_at
    FROM skills
    ${whereClause}
    ORDER BY category, name
  `

  const pool = getPool()
  const skillsResult = await pool.query(skillsQuery, queryParams)

  const response: ApiResponse = {
    success: true,
    data: skillsResult.rows,
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   GET /api/v1/skills/categories
// @desc    Get skill categories with counts
// @access  Public
router.get('/categories', asyncHandler(async (req, res) => {
  const categoriesQuery = `
    SELECT 
      category,
      COUNT(*) as skill_count
    FROM skills
    GROUP BY category
    ORDER BY category
  `

  const pool = getPool()
  const categoriesResult = await pool.query(categoriesQuery)

  const response: ApiResponse = {
    success: true,
    data: categoriesResult.rows,
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

export default router