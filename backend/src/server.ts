import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import rateLimit from 'express-rate-limit'
import path from 'path'

// Import database
import { runMigrations, testConnection } from './database/connection'

// Import routes
import authRoutes from './routes/auth'
import userRoutes from './routes/users'
import studentRoutes from './routes/students'
import jobRoutes from './routes/jobs'
import applicationRoutes from './routes/applications'
import recommendationRoutes from './routes/recommendations'
import certificateRoutes from './routes/certificates'
import skillRoutes from './routes/skills'

// Import middleware
import { errorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging middleware
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }))

// Health check endpoint
app.get('/health', async (req, res) => {
  const dbStatus = await testConnection()
  
  res.status(dbStatus ? 200 : 503).json({
    status: dbStatus ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus ? 'connected' : 'disconnected'
  })
})

// API routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/students', studentRoutes)
app.use('/api/v1/jobs', jobRoutes)
app.use('/api/v1/applications', applicationRoutes)
app.use('/api/v1/recommendations', recommendationRoutes)
app.use('/api/v1/certificates', certificateRoutes)
app.use('/api/v1/skills', skillRoutes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  })
})

// Global error handler
app.use(errorHandler)

// Initialize database and start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection()
    if (!dbConnected) {
      throw new Error('Database connection failed')
    }

    // Run migrations
    await runMigrations()

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Project UNIFY Backend Server running on port ${PORT}`)
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`)
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api/v1`)
    })

  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully')
  process.exit(0)
})

// Start the server
startServer()

export default app