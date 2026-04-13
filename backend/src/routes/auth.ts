import express, { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import { getPool } from '../database/connection'
import { v4 as uuidv4 } from 'uuid'
import { User, UserRole, ApiResponse } from '../types'
import { asyncHandler, CustomError } from '../middleware/errorHandler'
import { authenticate } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = express.Router()

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['student', 'mentor', 'placement_officer', 'employer']).withMessage('Valid role required'),
  body('first_name').trim().isLength({ min: 1 }).withMessage('First name required'),
  body('last_name').trim().isLength({ min: 1 }).withMessage('Last name required')
]

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
]

// Helper function to generate tokens
const generateTokens = (user: User) => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role
  }

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  })

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  )

  return { accessToken, refreshToken }
}

// @route   POST /api/v1/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerValidation, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const { email, password, role, first_name, last_name } = req.body

  const pool = getPool()

  // Check if user already exists
  const existingUserQuery = 'SELECT id FROM users WHERE email = $1'
  const existingUser = await pool.query(existingUserQuery, [email])
  
  if (existingUser.rows.length > 0) {
    throw new CustomError('User already exists with this email', 400)
  }

  // Hash password
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS!) || 12
  const hashedPassword = await bcrypt.hash(password, saltRounds)

  // Start transaction
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')

    // Create user
    const userId = uuidv4()
    const userQuery = `
      INSERT INTO users (id, email, password_hash, role, is_active, is_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, email, role, is_active, is_verified, created_at, updated_at
    `
    const userResult = await client.query(userQuery, [
      userId, email, hashedPassword, role, true, false
    ])
    const user = userResult.rows[0]

    // Create role-specific profile
    let profileQuery = ''
    let profileValues: any[] = []

    switch (role) {
      case 'student':
        profileQuery = `
          INSERT INTO student_profiles (id, user_id, first_name, last_name, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
        `
        profileValues = [uuidv4(), userId, first_name, last_name]
        break
      
      case 'mentor':
        profileQuery = `
          INSERT INTO mentor_profiles (id, user_id, first_name, last_name, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
        `
        profileValues = [uuidv4(), userId, first_name, last_name]
        break
      
      case 'employer':
        profileQuery = `
          INSERT INTO employer_profiles (id, user_id, company_name, contact_person, contact_email, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `
        profileValues = [uuidv4(), userId, 'Company Name', `${first_name} ${last_name}`, email]
        break
    }

    if (profileQuery) {
      await client.query(profileQuery, profileValues)
    }

    await client.query('COMMIT')

    logger.info(`New user registered: ${email} (${role})`)

    const response: ApiResponse = {
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          isVerified: user.is_verified
        }
      },
      timestamp: new Date().toISOString()
    }

    res.status(201).json(response)

  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}))

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    throw new CustomError('Validation failed: ' + errors.array().map(e => e.msg).join(', '), 400)
  }

  const { email, password } = req.body

  const pool = getPool()

  // Get user from database
  const userQuery = 'SELECT * FROM users WHERE email = $1 AND is_active = true'
  const userResult = await pool.query(userQuery, [email])
  
  if (userResult.rows.length === 0) {
    throw new CustomError('Invalid credentials', 401)
  }

  const user = userResult.rows[0] as User

  // Check password
  const isPasswordValid = await bcrypt.compare(password, user.password_hash)
  if (!isPasswordValid) {
    throw new CustomError('Invalid credentials', 401)
  }

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user)

  // Log successful login
  logger.info(`User logged in: ${email}`)

  const response: ApiResponse = {
    success: true,
    message: 'Login successful',
    data: {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
        isVerified: user.is_verified
      }
    },
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   GET /api/v1/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      user: {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
        isActive: req.user!.is_active,
        isVerified: req.user!.is_verified
      }
    },
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   POST /api/v1/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
  logger.info(`User logged out: ${req.user!.email}`)

  const response: ApiResponse = {
    success: true,
    message: 'Logout successful',
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

export default router