import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Pool } from 'pg'
import { JWTPayload, User, UserRole } from '../types'
import { CustomError } from './errorHandler'

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new CustomError('Access token required', 401)
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new CustomError('Access token required', 401)
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
    
    // Get user from database
    const userQuery = 'SELECT * FROM users WHERE id = $1 AND is_active = true'
    const userResult = await pool.query(userQuery, [decoded.sub])
    
    if (userResult.rows.length === 0) {
      throw new CustomError('User not found or inactive', 401)
    }

    const user = userResult.rows[0] as User
    req.user = user
    
    next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new CustomError('Invalid token', 401))
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new CustomError('Token expired', 401))
    } else {
      next(error)
    }
  }
}

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new CustomError('Authentication required', 401))
    }

    if (!roles.includes(req.user.role)) {
      return next(new CustomError('Insufficient permissions', 403))
    }

    next()
  }
}

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload
        
        const userQuery = 'SELECT * FROM users WHERE id = $1 AND is_active = true'
        const userResult = await pool.query(userQuery, [decoded.sub])
        
        if (userResult.rows.length > 0) {
          req.user = userResult.rows[0] as User
        }
      }
    }
    
    next()
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    next()
  }
}

// Role-based access control helpers
export const canAccessResource = (user: User, resourceOwnerId: string, allowedRoles: UserRole[] = []): boolean => {
  // Admin can access everything
  if (user.role === 'admin') {
    return true
  }
  
  // User can access their own resources
  if (user.id === resourceOwnerId) {
    return true
  }
  
  // Check if user role is in allowed roles
  return allowedRoles.includes(user.role)
}

export const requireOwnershipOrRole = (allowedRoles: UserRole[] = []) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new CustomError('Authentication required', 401))
    }

    const resourceId = req.params.id || req.params.userId || req.body.userId
    
    if (!resourceId) {
      return next(new CustomError('Resource ID required', 400))
    }

    if (canAccessResource(req.user, resourceId, allowedRoles)) {
      return next()
    }

    next(new CustomError('Access denied', 403))
  }
}

// Middleware to check if user has completed profile
export const requireCompleteProfile = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new CustomError('Authentication required', 401))
  }

  try {
    let profileQuery = ''
    let profileTable = ''
    
    switch (req.user.role) {
      case 'student':
        profileTable = 'student_profiles'
        break
      case 'mentor':
        profileTable = 'mentor_profiles'
        break
      case 'employer':
        profileTable = 'employer_profiles'
        break
      default:
        return next() // Admin and placement officers don't need profile check
    }

    profileQuery = `SELECT id FROM ${profileTable} WHERE user_id = $1`
    const profileResult = await pool.query(profileQuery, [req.user.id])
    
    if (profileResult.rows.length === 0) {
      return next(new CustomError('Profile completion required', 400))
    }

    next()
  } catch (error) {
    next(error)
  }
}