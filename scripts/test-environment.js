#!/usr/bin/env node

/**
 * Environment Setup Testing Script
 * Tests various service configurations and environment variables
 */

const axios = require('axios');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class EnvironmentTester {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
    this.config = this.loadConfig();
  }

  loadConfig() {
    const backendEnvPath = path.join(__dirname, '../backend/.env');
    const frontendEnvPath = path.join(__dirname, '../frontend/.env.local');
    
    const config = {
      backend: {},
      frontend: {}
    };

    // Load backend environment
    if (fs.existsSync(backendEnvPath)) {
      const backendEnv = fs.readFileSync(backendEnvPath, 'utf8');
      backendEnv.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          config.backend[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
      });
    }

    // Load frontend environment
    if (fs.existsSync(frontendEnvPath)) {
      const frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
      frontendEnv.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          config.frontend[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
        }
      });
    }

    return config;
  }

  async test(name, testFn, type = 'required') {
    try {
      console.log(`🧪 Testing: ${name}`);
      const result = await testFn();
      
      if (result.status === 'pass') {
        this.results.passed++;
        this.results.tests.push({ name, status: 'PASSED', type, message: result.message });
        console.log(`✅ ${name} - PASSED`);
      } else if (result.status === 'warn') {
        this.results.warnings++;
        this.results.tests.push({ name, status: 'WARNING', type, message: result.message });
        console.log(`⚠️  ${name} - WARNING: ${result.message}`);
      }
    } catch (error) {
      this.results.failed++;
      this.results.tests.push({ name, status: 'FAILED', type, error: error.message });
      console.log(`❌ ${name} - FAILED: ${error.message}`);
    }
  }

  // Database Tests
  async testDatabaseConnection() {
    return this.test('Database Connection', async () => {
      const dbUrl = this.config.backend.DATABASE_URL;
      
      if (!dbUrl) {
        throw new Error('DATABASE_URL not configured');
      }

      if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
        return { status: 'warn', message: 'Using local database - ensure PostgreSQL is running' };
      }

      // Test connection for cloud databases
      if (dbUrl.includes('supabase.co')) {
        try {
          const response = await axios.get('https://api.supabase.com/v1/projects', {
            timeout: 5000
          });
          return { status: 'pass', message: 'Supabase service is accessible' };
        } catch (error) {
          throw new Error('Cannot reach Supabase service');
        }
      }

      if (dbUrl.includes('neon.tech')) {
        return { status: 'pass', message: 'Neon database URL format detected' };
      }

      return { status: 'pass', message: 'Database URL configured' };
    });
  }

  async testJWTSecrets() {
    return this.test('JWT Secrets', async () => {
      const jwtSecret = this.config.backend.JWT_SECRET;
      const refreshSecret = this.config.backend.JWT_REFRESH_SECRET;

      if (!jwtSecret || !refreshSecret) {
        throw new Error('JWT secrets not configured');
      }

      if (jwtSecret.length < 32 || refreshSecret.length < 32) {
        throw new Error('JWT secrets should be at least 32 characters long');
      }

      if (jwtSecret === refreshSecret) {
        throw new Error('JWT_SECRET and JWT_REFRESH_SECRET should be different');
      }

      if (jwtSecret.includes('your-') || jwtSecret.includes('change-this')) {
        throw new Error('Please change default JWT secret values');
      }

      return { status: 'pass', message: 'JWT secrets properly configured' };
    });
  }

  // Email Service Tests
  async testEmailService() {
    return this.test('Email Service', async () => {
      const sendgridKey = this.config.backend.SENDGRID_API_KEY;
      const mailgunKey = this.config.backend.MAILGUN_API_KEY;
      const resendKey = this.config.backend.RESEND_API_KEY;

      if (!sendgridKey && !mailgunKey && !resendKey) {
        return { status: 'warn', message: 'No email service configured - emails will not work' };
      }

      // Test SendGrid
      if (sendgridKey) {
        if (!sendgridKey.startsWith('SG.')) {
          throw new Error('Invalid SendGrid API key format');
        }
        
        try {
          const response = await axios.get('https://api.sendgrid.com/v3/user/profile', {
            headers: { 'Authorization': `Bearer ${sendgridKey}` },
            timeout: 5000
          });
          return { status: 'pass', message: 'SendGrid API key is valid' };
        } catch (error) {
          if (error.response?.status === 401) {
            throw new Error('SendGrid API key is invalid');
          }
          return { status: 'warn', message: 'Cannot verify SendGrid key (network issue)' };
        }
      }

      // Test Mailgun
      if (mailgunKey) {
        const domain = this.config.backend.MAILGUN_DOMAIN;
        if (!domain) {
          throw new Error('MAILGUN_DOMAIN required when using Mailgun');
        }
        return { status: 'pass', message: 'Mailgun configuration detected' };
      }

      // Test Resend
      if (resendKey) {
        if (!resendKey.startsWith('re_')) {
          throw new Error('Invalid Resend API key format');
        }
        return { status: 'pass', message: 'Resend API key format is correct' };
      }

      return { status: 'pass', message: 'Email service configured' };
    }, 'optional');
  }

  // Storage Service Tests
  async testStorageService() {
    return this.test('Storage Service', async () => {
      const awsKey = this.config.backend.AWS_ACCESS_KEY_ID;
      const cloudinaryName = this.config.backend.CLOUDINARY_CLOUD_NAME;
      const supabaseUrl = this.config.backend.SUPABASE_URL;

      if (!awsKey && !cloudinaryName && !supabaseUrl) {
        return { status: 'warn', message: 'No cloud storage configured - using local storage' };
      }

      // Test AWS S3
      if (awsKey) {
        const awsSecret = this.config.backend.AWS_SECRET_ACCESS_KEY;
        const s3Bucket = this.config.backend.AWS_S3_BUCKET;

        if (!awsSecret || !s3Bucket) {
          throw new Error('AWS S3 configuration incomplete');
        }

        if (awsKey.length < 16 || awsSecret.length < 32) {
          throw new Error('AWS credentials appear to be invalid');
        }

        return { status: 'pass', message: 'AWS S3 configuration detected' };
      }

      // Test Cloudinary
      if (cloudinaryName) {
        const apiKey = this.config.backend.CLOUDINARY_API_KEY;
        const apiSecret = this.config.backend.CLOUDINARY_API_SECRET;

        if (!apiKey || !apiSecret) {
          throw new Error('Cloudinary configuration incomplete');
        }

        try {
          const response = await axios.get(`https://res.cloudinary.com/${cloudinaryName}/image/upload/sample.jpg`, {
            timeout: 5000
          });
          return { status: 'pass', message: 'Cloudinary service is accessible' };
        } catch (error) {
          return { status: 'warn', message: 'Cloudinary configured but not accessible' };
        }
      }

      // Test Supabase Storage
      if (supabaseUrl) {
        const anonKey = this.config.backend.SUPABASE_ANON_KEY;
        if (!anonKey) {
          throw new Error('SUPABASE_ANON_KEY required for Supabase storage');
        }
        return { status: 'pass', message: 'Supabase storage configuration detected' };
      }

      return { status: 'pass', message: 'Storage service configured' };
    }, 'optional');
  }

  // AI Service Tests
  async testAIServices() {
    return this.test('AI Services', async () => {
      const openaiKey = this.config.backend.OPENAI_API_KEY;
      const huggingfaceKey = this.config.backend.HUGGINGFACE_API_KEY;
      const cohereKey = this.config.backend.COHERE_API_KEY;

      if (!openaiKey && !huggingfaceKey && !cohereKey) {
        return { status: 'warn', message: 'No AI service configured - AI features will not work' };
      }

      // Test OpenAI
      if (openaiKey) {
        if (!openaiKey.startsWith('sk-')) {
          throw new Error('Invalid OpenAI API key format');
        }

        try {
          const response = await axios.get('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${openaiKey}` },
            timeout: 10000
          });
          return { status: 'pass', message: 'OpenAI API key is valid' };
        } catch (error) {
          if (error.response?.status === 401) {
            throw new Error('OpenAI API key is invalid');
          }
          return { status: 'warn', message: 'Cannot verify OpenAI key (network issue)' };
        }
      }

      // Test Hugging Face
      if (huggingfaceKey) {
        if (!huggingfaceKey.startsWith('hf_')) {
          throw new Error('Invalid Hugging Face API key format');
        }
        return { status: 'pass', message: 'Hugging Face API key format is correct' };
      }

      // Test Cohere
      if (cohereKey) {
        return { status: 'pass', message: 'Cohere API key configured' };
      }

      return { status: 'pass', message: 'AI service configured' };
    }, 'optional');
  }

  // Redis Tests
  async testRedisConnection() {
    return this.test('Redis Connection', async () => {
      const redisUrl = this.config.backend.REDIS_URL;

      if (!redisUrl) {
        return { status: 'warn', message: 'Redis not configured - caching will not work' };
      }

      if (redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1')) {
        return { status: 'warn', message: 'Using local Redis - ensure Redis is running' };
      }

      if (redisUrl.includes('upstash.io')) {
        return { status: 'pass', message: 'Upstash Redis configuration detected' };
      }

      if (redisUrl.includes('redislabs.com') || redisUrl.includes('redis.com')) {
        return { status: 'pass', message: 'Redis Cloud configuration detected' };
      }

      return { status: 'pass', message: 'Redis URL configured' };
    }, 'optional');
  }

  // Frontend Tests
  async testFrontendConfig() {
    return this.test('Frontend Configuration', async () => {
      const apiUrl = this.config.frontend.NEXT_PUBLIC_API_URL;
      
      if (!apiUrl) {
        throw new Error('NEXT_PUBLIC_API_URL not configured');
      }

      if (apiUrl.includes('localhost')) {
        return { status: 'warn', message: 'Using localhost API URL - ensure backend is running' };
      }

      try {
        const response = await axios.get(`${apiUrl}/health`, { timeout: 5000 });
        return { status: 'pass', message: 'Backend API is accessible' };
      } catch (error) {
        return { status: 'warn', message: 'Backend API not accessible (may not be running)' };
      }
    });
  }

  async testAnalyticsConfig() {
    return this.test('Analytics Configuration', async () => {
      const gaId = this.config.frontend.NEXT_PUBLIC_GA_MEASUREMENT_ID;
      const hotjarId = this.config.frontend.NEXT_PUBLIC_HOTJAR_ID;
      const mixpanelToken = this.config.frontend.NEXT_PUBLIC_MIXPANEL_TOKEN;

      if (!gaId && !hotjarId && !mixpanelToken) {
        return { status: 'warn', message: 'No analytics configured - user tracking will not work' };
      }

      let configured = [];

      if (gaId) {
        if (!gaId.startsWith('G-')) {
          throw new Error('Invalid Google Analytics Measurement ID format');
        }
        configured.push('Google Analytics');
      }

      if (hotjarId) {
        configured.push('Hotjar');
      }

      if (mixpanelToken) {
        configured.push('Mixpanel');
      }

      return { status: 'pass', message: `Analytics configured: ${configured.join(', ')}` };
    }, 'optional');
  }

  // Security Tests
  async testSecurityConfig() {
    return this.test('Security Configuration', async () => {
      const nodeEnv = this.config.backend.NODE_ENV;
      const corsOrigin = this.config.backend.CORS_ORIGIN;
      const forceHttps = this.config.backend.FORCE_HTTPS;

      let issues = [];

      if (nodeEnv !== 'production' && nodeEnv !== 'development') {
        issues.push('NODE_ENV should be "production" or "development"');
      }

      if (!corsOrigin) {
        issues.push('CORS_ORIGIN not configured');
      } else if (corsOrigin.includes('*')) {
        issues.push('CORS_ORIGIN allows all origins (security risk in production)');
      }

      if (nodeEnv === 'production' && forceHttps !== 'true') {
        issues.push('FORCE_HTTPS should be enabled in production');
      }

      if (issues.length > 0) {
        return { status: 'warn', message: issues.join('; ') };
      }

      return { status: 'pass', message: 'Security configuration looks good' };
    });
  }

  // Payment Tests
  async testPaymentConfig() {
    return this.test('Payment Configuration', async () => {
      const stripeSecret = this.config.backend.STRIPE_SECRET_KEY;
      const stripePub = this.config.frontend.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
      const paypalId = this.config.frontend.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

      if (!stripeSecret && !paypalId) {
        return { status: 'warn', message: 'No payment processor configured' };
      }

      if (stripeSecret) {
        if (!stripeSecret.startsWith('sk_')) {
          throw new Error('Invalid Stripe secret key format');
        }

        if (!stripePub) {
          throw new Error('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY required with Stripe');
        }

        if (!stripePub.startsWith('pk_')) {
          throw new Error('Invalid Stripe publishable key format');
        }

        const isTest = stripeSecret.includes('test') && stripePub.includes('test');
        const isLive = !stripeSecret.includes('test') && !stripePub.includes('test');

        if (!isTest && !isLive) {
          throw new Error('Stripe keys mismatch (test/live)');
        }

        return { 
          status: 'pass', 
          message: `Stripe configured (${isTest ? 'test' : 'live'} mode)` 
        };
      }

      if (paypalId) {
        return { status: 'pass', message: 'PayPal configuration detected' };
      }

      return { status: 'pass', message: 'Payment configuration detected' };
    }, 'optional');
  }

  // Monitoring Tests
  async testMonitoringConfig() {
    return this.test('Monitoring Configuration', async () => {
      const sentryDsn = this.config.backend.SENTRY_DSN;
      const frontendSentry = this.config.frontend.NEXT_PUBLIC_SENTRY_DSN;

      if (!sentryDsn && !frontendSentry) {
        return { status: 'warn', message: 'No error tracking configured' };
      }

      let configured = [];

      if (sentryDsn) {
        if (!sentryDsn.startsWith('https://')) {
          throw new Error('Invalid Sentry DSN format');
        }
        configured.push('Backend error tracking');
      }

      if (frontendSentry) {
        if (!frontendSentry.startsWith('https://')) {
          throw new Error('Invalid frontend Sentry DSN format');
        }
        configured.push('Frontend error tracking');
      }

      return { status: 'pass', message: `Monitoring configured: ${configured.join(', ')}` };
    }, 'optional');
  }

  // System Tests
  async testSystemRequirements() {
    return this.test('System Requirements', async () => {
      const issues = [];

      // Check Node.js version
      try {
        const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
        const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
        
        if (majorVersion < 18) {
          issues.push(`Node.js ${majorVersion} detected, requires 18+`);
        }
      } catch (error) {
        issues.push('Node.js not found');
      }

      // Check npm/pnpm
      try {
        execSync('pnpm --version', { encoding: 'utf8' });
      } catch (error) {
        try {
          execSync('npm --version', { encoding: 'utf8' });
        } catch (error) {
          issues.push('Neither npm nor pnpm found');
        }
      }

      // Check Docker (optional)
      try {
        execSync('docker --version', { encoding: 'utf8' });
      } catch (error) {
        // Docker is optional, just note it
      }

      if (issues.length > 0) {
        throw new Error(issues.join('; '));
      }

      return { status: 'pass', message: 'System requirements met' };
    });
  }

  async runAllTests() {
    console.log('🚀 Starting Project UNIFY Environment Tests\n');
    console.log('==========================================\n');

    // Required tests
    await this.testSystemRequirements();
    await this.testDatabaseConnection();
    await this.testJWTSecrets();
    await this.testFrontendConfig();
    await this.testSecurityConfig();

    // Optional service tests
    await this.testEmailService();
    await this.testStorageService();
    await this.testAIServices();
    await this.testRedisConnection();
    await this.testAnalyticsConfig();
    await this.testPaymentConfig();
    await this.testMonitoringConfig();

    this.generateReport();
  }

  generateReport() {
    const total = this.results.passed + this.results.failed + this.results.warnings;
    
    console.log('\n📊 ENVIRONMENT TEST SUMMARY');
    console.log('============================');
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${this.results.passed}`);
    console.log(`❌ Failed: ${this.results.failed}`);
    console.log(`⚠️  Warnings: ${this.results.warnings}`);
    
    const successRate = ((this.results.passed / total) * 100).toFixed(1);
    console.log(`Success Rate: ${successRate}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ FAILED TESTS (Must Fix):');
      this.results.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.error}`);
        });
    }

    if (this.results.warnings > 0) {
      console.log('\n⚠️  WARNINGS (Recommended to Fix):');
      this.results.tests
        .filter(test => test.status === 'WARNING')
        .forEach(test => {
          console.log(`  - ${test.name}: ${test.message}`);
        });
    }

    console.log('\n✅ PASSED TESTS:');
    this.results.tests
      .filter(test => test.status === 'PASSED')
      .forEach(test => {
        console.log(`  - ${test.name}: ${test.message}`);
      });

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed: this.results.passed,
        failed: this.results.failed,
        warnings: this.results.warnings,
        successRate: `${successRate}%`
      },
      tests: this.results.tests
    };

    fs.writeFileSync(
      path.join(__dirname, '../environment-test-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n📄 Detailed report saved to: environment-test-report.json');

    if (this.results.failed > 0) {
      console.log('\n🚨 Some tests failed. Please fix the issues before deploying to production.');
      process.exit(1);
    } else {
      console.log('\n🎉 Environment configuration looks good! Ready for deployment.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new EnvironmentTester();
  tester.runAllTests().catch(error => {
    console.error('Test runner error:', error.message);
    process.exit(1);
  });
}

module.exports = EnvironmentTester;