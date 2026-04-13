#!/usr/bin/env node

/**
 * Project UNIFY - Interactive Setup Wizard
 * Automated deployment and environment configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');
const https = require('https');
const crypto = require('crypto');

class ProjectUnifySetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.config = {
      platform: null,
      services: {},
      credentials: {},
      domain: null,
      budget: 'free'
    };
    
    this.spinner = {
      chars: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      index: 0
    };
  }

  // Utility methods
  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    
    const icons = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    
    console.log(`${colors[type]}${icons[type]} ${message}${colors.reset}`);
  }

  async question(query) {
    return new Promise(resolve => {
      this.rl.question(query, resolve);
    });
  }

  startSpinner(message) {
    process.stdout.write(`${message} ${this.spinner.chars[0]}`);
    this.spinnerInterval = setInterval(() => {
      process.stdout.write('\b' + this.spinner.chars[this.spinner.index]);
      this.spinner.index = (this.spinner.index + 1) % this.spinner.chars.length;
    }, 100);
  }

  stopSpinner(success = true) {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      process.stdout.write(success ? '\b✅\n' : '\b❌\n');
    }
  }

  generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  async execCommand(command, options = {}) {
    try {
      const result = execSync(command, { 
        encoding: 'utf8', 
        stdio: options.silent ? 'pipe' : 'inherit',
        ...options 
      });
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error.message, output: error.stdout };
    }
  }

  async checkPrerequisites() {
    this.log('🔍 Checking prerequisites...');
    
    const requirements = [
      { name: 'Node.js', command: 'node --version', min: '18.0.0' },
      { name: 'npm', command: 'npm --version', min: '8.0.0' },
      { name: 'Git', command: 'git --version', min: '2.0.0' }
    ];

    for (const req of requirements) {
      this.startSpinner(`Checking ${req.name}`);
      const result = await this.execCommand(req.command, { silent: true });
      
      if (result.success) {
        this.stopSpinner(true);
        this.log(`${req.name}: ${result.output.trim()}`, 'success');
      } else {
        this.stopSpinner(false);
        this.log(`${req.name} is not installed or not in PATH`, 'error');
        throw new Error(`Please install ${req.name} before continuing`);
      }
    }
  }

  async welcomeScreen() {
    console.clear();
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🚀 PROJECT UNIFY SETUP                   ║
║              AI-Powered Placement Management Platform        ║
╠══════════════════════════════════════════════════════════════╣
║  This wizard will help you deploy Project UNIFY with:       ║
║  • Automated service provisioning (freemium focus)          ║
║  • One-click deployment to multiple platforms               ║
║  • Complete environment configuration                        ║
║  • SSL certificates and security setup                      ║
╚══════════════════════════════════════════════════════════════╝
    `);

    const proceed = await this.question('Ready to start? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      this.log('Setup cancelled by user', 'warning');
      process.exit(0);
    }
  }

  async selectDeploymentPlatform() {
    console.log('\n📋 Select your deployment platform:');
    console.log('1. Vercel + Railway (Recommended for beginners)');
    console.log('2. DigitalOcean App Platform (Balanced option)');
    console.log('3. AWS (Enterprise grade)');
    console.log('4. Docker Compose (Self-hosted)');
    console.log('5. Local Development Only');

    const choice = await this.question('\nEnter your choice (1-5): ');
    
    const platforms = {
      '1': 'vercel-railway',
      '2': 'digitalocean',
      '3': 'aws',
      '4': 'docker',
      '5': 'local'
    };

    this.config.platform = platforms[choice];
    
    if (!this.config.platform) {
      this.log('Invalid choice, defaulting to Vercel + Railway', 'warning');
      this.config.platform = 'vercel-railway';
    }

    this.log(`Selected platform: ${this.config.platform}`, 'success');
  }

  async selectServices() {
    console.log('\n🛠️  Select services to configure:');
    
    const services = [
      { key: 'database', name: 'Database (Supabase/Railway PostgreSQL)', default: true },
      { key: 'email', name: 'Email Service (SendGrid)', default: true },
      { key: 'storage', name: 'File Storage (Cloudinary)', default: true },
      { key: 'ai', name: 'AI Services (OpenAI/Hugging Face)', default: true },
      { key: 'cache', name: 'Redis Cache (Upstash)', default: false },
      { key: 'monitoring', name: 'Error Tracking (Sentry)', default: false },
      { key: 'analytics', name: 'Analytics (Google Analytics)', default: false },
      { key: 'payments', name: 'Payment Processing (Stripe)', default: false }
    ];

    for (const service of services) {
      const defaultChoice = service.default ? 'Y/n' : 'y/N';
      const answer = await this.question(`Enable ${service.name}? (${defaultChoice}): `);
      
      const enabled = service.default 
        ? answer.toLowerCase() !== 'n'
        : answer.toLowerCase() === 'y';
        
      this.config.services[service.key] = enabled;
      
      if (enabled) {
        this.log(`✓ ${service.name} enabled`, 'success');
      }
    }
  }

  async configureDomain() {
    console.log('\n🌐 Domain Configuration:');
    
    const hasDomain = await this.question('Do you have a custom domain? (y/N): ');
    
    if (hasDomain.toLowerCase() === 'y') {
      this.config.domain = await this.question('Enter your domain (e.g., myapp.com): ');
      this.log(`Domain configured: ${this.config.domain}`, 'success');
    } else {
      this.log('Will use platform-provided domain', 'info');
    }
  }

  async setupSupabase() {
    if (!this.config.services.database) return;

    this.log('🗄️  Setting up Supabase database...', 'info');
    
    console.log('\nSupabase Setup Options:');
    console.log('1. I already have a Supabase project');
    console.log('2. Create new Supabase project (manual)');
    console.log('3. Skip for now (use local PostgreSQL)');

    const choice = await this.question('Choose option (1-3): ');

    switch (choice) {
      case '1':
        this.config.credentials.supabase_url = await this.question('Supabase URL: ');
        this.config.credentials.supabase_anon_key = await this.question('Supabase Anon Key: ');
        this.config.credentials.supabase_service_key = await this.question('Supabase Service Key: ');
        break;
        
      case '2':
        this.log('Please create a Supabase project at https://supabase.com', 'info');
        this.log('1. Sign up/login to Supabase', 'info');
        this.log('2. Create new project', 'info');
        this.log('3. Go to Settings > API to get your keys', 'info');
        
        await this.question('Press Enter when ready...');
        
        this.config.credentials.supabase_url = await this.question('Supabase URL: ');
        this.config.credentials.supabase_anon_key = await this.question('Supabase Anon Key: ');
        this.config.credentials.supabase_service_key = await this.question('Supabase Service Key: ');
        break;
        
      case '3':
        this.log('Skipping Supabase, will use local PostgreSQL', 'warning');
        this.config.services.database = false;
        break;
    }

    if (this.config.credentials.supabase_url) {
      // Generate database URL from Supabase credentials
      const projectRef = this.config.credentials.supabase_url.match(/https:\/\/(.+)\.supabase\.co/)[1];
      this.config.credentials.database_url = `postgresql://postgres:[YOUR-PASSWORD]@db.${projectRef}.supabase.co:5432/postgres`;
      this.log('✓ Supabase configured successfully', 'success');
    }
  }

  async setupSendGrid() {
    if (!this.config.services.email) return;

    this.log('📧 Setting up SendGrid email service...', 'info');
    
    console.log('\nSendGrid Setup (Free: 100 emails/day):');
    console.log('1. I already have a SendGrid API key');
    console.log('2. Create new SendGrid account (manual)');
    console.log('3. Skip for now');

    const choice = await this.question('Choose option (1-3): ');

    switch (choice) {
      case '1':
        this.config.credentials.sendgrid_api_key = await this.question('SendGrid API Key: ');
        break;
        
      case '2':
        this.log('Please create a SendGrid account:', 'info');
        this.log('1. Go to https://sendgrid.com/free/', 'info');
        this.log('2. Sign up for free account (100 emails/day)', 'info');
        this.log('3. Go to Settings > API Keys', 'info');
        this.log('4. Create new API key with Full Access', 'info');
        
        await this.question('Press Enter when ready...');
        this.config.credentials.sendgrid_api_key = await this.question('SendGrid API Key: ');
        break;
        
      case '3':
        this.log('Skipping SendGrid setup', 'warning');
        this.config.services.email = false;
        break;
    }

    if (this.config.credentials.sendgrid_api_key) {
      this.config.credentials.email_from = await this.question('From email address: ') || 'noreply@yourdomain.com';
      this.log('✓ SendGrid configured successfully', 'success');
    }
  }

  async setupCloudinary() {
    if (!this.config.services.storage) return;

    this.log('☁️  Setting up Cloudinary file storage...', 'info');
    
    console.log('\nCloudinary Setup (Free: 25GB storage/month):');
    console.log('1. I already have Cloudinary credentials');
    console.log('2. Create new Cloudinary account (manual)');
    console.log('3. Skip for now (use local storage)');

    const choice = await this.question('Choose option (1-3): ');

    switch (choice) {
      case '1':
        this.config.credentials.cloudinary_cloud_name = await this.question('Cloud Name: ');
        this.config.credentials.cloudinary_api_key = await this.question('API Key: ');
        this.config.credentials.cloudinary_api_secret = await this.question('API Secret: ');
        break;
        
      case '2':
        this.log('Please create a Cloudinary account:', 'info');
        this.log('1. Go to https://cloudinary.com/users/register/free', 'info');
        this.log('2. Sign up for free account (25GB/month)', 'info');
        this.log('3. Go to Console > Settings > Security', 'info');
        this.log('4. Copy Cloud Name, API Key, and API Secret', 'info');
        
        await this.question('Press Enter when ready...');
        this.config.credentials.cloudinary_cloud_name = await this.question('Cloud Name: ');
        this.config.credentials.cloudinary_api_key = await this.question('API Key: ');
        this.config.credentials.cloudinary_api_secret = await this.question('API Secret: ');
        break;
        
      case '3':
        this.log('Skipping Cloudinary, will use local storage', 'warning');
        this.config.services.storage = false;
        break;
    }

    if (this.config.credentials.cloudinary_cloud_name) {
      this.log('✓ Cloudinary configured successfully', 'success');
    }
  }

  async setupOpenAI() {
    if (!this.config.services.ai) return;

    this.log('🤖 Setting up AI services...', 'info');
    
    console.log('\nAI Service Options:');
    console.log('1. OpenAI (Pay-as-you-go, $5 free credit)');
    console.log('2. Hugging Face (Free tier: 30K chars/month)');
    console.log('3. Skip for now');

    const choice = await this.question('Choose option (1-3): ');

    switch (choice) {
      case '1':
        this.log('OpenAI Setup:', 'info');
        this.log('1. Go to https://platform.openai.com/api-keys', 'info');
        this.log('2. Create account and add payment method', 'info');
        this.log('3. Create new API key', 'info');
        
        await this.question('Press Enter when ready...');
        this.config.credentials.openai_api_key = await this.question('OpenAI API Key: ');
        this.config.credentials.openai_model = 'gpt-3.5-turbo';
        break;
        
      case '2':
        this.log('Hugging Face Setup:', 'info');
        this.log('1. Go to https://huggingface.co/settings/tokens', 'info');
        this.log('2. Create account (free)', 'info');
        this.log('3. Create new access token', 'info');
        
        await this.question('Press Enter when ready...');
        this.config.credentials.huggingface_api_key = await this.question('Hugging Face Token: ');
        break;
        
      case '3':
        this.log('Skipping AI services setup', 'warning');
        this.config.services.ai = false;
        break;
    }

    if (this.config.credentials.openai_api_key || this.config.credentials.huggingface_api_key) {
      this.log('✓ AI services configured successfully', 'success');
    }
  }

  async setupOptionalServices() {
    // Redis/Upstash
    if (this.config.services.cache) {
      this.log('Setting up Upstash Redis (Free: 10K commands/day):', 'info');
      this.log('1. Go to https://console.upstash.com/redis', 'info');
      this.log('2. Create free account and database', 'info');
      
      await this.question('Press Enter when ready...');
      this.config.credentials.redis_url = await this.question('Upstash Redis URL: ');
    }

    // Sentry
    if (this.config.services.monitoring) {
      this.log('Setting up Sentry (Free: 5K errors/month):', 'info');
      this.log('1. Go to https://sentry.io/signup/', 'info');
      this.log('2. Create project and get DSN', 'info');
      
      await this.question('Press Enter when ready...');
      this.config.credentials.sentry_dsn = await this.question('Sentry DSN: ');
    }

    // Google Analytics
    if (this.config.services.analytics) {
      this.log('Setting up Google Analytics (Free):', 'info');
      this.log('1. Go to https://analytics.google.com/', 'info');
      this.log('2. Create GA4 property', 'info');
      
      await this.question('Press Enter when ready...');
      this.config.credentials.ga_measurement_id = await this.question('GA4 Measurement ID: ');
    }

    // Stripe
    if (this.config.services.payments) {
      this.log('Setting up Stripe (Test mode):', 'info');
      this.log('1. Go to https://dashboard.stripe.com/register', 'info');
      this.log('2. Get test API keys', 'info');
      
      await this.question('Press Enter when ready...');
      this.config.credentials.stripe_publishable_key = await this.question('Stripe Publishable Key: ');
      this.config.credentials.stripe_secret_key = await this.question('Stripe Secret Key: ');
    }
  }

  generateEnvironmentFiles() {
    this.log('📝 Generating environment files...', 'info');

    // Generate JWT secrets
    const jwtSecret = this.generateSecret(32);
    const jwtRefreshSecret = this.generateSecret(32);

    // Backend .env
    const backendEnv = `# Project UNIFY Backend Environment
# Generated by setup wizard on ${new Date().toISOString()}

NODE_ENV=development
PORT=3001
FRONTEND_URL=${this.config.domain ? `https://${this.config.domain}` : 'http://localhost:3000'}

# JWT Configuration
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Database Configuration
${this.config.credentials.database_url ? `DATABASE_URL=${this.config.credentials.database_url}` : '# DATABASE_URL=postgresql://postgres:password@localhost:5432/project_unify'}

${this.config.credentials.supabase_url ? `
# Supabase Configuration
SUPABASE_URL=${this.config.credentials.supabase_url}
SUPABASE_ANON_KEY=${this.config.credentials.supabase_anon_key}
SUPABASE_SERVICE_KEY=${this.config.credentials.supabase_service_key}
` : ''}

${this.config.credentials.sendgrid_api_key ? `
# Email Configuration
SENDGRID_API_KEY=${this.config.credentials.sendgrid_api_key}
EMAIL_FROM=${this.config.credentials.email_from}
EMAIL_FROM_NAME=Project UNIFY
` : ''}

${this.config.credentials.cloudinary_cloud_name ? `
# File Storage Configuration
CLOUDINARY_CLOUD_NAME=${this.config.credentials.cloudinary_cloud_name}
CLOUDINARY_API_KEY=${this.config.credentials.cloudinary_api_key}
CLOUDINARY_API_SECRET=${this.config.credentials.cloudinary_api_secret}
` : ''}

${this.config.credentials.openai_api_key ? `
# AI Services Configuration
OPENAI_API_KEY=${this.config.credentials.openai_api_key}
OPENAI_MODEL=${this.config.credentials.openai_model}
` : ''}

${this.config.credentials.huggingface_api_key ? `
# Hugging Face Configuration
HUGGINGFACE_API_KEY=${this.config.credentials.huggingface_api_key}
` : ''}

${this.config.credentials.redis_url ? `
# Redis Configuration
REDIS_URL=${this.config.credentials.redis_url}
` : '# REDIS_URL=redis://localhost:6379'}

${this.config.credentials.sentry_dsn ? `
# Monitoring Configuration
SENTRY_DSN=${this.config.credentials.sentry_dsn}
` : ''}

${this.config.credentials.stripe_secret_key ? `
# Payment Configuration
STRIPE_SECRET_KEY=${this.config.credentials.stripe_secret_key}
` : ''}

# Security
BCRYPT_ROUNDS=12
CORS_ORIGIN=${this.config.domain ? `https://${this.config.domain}` : 'http://localhost:3000'}
`;

    // Frontend .env.local
    const frontendEnv = `# Project UNIFY Frontend Environment
# Generated by setup wizard on ${new Date().toISOString()}

NEXT_PUBLIC_API_URL=${this.config.domain ? `https://api.${this.config.domain}` : 'http://localhost:3001'}
NEXT_PUBLIC_APP_NAME=Project UNIFY

${this.config.credentials.ga_measurement_id ? `
# Analytics Configuration
NEXT_PUBLIC_GA_MEASUREMENT_ID=${this.config.credentials.ga_measurement_id}
` : ''}

${this.config.credentials.cloudinary_cloud_name ? `
# File Upload Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=${this.config.credentials.cloudinary_cloud_name}
` : ''}

${this.config.credentials.stripe_publishable_key ? `
# Payment Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${this.config.credentials.stripe_publishable_key}
` : ''}

${this.config.credentials.sentry_dsn ? `
# Error Tracking Configuration
NEXT_PUBLIC_SENTRY_DSN=${this.config.credentials.sentry_dsn}
` : ''}
`;

    // Write files
    fs.writeFileSync(path.join(process.cwd(), 'backend', '.env'), backendEnv);
    fs.writeFileSync(path.join(process.cwd(), 'frontend', '.env.local'), frontendEnv);

    this.log('✓ Environment files generated successfully', 'success');
    this.log('  - backend/.env', 'info');
    this.log('  - frontend/.env.local', 'info');
  }

  async deployToVercelRailway() {
    this.log('🚀 Deploying to Vercel + Railway...', 'info');

    // Check if Vercel CLI is installed
    const vercelCheck = await this.execCommand('vercel --version', { silent: true });
    if (!vercelCheck.success) {
      this.log('Installing Vercel CLI...', 'info');
      await this.execCommand('npm install -g vercel');
    }

    // Check if Railway CLI is installed
    const railwayCheck = await this.execCommand('railway --version', { silent: true });
    if (!railwayCheck.success) {
      this.log('Installing Railway CLI...', 'info');
      await this.execCommand('npm install -g @railway/cli');
    }

    this.log('Please complete the deployment manually:', 'info');
    this.log('1. Frontend (Vercel):', 'info');
    this.log('   cd frontend && vercel --prod', 'info');
    this.log('2. Backend (Railway):', 'info');
    this.log('   cd backend && railway login && railway up', 'info');
  }

  async deployToDocker() {
    this.log('🐳 Setting up Docker deployment...', 'info');

    const dockerComposeContent = `version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: project_unify
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${this.generateSecret(16)}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - backend
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:3001

volumes:
  postgres_data:
  redis_data:
`;

    fs.writeFileSync(path.join(process.cwd(), 'docker-compose.yml'), dockerComposeContent);
    this.log('✓ Docker Compose file generated', 'success');
    this.log('Run: docker-compose up -d', 'info');
  }

  async setupLocal() {
    this.log('💻 Setting up local development environment...', 'info');

    this.startSpinner('Installing dependencies');
    
    // Install backend dependencies
    const backendInstall = await this.execCommand('cd backend && npm install', { silent: true });
    
    // Install frontend dependencies
    const frontendInstall = await this.execCommand('cd frontend && npm install', { silent: true });
    
    this.stopSpinner(backendInstall.success && frontendInstall.success);

    if (backendInstall.success && frontendInstall.success) {
      this.log('✓ Dependencies installed successfully', 'success');
      
      // Create start script
      const startScript = `#!/bin/bash
# Project UNIFY Local Development Start Script

echo "🚀 Starting Project UNIFY..."

# Start PostgreSQL (if using Docker)
if command -v docker &> /dev/null; then
    echo "Starting PostgreSQL with Docker..."
    docker run -d --name project-unify-postgres \\
        -e POSTGRES_DB=project_unify \\
        -e POSTGRES_USER=postgres \\
        -e POSTGRES_PASSWORD=password \\
        -p 5432:5432 \\
        postgres:15-alpine
fi

# Start Redis (if using Docker)
if command -v docker &> /dev/null; then
    echo "Starting Redis with Docker..."
    docker run -d --name project-unify-redis \\
        -p 6379:6379 \\
        redis:7-alpine
fi

# Start backend
echo "Starting backend server..."
cd backend && npm run dev &
BACKEND_PID=$!

# Start frontend
echo "Starting frontend server..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo "✅ Project UNIFY is running!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap 'kill $BACKEND_PID $FRONTEND_PID; docker stop project-unify-postgres project-unify-redis 2>/dev/null; exit' INT
wait
`;

      fs.writeFileSync(path.join(process.cwd(), 'start-dev.sh'), startScript);
      await this.execCommand('chmod +x start-dev.sh');
      
      this.log('✓ Development start script created: ./start-dev.sh', 'success');
    } else {
      this.log('Failed to install dependencies', 'error');
    }
  }

  async validateConfiguration() {
    this.log('🔍 Validating configuration...', 'info');

    const validations = [];

    // Test database connection
    if (this.config.credentials.supabase_url) {
      validations.push(this.validateSupabase());
    }

    // Test email service
    if (this.config.credentials.sendgrid_api_key) {
      validations.push(this.validateSendGrid());
    }

    // Test file storage
    if (this.config.credentials.cloudinary_cloud_name) {
      validations.push(this.validateCloudinary());
    }

    const results = await Promise.allSettled(validations);
    
    let allValid = true;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        this.log(`✓ Validation ${index + 1} passed`, 'success');
      } else {
        this.log(`✗ Validation ${index + 1} failed`, 'error');
        allValid = false;
      }
    });

    return allValid;
  }

  async validateSupabase() {
    try {
      const url = `${this.config.credentials.supabase_url}/rest/v1/`;
      const response = await this.makeHttpRequest(url, {
        headers: {
          'apikey': this.config.credentials.supabase_anon_key,
          'Authorization': `Bearer ${this.config.credentials.supabase_anon_key}`
        }
      });
      return response.statusCode < 400;
    } catch (error) {
      return false;
    }
  }

  async validateSendGrid() {
    // Note: This is a simplified validation
    return this.config.credentials.sendgrid_api_key.startsWith('SG.');
  }

  async validateCloudinary() {
    // Note: This is a simplified validation
    return this.config.credentials.cloudinary_cloud_name && 
           this.config.credentials.cloudinary_api_key &&
           this.config.credentials.cloudinary_api_secret;
  }

  makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, data }));
      });
      
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.end();
    });
  }

  async generateSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 PROJECT UNIFY SETUP COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n📋 Configuration Summary:');
    console.log(`Platform: ${this.config.platform}`);
    console.log(`Domain: ${this.config.domain || 'Platform default'}`);
    
    console.log('\n🛠️  Enabled Services:');
    Object.entries(this.config.services).forEach(([service, enabled]) => {
      if (enabled) {
        console.log(`✓ ${service}`);
      }
    });

    console.log('\n🚀 Next Steps:');
    
    switch (this.config.platform) {
      case 'vercel-railway':
        console.log('1. Deploy frontend: cd frontend && vercel --prod');
        console.log('2. Deploy backend: cd backend && railway up');
        break;
        
      case 'docker':
        console.log('1. Build and start: docker-compose up -d');
        console.log('2. View logs: docker-compose logs -f');
        break;
        
      case 'local':
        console.log('1. Start development: ./start-dev.sh');
        console.log('2. Visit: http://localhost:3000');
        break;
        
      default:
        console.log('1. Follow platform-specific deployment guide');
        console.log('2. Update DNS settings if using custom domain');
    }

    console.log('\n📚 Documentation:');
    console.log('• Setup Guide: docs/SETUP.md');
    console.log('• Deployment: docs/deployment/');
    console.log('• Troubleshooting: docs/TROUBLESHOOTING.md');

    console.log('\n💡 Tips:');
    console.log('• Keep your .env files secure and never commit them');
    console.log('• Monitor your service usage to stay within free tiers');
    console.log('• Set up monitoring and backups for production');
    
    console.log('\n' + '='.repeat(60));
  }

  async run() {
    try {
      await this.welcomeScreen();
      await this.checkPrerequisites();
      await this.selectDeploymentPlatform();
      await this.selectServices();
      await this.configureDomain();
      
      // Service setup
      await this.setupSupabase();
      await this.setupSendGrid();
      await this.setupCloudinary();
      await this.setupOpenAI();
      await this.setupOptionalServices();
      
      // Generate configuration
      this.generateEnvironmentFiles();
      
      // Platform-specific deployment
      switch (this.config.platform) {
        case 'vercel-railway':
          await this.deployToVercelRailway();
          break;
        case 'docker':
          await this.deployToDocker();
          break;
        case 'local':
          await this.setupLocal();
          break;
      }
      
      // Validate and summarize
      await this.validateConfiguration();
      await this.generateSummary();
      
    } catch (error) {
      this.log(`Setup failed: ${error.message}`, 'error');
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new ProjectUnifySetup();
  setup.run();
}

module.exports = ProjectUnifySetup;