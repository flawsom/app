import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { logger } from '../utils/logger'

// Database connection pool
let pool: Pool | null = null

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err)
    })
  }

  return pool
}

export const runMigrations = async (): Promise<void> => {
  const client = await getPool().connect()
  
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Get list of executed migrations
    const executedMigrations = await client.query(
      'SELECT filename FROM migrations ORDER BY id'
    )
    const executedFiles = executedMigrations.rows.map(row => row.filename)

    // Read migration files
    const migrationsDir = path.join(__dirname, '../../database/migrations')
    
    if (!fs.existsSync(migrationsDir)) {
      logger.info('No migrations directory found, skipping migrations')
      return
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort()

    // Execute pending migrations
    for (const filename of migrationFiles) {
      if (!executedFiles.includes(filename)) {
        logger.info(`Running migration: ${filename}`)
        
        const migrationPath = path.join(migrationsDir, filename)
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
        
        await client.query('BEGIN')
        
        try {
          await client.query(migrationSQL)
          await client.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [filename]
          )
          await client.query('COMMIT')
          
          logger.info(`Migration completed: ${filename}`)
        } catch (error) {
          await client.query('ROLLBACK')
          logger.error(`Migration failed: ${filename}`, error)
          throw error
        }
      }
    }

    logger.info('All migrations completed successfully')

  } catch (error) {
    logger.error('Migration error:', error)
    throw error
  } finally {
    client.release()
  }
}

export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await getPool().connect()
    await client.query('SELECT 1')
    client.release()
    logger.info('Database connection successful')
    return true
  } catch (error) {
    logger.error('Database connection failed:', error)
    return false
  }
}

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end()
    pool = null
    logger.info('Database pool closed')
  }
}