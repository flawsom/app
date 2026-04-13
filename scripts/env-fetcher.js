#!/usr/bin/env node

/**
 * Project UNIFY - Environment Variable Fetcher
 * Automated service setup and credential generation using freemium APIs
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

class EnvFetcher {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.credentials = {};
    this.services = {
      supabase: false,
      sendgrid: false,
      cloudinary: false,
      openai: false,
      upstash: false,
      sentry: false
    };
  }

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

  generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  }

  async makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const req = protocol.request(url, {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Project-UNIFY-Setup/1.0',
          ...options.headers
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: parsed, headers: res.headers });
          } catch (error) {
            resolve({ statusCode: res.statusCode, data: data, headers: res.headers });
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  async validateSupabaseCredentials(url, anonKey) {
    try {
      const response = await this.makeHttpRequest(`${url}/rest/v1/`, {
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        }
      });
      
      return response.statusCode < 400;
    } catch (error) {
      return false;
    }
  }

  async validateSendGridKey(apiKey) {
    try {
      const response = await this.makeHttpRequest('https://api.sendgrid.com/v3/user/account', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      return response.statusCode === 200;
    } catch (error) {
      return false;
    }
  }

  async validateCloudinaryCredentials(cloudName, apiKey, apiSecret) {
    try {
      // Simple validation by checking if credentials format is correct
      const timestamp = Math.round(Date.now() / 1000);
      const signature = crypto
        .createHash('sha1')
        .update(`timestamp=${timestamp}${apiSecret}`)
        .digest('hex');
      
      const response = await this.makeHttpRequest(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `timestamp=${timestamp}&api_key=${apiKey}&signature=${signature}`
        }
      );
      
      // Even if upload fails, we can validate credentials by response type
      return response.statusCode !== 401 && response.statusCode !== 403;
    } catch (error) {
      return false;
    }
  }

  async validateOpenAIKey(apiKey) {
    try {
      const response = await this.makeHttpRequest('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      return response.statusCode === 200;
    } catch (error) {
      return false;
    }
  }

  async setupSupabase() {
    this.log('🗄️  Setting up Supabase (PostgreSQL + Auth + Storage)', 'info');
    
    console.log('\nSupabase provides:');
    console.log('• PostgreSQL database (500MB free)');
    console.log('• Authentication system');
    console.log('• File storage (1GB free)');
    console.log('• Real-time subscriptions');
    
    const hasSupabase = await this.question('\nDo you have Supabase credentials? (y/N): ');
    
    if (hasSupabase.toLowerCase() === 'y') {
      const url = await this.question('Supabase Project URL: ');
      const anonKey = await this.question('Supabase Anon Key: ');
      const serviceKey = await this.question('Supabase Service Role Key: ');
      
      this.log('Validating Supabase credentials...', 'info');
      const isValid = await this.validateSupabaseCredentials(url, anonKey);
      
      if (isValid) {
        this.credentials.supabase = {
          url,
          anonKey,
          serviceKey,
          databaseUrl: this.generateSupabaseDatabaseUrl(url)
        };
        this.services.supabase = true;
        this.log('✓ Supabase credentials validated', 'success');
      } else {
        this.log('⚠️ Supabase credentials validation failed', 'warning');
      }
    } else {
      await this.guideSupabaseSetup();
    }
  }

  async guideSupabaseSetup() {
    this.log('Setting up new Supabase project:', 'info');
    console.log('\n📋 Manual Setup Steps:');
    console.log('1. Go to https://supabase.com');
    console.log('2. Sign up with GitHub (recommended)');
    console.log('3. Create new project');
    console.log('   • Choose organization');
    console.log('   • Set project name: project-unify');
    console.log('   • Set strong database password');
    console.log('   • Choose region closest to users');
    console.log('4. Wait for project creation (2-3 minutes)');
    console.log('5. Go to Settings > API');
    console.log('6. Copy Project URL and API keys');
    
    const proceed = await this.question('\nPress Enter when you have the credentials...');
    
    const url = await this.question('Project URL: ');
    const anonKey = await this.question('Anon Key: ');
    const serviceKey = await this.question('Service Role Key: ');
    
    this.log('Validating credentials...', 'info');
    const isValid = await this.validateSupabaseCredentials(url, anonKey);
    
    if (isValid) {
      this.credentials.supabase = {
        url,
        anonKey,
        serviceKey,
        databaseUrl: this.generateSupabaseDatabaseUrl(url)
      };
      this.services.supabase = true;
      this.log('✓ Supabase setup completed', 'success');
    } else {
      this.log('❌ Credentials validation failed. Please check and try again.', 'error');
    }
  }

  generateSupabaseDatabaseUrl(supabaseUrl) {
    const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
    if (projectRef) {
      return `postgresql://postgres:[YOUR-PASSWORD]@db.${projectRef}.supabase.co:5432/postgres`;
    }
    return 'postgresql://postgres:password@localhost:5432/project_unify';
  }

  async setupSendGrid() {
    this.log('📧 Setting up SendGrid (Email Service)', 'info');
    
    console.log('\nSendGrid provides:');
    console.log('• 100 emails/day forever (free)');
    console.log('• Reliable email delivery');
    console.log('• Email templates');
    console.log('• Analytics and tracking');
    
    const hasSendGrid = await this.question('\nDo you have a SendGrid API key? (y/N): ');
    
    if (hasSendGrid.toLowerCase() === 'y') {
      const apiKey = await this.question('SendGrid API Key: ');
      
      this.log('Validating SendGrid API key...', 'info');
      const isValid = await this.validateSendGridKey(apiKey);
      
      if (isValid) {
        const fromEmail = await this.question('From email address: ') || 'noreply@yourdomain.com';
        
        this.credentials.sendgrid = {
          apiKey,
          fromEmail,
          fromName: 'Project UNIFY'
        };
        this.services.sendgrid = true;
        this.log('✓ SendGrid setup completed', 'success');
      } else {
        this.log('⚠️ SendGrid API key validation failed', 'warning');
      }
    } else {
      await this.guideSendGridSetup();
    }
  }

  async guideSendGridSetup() {
    this.log('Setting up new SendGrid account:', 'info');
    console.log('\n📋 Manual Setup Steps:');
    console.log('1. Go to https://sendgrid.com/free/');
    console.log('2. Sign up for free account');
    console.log('3. Verify email address');
    console.log('4. Complete account verification (may require phone)');
    console.log('5. Go to Settings > API Keys');
    console.log('6. Click "Create API Key"');
    console.log('7. Choose "Full Access" or "Restricted Access"');
    console.log('8. Copy the API key (shown only once!)');
    
    const proceed = await this.question('\nPress Enter when you have the API key...');
    
    const apiKey = await this.question('SendGrid API Key: ');
    
    this.log('Validating API key...', 'info');
    const isValid = await this.validateSendGridKey(apiKey);
    
    if (isValid) {
      const fromEmail = await this.question('From email address: ') || 'noreply@yourdomain.com';
      
      this.credentials.sendgrid = {
        apiKey,
        fromEmail,
        fromName: 'Project UNIFY'
      };
      this.services.sendgrid = true;
      this.log('✓ SendGrid setup completed', 'success');
    } else {
      this.log('❌ API key validation failed. Please check and try again.', 'error');
    }
  }

  async setupCloudinary() {
    this.log('☁️  Setting up Cloudinary (File Storage & CDN)', 'info');
    
    console.log('\nCloudinary provides:');
    console.log('• 25GB storage/month (free)');
    console.log('• 25GB bandwidth/month (free)');
    console.log('• Image/video optimization');
    console.log('• Global CDN');
    
    const hasCloudinary = await this.question('\nDo you have Cloudinary credentials? (y/N): ');
    
    if (hasCloudinary.toLowerCase() === 'y') {
      const cloudName = await this.question('Cloud Name: ');
      const apiKey = await this.question('API Key: ');
      const apiSecret = await this.question('API Secret: ');
      
      this.log('Validating Cloudinary credentials...', 'info');
      const isValid = await this.validateCloudinaryCredentials(cloudName, apiKey, apiSecret);
      
      if (isValid) {
        this.credentials.cloudinary = {
          cloudName,
          apiKey,
          apiSecret
        };
        this.services.cloudinary = true;
        this.log('✓ Cloudinary setup completed', 'success');
      } else {
        this.log('⚠️ Cloudinary credentials validation failed', 'warning');
      }
    } else {
      await this.guideCloudinarySetup();
    }
  }

  async guideCloudinarySetup() {
    this.log('Setting up new Cloudinary account:', 'info');
    console.log('\n📋 Manual Setup Steps:');
    console.log('1. Go to https://cloudinary.com/users/register/free');
    console.log('2. Sign up for free account');
    console.log('3. Verify email address');
    console.log('4. Go to Console Dashboard');
    console.log('5. Find "Account Details" section');
    console.log('6. Copy Cloud Name, API Key, and API Secret');
    console.log('7. Optionally: Create upload presets in Settings > Upload');
    
    const proceed = await this.question('\nPress Enter when you have the credentials...');
    
    const cloudName = await this.question('Cloud Name: ');
    const apiKey = await this.question('API Key: ');
    const apiSecret = await this.question('API Secret: ');
    
    this.log('Validating credentials...', 'info');
    const isValid = await this.validateCloudinaryCredentials(cloudName, apiKey, apiSecret);
    
    if (isValid) {
      this.credentials.cloudinary = {
        cloudName,
        apiKey,
        apiSecret
      };
      this.services.cloudinary = true;
      this.log('✓ Cloudinary setup completed', 'success');
    } else {
      this.log('❌ Credentials validation failed. Please check and try again.', 'error');
    }
  }

  async setupOpenAI() {
    this.log('🤖 Setting up OpenAI (AI Services)', 'info');
    
    console.log('\nOpenAI provides:');
    console.log('• $5 free credit for new users');
    console.log('• GPT-3.5 Turbo: $0.002/1K tokens');
    console.log('• GPT-4: $0.03/1K tokens');
    console.log('• Pay-as-you-go pricing');
    
    const hasOpenAI = await this.question('\nDo you have an OpenAI API key? (y/N): ');
    
    if (hasOpenAI.toLowerCase() === 'y') {
      const apiKey = await this.question('OpenAI API Key: ');
      
      this.log('Validating OpenAI API key...', 'info');
      const isValid = await this.validateOpenAIKey(apiKey);
      
      if (isValid) {
        this.credentials.openai = {
          apiKey,
          model: 'gpt-3.5-turbo'
        };
        this.services.openai = true;
        this.log('✓ OpenAI setup completed', 'success');
      } else {
        this.log('⚠️ OpenAI API key validation failed', 'warning');
      }
    } else {
      await this.guideOpenAISetup();
    }
  }

  async guideOpenAISetup() {
    this.log('Setting up OpenAI account:', 'info');
    console.log('\n📋 Manual Setup Steps:');
    console.log('1. Go to https://platform.openai.com/signup');
    console.log('2. Sign up with email or Google/Microsoft');
    console.log('3. Verify phone number (required)');
    console.log('4. Add payment method (required after free credit)');
    console.log('5. Go to https://platform.openai.com/api-keys');
    console.log('6. Click "Create new secret key"');
    console.log('7. Copy the API key (shown only once!)');
    console.log('8. Set usage limits in Billing > Usage limits');
    
    const proceed = await this.question('\nPress Enter when you have the API key...');
    
    const apiKey = await this.question('OpenAI API Key: ');
    
    this.log('Validating API key...', 'info');
    const isValid = await this.validateOpenAIKey(apiKey);
    
    if (isValid) {
      this.credentials.openai = {
        apiKey,
        model: 'gpt-3.5-turbo'
      };
      this.services.openai = true;
      this.log('✓ OpenAI setup completed', 'success');
    } else {
      this.log('❌ API key validation failed. Please check and try again.', 'error');
    }
  }

  async setupOptionalServices() {
    this.log('🔧 Setting up optional services...', 'info');
    
    // Upstash Redis
    const wantsRedis = await this.question('\nSetup Upstash Redis for caching? (y/N): ');
    if (wantsRedis.toLowerCase() === 'y') {
      await this.setupUpstash();
    }
    
    // Sentry
    const wantsSentry = await this.question('\nSetup Sentry for error tracking? (y/N): ');
    if (wantsSentry.toLowerCase() === 'y') {
      await this.setupSentry();
    }
  }

  async setupUpstash() {
    this.log('Setting up Upstash Redis:', 'info');
    console.log('\n📋 Manual Setup Steps:');
    console.log('1. Go to https://console.upstash.com/redis');
    console.log('2. Sign up with GitHub (recommended)');
    console.log('3. Create new database');
    console.log('   • Choose region closest to users');
    console.log('   • Select "Free" tier');
    console.log('4. Copy Redis URL from database details');
    
    const proceed = await this.question('\nPress Enter when you have the Redis URL...');
    
    const redisUrl = await this.question('Upstash Redis URL: ');
    
    if (redisUrl && redisUrl.startsWith('redis')) {
      this.credentials.upstash = { redisUrl };
      this.services.upstash = true;
      this.log('✓ Upstash Redis setup completed', 'success');
    }
  }

  async setupSentry() {
    this.log('Setting up Sentry error tracking:', 'info');
    console.log('\n📋 Manual Setup Steps:');
    console.log('1. Go to https://sentry.io/signup/');
    console.log('2. Sign up for free account');
    console.log('3. Create new project');
    console.log('   • Choose "Node.js" for backend');
    console.log('   • Choose "React" for frontend');
    console.log('4. Copy DSN from project settings');
    
    const proceed = await this.question('\nPress Enter when you have the DSN...');
    
    const dsn = await this.question('Sentry DSN: ');
    
    if (dsn && dsn.startsWith('https://')) {
      this.credentials.sentry = { dsn };
      this.services.sentry = true;
      this.log('✓ Sentry setup completed', 'success');
    }
  }

  generateEnvironmentFiles() {
    this.log('📝 Generating environment files...', 'info');

    // Generate JWT secrets
    const jwtSecret = this.generateSecret(32);
    const jwtRefreshSecret = this.generateSecret(32);

    // Backend .env
    let backendEnv = `# Project UNIFY Backend Environment
# Generated automatically on ${new Date().toISOString()}

# Server Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

`;

    // Add database configuration
    if (this.services.supabase) {
      backendEnv += `# Supabase Configuration
DATABASE_URL=${this.credentials.supabase.databaseUrl}
SUPABASE_URL=${this.credentials.supabase.url}
SUPABASE_ANON_KEY=${this.credentials.supabase.anonKey}
SUPABASE_SERVICE_KEY=${this.credentials.supabase.serviceKey}

`;
    } else {
      backendEnv += `# Local PostgreSQL Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/project_unify

`;
    }

    // Add email configuration
    if (this.services.sendgrid) {
      backendEnv += `# Email Configuration (SendGrid)
SENDGRID_API_KEY=${this.credentials.sendgrid.apiKey}
EMAIL_FROM=${this.credentials.sendgrid.fromEmail}
EMAIL_FROM_NAME=${this.credentials.sendgrid.fromName}

`;
    }

    // Add file storage configuration
    if (this.services.cloudinary) {
      backendEnv += `# File Storage Configuration (Cloudinary)
CLOUDINARY_CLOUD_NAME=${this.credentials.cloudinary.cloudName}
CLOUDINARY_API_KEY=${this.credentials.cloudinary.apiKey}
CLOUDINARY_API_SECRET=${this.credentials.cloudinary.apiSecret}

`;
    }

    // Add AI configuration
    if (this.services.openai) {
      backendEnv += `# AI Configuration (OpenAI)
OPENAI_API_KEY=${this.credentials.openai.apiKey}
OPENAI_MODEL=${this.credentials.openai.model}

`;
    }

    // Add Redis configuration
    if (this.services.upstash) {
      backendEnv += `# Redis Configuration (Upstash)
REDIS_URL=${this.credentials.upstash.redisUrl}

`;
    } else {
      backendEnv += `# Local Redis Configuration
REDIS_URL=redis://localhost:6379

`;
    }

    // Add monitoring configuration
    if (this.services.sentry) {
      backendEnv += `# Error Tracking (Sentry)
SENTRY_DSN=${this.credentials.sentry.dsn}

`;
    }

    // Frontend .env.local
    let frontendEnv = `# Project UNIFY Frontend Environment
# Generated automatically on ${new Date().toISOString()}

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=Project UNIFY

`;

    // Add Cloudinary frontend config
    if (this.services.cloudinary) {
      frontendEnv += `# File Upload Configuration
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=${this.credentials.cloudinary.cloudName}

`;
    }

    // Add Sentry frontend config
    if (this.services.sentry) {
      frontendEnv += `# Error Tracking Configuration
NEXT_PUBLIC_SENTRY_DSN=${this.credentials.sentry.dsn}

`;
    }

    // Write files
    const backendDir = path.join(process.cwd(), 'backend');
    const frontendDir = path.join(process.cwd(), 'frontend');

    if (fs.existsSync(backendDir)) {
      fs.writeFileSync(path.join(backendDir, '.env'), backendEnv);
      this.log('✓ Backend .env file created', 'success');
    }

    if (fs.existsSync(frontendDir)) {
      fs.writeFileSync(path.join(frontendDir, '.env.local'), frontendEnv);
      this.log('✓ Frontend .env.local file created', 'success');
    }

    // Create a summary file
    const summary = {
      generatedAt: new Date().toISOString(),
      services: this.services,
      credentials: Object.keys(this.credentials).reduce((acc, key) => {
        acc[key] = 'configured';
        return acc;
      }, {}),
      nextSteps: [
        'Review generated .env files',
        'Update database passwords in Supabase URLs',
        'Test service connections',
        'Deploy your application',
        'Monitor service usage to stay within free tiers'
      ]
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'env-setup-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    this.log('✓ Setup summary saved to env-setup-summary.json', 'success');
  }

  async testConnections() {
    this.log('🔍 Testing service connections...', 'info');

    const tests = [];

    if (this.services.supabase) {
      tests.push({
        name: 'Supabase',
        test: () => this.validateSupabaseCredentials(
          this.credentials.supabase.url,
          this.credentials.supabase.anonKey
        )
      });
    }

    if (this.services.sendgrid) {
      tests.push({
        name: 'SendGrid',
        test: () => this.validateSendGridKey(this.credentials.sendgrid.apiKey)
      });
    }

    if (this.services.cloudinary) {
      tests.push({
        name: 'Cloudinary',
        test: () => this.validateCloudinaryCredentials(
          this.credentials.cloudinary.cloudName,
          this.credentials.cloudinary.apiKey,
          this.credentials.cloudinary.apiSecret
        )
      });
    }

    if (this.services.openai) {
      tests.push({
        name: 'OpenAI',
        test: () => this.validateOpenAIKey(this.credentials.openai.apiKey)
      });
    }

    let allPassed = true;

    for (const test of tests) {
      try {
        const result = await test.test();
        if (result) {
          this.log(`✓ ${test.name} connection successful`, 'success');
        } else {
          this.log(`✗ ${test.name} connection failed`, 'error');
          allPassed = false;
        }
      } catch (error) {
        this.log(`✗ ${test.name} connection error: ${error.message}`, 'error');
        allPassed = false;
      }
    }

    return allPassed;
  }

  async generateSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 ENVIRONMENT SETUP COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n✅ Configured Services:');
    Object.entries(this.services).forEach(([service, enabled]) => {
      if (enabled) {
        const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
        console.log(`• ${serviceName}`);
      }
    });

    console.log('\n📁 Generated Files:');
    console.log('• backend/.env - Backend environment variables');
    console.log('• frontend/.env.local - Frontend environment variables');
    console.log('• env-setup-summary.json - Setup summary and next steps');

    console.log('\n💰 Cost Breakdown (Monthly):');
    let totalCost = 0;
    
    if (this.services.supabase) {
      console.log('• Supabase: $0 (Free tier: 500MB DB, 2GB bandwidth)');
    }
    if (this.services.sendgrid) {
      console.log('• SendGrid: $0 (Free tier: 100 emails/day)');
    }
    if (this.services.cloudinary) {
      console.log('• Cloudinary: $0 (Free tier: 25GB storage/bandwidth)');
    }
    if (this.services.openai) {
      console.log('• OpenAI: ~$5-20 (Pay-per-use, $5 free credit)');
      totalCost += 10; // Estimated
    }
    if (this.services.upstash) {
      console.log('• Upstash: $0 (Free tier: 10K commands/day)');
    }
    if (this.services.sentry) {
      console.log('• Sentry: $0 (Free tier: 5K errors/month)');
    }
    
    console.log(`\nEstimated Total: $${totalCost}/month`);

    console.log('\n🚀 Next Steps:');
    console.log('1. Review and update generated .env files');
    console.log('2. Replace [YOUR-PASSWORD] in database URLs');
    console.log('3. Test your application locally');
    console.log('4. Deploy to your chosen platform');
    console.log('5. Monitor service usage to stay within free tiers');

    console.log('\n📊 Usage Monitoring:');
    if (this.services.supabase) {
      console.log('• Supabase: https://supabase.com/dashboard/project/[id]/settings/billing');
    }
    if (this.services.sendgrid) {
      console.log('• SendGrid: https://app.sendgrid.com/statistics');
    }
    if (this.services.cloudinary) {
      console.log('• Cloudinary: https://cloudinary.com/console/usage');
    }
    if (this.services.openai) {
      console.log('• OpenAI: https://platform.openai.com/usage');
    }

    console.log('\n💡 Pro Tips:');
    console.log('• Set up billing alerts for paid services');
    console.log('• Keep API keys secure and rotate them regularly');
    console.log('• Use environment-specific configurations');
    console.log('• Monitor logs for any service issues');
    
    console.log('\n' + '='.repeat(60));
  }

  async run() {
    try {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║              🔧 ENVIRONMENT VARIABLE FETCHER                 ║
║                     Project UNIFY                            ║
║              Automated Freemium Service Setup                ║
╚══════════════════════════════════════════════════════════════╝
      `);

      this.log('Starting automated environment setup...', 'info');
      
      await this.setupSupabase();
      await this.setupSendGrid();
      await this.setupCloudinary();
      await this.setupOpenAI();
      await this.setupOptionalServices();
      
      this.generateEnvironmentFiles();
      
      this.log('Testing service connections...', 'info');
      const allTestsPassed = await this.testConnections();
      
      if (!allTestsPassed) {
        this.log('Some service connections failed. Please check your credentials.', 'warning');
      }
      
      await this.generateSummary();
      
    } catch (error) {
      this.log(`Setup failed: ${error.message}`, 'error');
      console.log('\n🔧 Troubleshooting:');
      console.log('• Check your internet connection');
      console.log('• Verify service credentials are correct');
      console.log('• Ensure services are not experiencing outages');
      console.log('• Try running the setup again');
      
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  const fetcher = new EnvFetcher();
  fetcher.run();
}

module.exports = EnvFetcher;