#!/usr/bin/env node

/**
 * Project UNIFY - Automated Vercel + Railway Deployment
 * One-click deployment script for frontend and backend
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

class VercelRailwayDeploy {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.config = {
      projectName: 'project-unify',
      frontendUrl: '',
      backendUrl: '',
      domain: null
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

  async execCommand(command, options = {}) {
    try {
      this.log(`Executing: ${command}`, 'info');
      const result = execSync(command, { 
        encoding: 'utf8', 
        stdio: options.silent ? 'pipe' : 'inherit',
        cwd: options.cwd || process.cwd()
      });
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error.message, output: error.stdout };
    }
  }

  async checkPrerequisites() {
    this.log('🔍 Checking prerequisites...', 'info');
    
    // Check Node.js
    const nodeCheck = await this.execCommand('node --version', { silent: true });
    if (!nodeCheck.success) {
      throw new Error('Node.js is required but not installed');
    }
    this.log(`Node.js: ${nodeCheck.output.trim()}`, 'success');

    // Check Git
    const gitCheck = await this.execCommand('git --version', { silent: true });
    if (!gitCheck.success) {
      throw new Error('Git is required but not installed');
    }
    this.log(`Git: ${gitCheck.output.trim()}`, 'success');

    // Check if we're in a Git repository
    const gitRepoCheck = await this.execCommand('git status', { silent: true });
    if (!gitRepoCheck.success) {
      this.log('Initializing Git repository...', 'info');
      await this.execCommand('git init');
      await this.execCommand('git add .');
      await this.execCommand('git commit -m "Initial commit"');
    }

    this.log('✓ Prerequisites check completed', 'success');
  }

  async installCLITools() {
    this.log('🛠️  Installing CLI tools...', 'info');

    // Check and install Vercel CLI
    const vercelCheck = await this.execCommand('vercel --version', { silent: true });
    if (!vercelCheck.success) {
      this.log('Installing Vercel CLI...', 'info');
      const vercelInstall = await this.execCommand('npm install -g vercel');
      if (!vercelInstall.success) {
        throw new Error('Failed to install Vercel CLI');
      }
    }
    this.log('✓ Vercel CLI ready', 'success');

    // Check and install Railway CLI
    const railwayCheck = await this.execCommand('railway --version', { silent: true });
    if (!railwayCheck.success) {
      this.log('Installing Railway CLI...', 'info');
      
      // Try different installation methods
      const installMethods = [
        'npm install -g @railway/cli',
        'curl -fsSL https://railway.app/install.sh | sh'
      ];
      
      let installed = false;
      for (const method of installMethods) {
        const result = await this.execCommand(method);
        if (result.success) {
          installed = true;
          break;
        }
      }
      
      if (!installed) {
        this.log('Please install Railway CLI manually:', 'warning');
        this.log('Visit: https://docs.railway.app/develop/cli#install', 'info');
        await this.question('Press Enter when Railway CLI is installed...');
      }
    }
    this.log('✓ Railway CLI ready', 'success');
  }

  async authenticateCLIs() {
    this.log('🔐 Authenticating with services...', 'info');

    // Vercel authentication
    this.log('Authenticating with Vercel...', 'info');
    const vercelAuth = await this.execCommand('vercel whoami', { silent: true });
    if (!vercelAuth.success) {
      this.log('Please login to Vercel:', 'info');
      await this.execCommand('vercel login');
    } else {
      this.log(`✓ Logged in to Vercel as: ${vercelAuth.output.trim()}`, 'success');
    }

    // Railway authentication
    this.log('Authenticating with Railway...', 'info');
    const railwayAuth = await this.execCommand('railway whoami', { silent: true });
    if (!railwayAuth.success) {
      this.log('Please login to Railway:', 'info');
      await this.execCommand('railway login');
    } else {
      this.log(`✓ Logged in to Railway`, 'success');
    }
  }

  async deployBackend() {
    this.log('🚀 Deploying backend to Railway...', 'info');

    // Check if backend directory exists
    if (!fs.existsSync(path.join(process.cwd(), 'backend'))) {
      throw new Error('Backend directory not found');
    }

    // Create railway.json configuration
    const railwayConfig = {
      "$schema": "https://railway.app/railway.schema.json",
      "build": {
        "builder": "NIXPACKS"
      },
      "deploy": {
        "startCommand": "npm start",
        "restartPolicyType": "ON_FAILURE",
        "restartPolicyMaxRetries": 10
      }
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'backend', 'railway.json'),
      JSON.stringify(railwayConfig, null, 2)
    );

    // Deploy to Railway
    const deployResult = await this.execCommand('railway up', {
      cwd: path.join(process.cwd(), 'backend')
    });

    if (!deployResult.success) {
      throw new Error('Backend deployment failed');
    }

    // Get Railway project info
    const projectInfo = await this.execCommand('railway status', {
      silent: true,
      cwd: path.join(process.cwd(), 'backend')
    });

    if (projectInfo.success) {
      // Extract URL from Railway status (this is a simplified approach)
      const urlMatch = projectInfo.output.match(/https:\/\/[^\s]+/);
      if (urlMatch) {
        this.config.backendUrl = urlMatch[0];
        this.log(`✓ Backend deployed: ${this.config.backendUrl}`, 'success');
      }
    }

    // Add PostgreSQL database
    this.log('Adding PostgreSQL database...', 'info');
    const dbResult = await this.execCommand('railway add --database postgresql', {
      cwd: path.join(process.cwd(), 'backend')
    });

    if (dbResult.success) {
      this.log('✓ PostgreSQL database added', 'success');
    }

    return this.config.backendUrl;
  }

  async deployFrontend(backendUrl) {
    this.log('🌐 Deploying frontend to Vercel...', 'info');

    // Check if frontend directory exists
    if (!fs.existsSync(path.join(process.cwd(), 'frontend'))) {
      throw new Error('Frontend directory not found');
    }

    // Create vercel.json configuration
    const vercelConfig = {
      "framework": "nextjs",
      "buildCommand": "npm run build",
      "outputDirectory": ".next",
      "installCommand": "npm install",
      "env": {
        "NEXT_PUBLIC_API_URL": backendUrl || "https://your-backend.up.railway.app"
      },
      "build": {
        "env": {
          "NEXT_PUBLIC_API_URL": backendUrl || "https://your-backend.up.railway.app"
        }
      }
    };

    fs.writeFileSync(
      path.join(process.cwd(), 'frontend', 'vercel.json'),
      JSON.stringify(vercelConfig, null, 2)
    );

    // Deploy to Vercel
    const deployResult = await this.execCommand('vercel --prod --yes', {
      cwd: path.join(process.cwd(), 'frontend')
    });

    if (!deployResult.success) {
      throw new Error('Frontend deployment failed');
    }

    // Extract Vercel URL from output
    const urlMatch = deployResult.output.match(/https:\/\/[^\s]+\.vercel\.app/);
    if (urlMatch) {
      this.config.frontendUrl = urlMatch[0];
      this.log(`✓ Frontend deployed: ${this.config.frontendUrl}`, 'success');
    }

    return this.config.frontendUrl;
  }

  async updateEnvironmentVariables() {
    this.log('⚙️  Updating environment variables...', 'info');

    if (this.config.frontendUrl && this.config.backendUrl) {
      // Update Railway environment variables
      this.log('Updating Railway backend environment...', 'info');
      
      const railwayEnvCommands = [
        `railway variables set FRONTEND_URL=${this.config.frontendUrl}`,
        `railway variables set CORS_ORIGIN=${this.config.frontendUrl}`,
        `railway variables set NODE_ENV=production`
      ];

      for (const command of railwayEnvCommands) {
        await this.execCommand(command, {
          cwd: path.join(process.cwd(), 'backend')
        });
      }

      // Update Vercel environment variables
      this.log('Updating Vercel frontend environment...', 'info');
      
      const vercelEnvCommands = [
        `vercel env add NEXT_PUBLIC_API_URL production`,
        `vercel env add NEXT_PUBLIC_APP_NAME production`
      ];

      // Note: Vercel CLI env commands are interactive, so we'll create a script
      const envScript = `#!/bin/bash
echo "${this.config.backendUrl}" | vercel env add NEXT_PUBLIC_API_URL production
echo "Project UNIFY" | vercel env add NEXT_PUBLIC_APP_NAME production
`;

      fs.writeFileSync(
        path.join(process.cwd(), 'frontend', 'update-env.sh'),
        envScript
      );

      await this.execCommand('chmod +x update-env.sh', {
        cwd: path.join(process.cwd(), 'frontend')
      });

      this.log('Environment update script created: frontend/update-env.sh', 'info');
      this.log('Run this script to update Vercel environment variables', 'warning');
    }
  }

  async setupCustomDomain() {
    const hasDomain = await this.question('Do you have a custom domain to configure? (y/N): ');
    
    if (hasDomain.toLowerCase() === 'y') {
      const domain = await this.question('Enter your domain (e.g., myapp.com): ');
      this.config.domain = domain;

      this.log('Setting up custom domain...', 'info');
      
      // Add domain to Vercel
      this.log('Adding domain to Vercel frontend...', 'info');
      await this.execCommand(`vercel domains add ${domain}`, {
        cwd: path.join(process.cwd(), 'frontend')
      });

      // Add API subdomain to Railway
      this.log('Configure DNS for your domain:', 'info');
      this.log(`1. Add CNAME record: ${domain} -> cname.vercel-dns.com`, 'info');
      this.log(`2. Add CNAME record: api.${domain} -> your-backend.up.railway.app`, 'info');
      
      // Update environment variables with custom domain
      this.config.frontendUrl = `https://${domain}`;
      this.config.backendUrl = `https://api.${domain}`;
      
      await this.updateEnvironmentVariables();
    }
  }

  async runHealthChecks() {
    this.log('🏥 Running health checks...', 'info');

    if (this.config.backendUrl) {
      this.log('Checking backend health...', 'info');
      
      // Wait a moment for deployment to be ready
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      try {
        const healthCheck = await this.execCommand(`curl -f ${this.config.backendUrl}/health`, { silent: true });
        if (healthCheck.success) {
          this.log('✓ Backend health check passed', 'success');
        } else {
          this.log('⚠️ Backend health check failed - may need time to start', 'warning');
        }
      } catch (error) {
        this.log('⚠️ Could not perform backend health check', 'warning');
      }
    }

    if (this.config.frontendUrl) {
      this.log('Checking frontend accessibility...', 'info');
      
      try {
        const frontendCheck = await this.execCommand(`curl -f ${this.config.frontendUrl}`, { silent: true });
        if (frontendCheck.success) {
          this.log('✓ Frontend accessibility check passed', 'success');
        } else {
          this.log('⚠️ Frontend accessibility check failed', 'warning');
        }
      } catch (error) {
        this.log('⚠️ Could not perform frontend accessibility check', 'warning');
      }
    }
  }

  async generateDeploymentSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DEPLOYMENT COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n🚀 Your Project UNIFY is now live:');
    
    if (this.config.frontendUrl) {
      console.log(`Frontend: ${this.config.frontendUrl}`);
    }
    
    if (this.config.backendUrl) {
      console.log(`Backend API: ${this.config.backendUrl}`);
    }

    console.log('\n⚙️  Management Commands:');
    console.log('• View Vercel deployments: vercel ls');
    console.log('• View Railway projects: railway list');
    console.log('• Check logs: railway logs (in backend directory)');
    console.log('• Redeploy frontend: vercel --prod (in frontend directory)');
    console.log('• Redeploy backend: railway up (in backend directory)');

    if (this.config.domain) {
      console.log('\n🌐 DNS Configuration:');
      console.log(`• ${this.config.domain} -> cname.vercel-dns.com`);
      console.log(`• api.${this.config.domain} -> [railway-url]`);
    }

    console.log('\n📊 Monitoring:');
    console.log('• Vercel Analytics: https://vercel.com/analytics');
    console.log('• Railway Metrics: https://railway.app/dashboard');

    console.log('\n💡 Next Steps:');
    console.log('• Test your application thoroughly');
    console.log('• Set up monitoring and alerts');
    console.log('• Configure backup strategies');
    console.log('• Review security settings');
    console.log('• Set up CI/CD for automated deployments');

    console.log('\n📚 Resources:');
    console.log('• Vercel Docs: https://vercel.com/docs');
    console.log('• Railway Docs: https://docs.railway.app');
    console.log('• Project UNIFY Docs: ./docs/');
    
    console.log('\n' + '='.repeat(60));
  }

  async run() {
    try {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║               🚀 VERCEL + RAILWAY DEPLOYMENT                 ║
║                     Project UNIFY                            ║
╚══════════════════════════════════════════════════════════════╝
      `);

      await this.checkPrerequisites();
      await this.installCLITools();
      await this.authenticateCLIs();
      
      const backendUrl = await this.deployBackend();
      const frontendUrl = await this.deployFrontend(backendUrl);
      
      await this.updateEnvironmentVariables();
      await this.setupCustomDomain();
      await this.runHealthChecks();
      await this.generateDeploymentSummary();
      
    } catch (error) {
      this.log(`Deployment failed: ${error.message}`, 'error');
      
      console.log('\n🔧 Troubleshooting:');
      console.log('• Check that all prerequisites are installed');
      console.log('• Verify you are logged into Vercel and Railway');
      console.log('• Ensure your project has valid package.json files');
      console.log('• Check the deployment logs for specific errors');
      
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// Run deployment if called directly
if (require.main === module) {
  const deploy = new VercelRailwayDeploy();
  deploy.run();
}

module.exports = VercelRailwayDeploy;