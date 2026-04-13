import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'
import { AppError } from '../types'

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err }
  error.message = err.message

  // Log error
  logger.error(err)

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found'
    error = { ...error, message, statusCode: 404, isOperational: true }
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered'
    error = { ...error, message, statusCode: 400, isOperational: true }
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {}).map((val: any) => val.message).join(', ')
    error = { ...error, message, statusCode: 400, isOperational: true }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token'
    error = { ...error, message, statusCode: 401, isOperational: true }
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired'
    error = { ...error, message, statusCode: 401, isOperational: true }
  }

  // PostgreSQL errors
  if (err.code === '23505') { // Unique violation
    const message = 'Duplicate entry'
    error = { ...error, message, statusCode: 400, isOperational: true }
  }

  if (err.code === '23503') { // Foreign key violation
    const message = 'Referenced resource not found'
    error = { ...error, message, statusCode: 400, isOperational: true }
  }

  if (err.code === '23502') { // Not null violation
    const message = 'Required field missing'
    error = { ...error, message, statusCode: 400, isOperational: true }
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    timestamp: new Date().toISOString()
  })
}

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next)

export class CustomError extends Error implements AppError {
  statusCode: number
  isOperational: boolean

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}