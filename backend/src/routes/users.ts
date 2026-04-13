import express from 'express'
import { authenticate, authorize } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../types'

const router = express.Router()

// @route   GET /api/v1/users/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const response: ApiResponse = {
    success: true,
    data: {
      user: {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
        isActive: req.user!.is_active,
        isVerified: req.user!.is_verified,
        createdAt: req.user!.created_at,
        updatedAt: req.user!.updated_at
      }
    },
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

export default router