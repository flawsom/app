import express from 'express'
import { authenticate, authorize } from '../middleware/auth'
import { asyncHandler, CustomError } from '../middleware/errorHandler'
import { ApiResponse } from '../types'
import { Pool } from 'pg'

const router = express.Router()

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// @route   GET /api/v1/certificates/me
// @desc    Get current student's certificates
// @access  Private (Student only)
router.get('/me', [
  authenticate,
  authorize('student')
], asyncHandler(async (req, res) => {
  const userId = req.user!.id

  // Get student profile
  const studentQuery = 'SELECT id FROM student_profiles WHERE user_id = $1'
  const studentResult = await pool.query(studentQuery, [userId])

  if (studentResult.rows.length === 0) {
    throw new CustomError('Student profile not found', 404)
  }

  const studentId = studentResult.rows[0].id

  // Get certificates
  const certificatesQuery = `
    SELECT 
      c.*,
      jp.title as job_title,
      ep.company_name
    FROM certificates c
    LEFT JOIN applications a ON c.application_id = a.id
    LEFT JOIN job_postings jp ON a.job_posting_id = jp.id
    LEFT JOIN employer_profiles ep ON jp.employer_id = ep.id
    WHERE c.student_id = $1
    ORDER BY c.issue_date DESC
  `

  const certificatesResult = await pool.query(certificatesQuery, [studentId])

  const response: ApiResponse = {
    success: true,
    data: certificatesResult.rows,
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

// @route   GET /api/v1/certificates/:id/verify
// @desc    Verify certificate authenticity
// @access  Public
router.get('/:id/verify', asyncHandler(async (req, res) => {
  const certificateId = req.params.id

  const certificateQuery = `
    SELECT 
      c.*,
      sp.first_name,
      sp.last_name,
      sp.student_id,
      jp.title as job_title,
      ep.company_name
    FROM certificates c
    JOIN student_profiles sp ON c.student_id = sp.id
    LEFT JOIN applications a ON c.application_id = a.id
    LEFT JOIN job_postings jp ON a.job_posting_id = jp.id
    LEFT JOIN employer_profiles ep ON jp.employer_id = ep.id
    WHERE c.id = $1 AND c.status = 'issued'
  `

  const certificateResult = await pool.query(certificateQuery, [certificateId])

  if (certificateResult.rows.length === 0) {
    const response: ApiResponse = {
      success: false,
      data: {
        is_valid: false,
        message: 'Certificate not found or not issued'
      },
      timestamp: new Date().toISOString()
    }
    return res.status(404).json(response)
  }

  const certificate = certificateResult.rows[0]

  // In a real implementation, this would verify the blockchain hash
  const blockchainVerification = {
    transaction_hash: certificate.blockchain_tx_id || 'demo_hash_' + certificateId,
    block_number: 12345678,
    timestamp: certificate.issue_date,
    verified: true
  }

  const response: ApiResponse = {
    success: true,
    data: {
      is_valid: true,
      certificate: {
        id: certificate.id,
        title: certificate.title,
        description: certificate.description,
        student_name: `${certificate.first_name} ${certificate.last_name}`,
        student_id: certificate.student_id,
        job_title: certificate.job_title,
        company_name: certificate.company_name,
        issuer_name: certificate.issuer_name,
        issue_date: certificate.issue_date,
        expiry_date: certificate.expiry_date,
        certificate_type: certificate.certificate_type
      },
      blockchain_verification: blockchainVerification
    },
    timestamp: new Date().toISOString()
  }

  res.json(response)
}))

export default router