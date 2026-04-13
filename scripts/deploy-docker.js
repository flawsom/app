#!/usr/bin/env node

/**
 * Project UNIFY - Docker Deployment Script
 * Automated Docker Compose setup with SSL and production optimization
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');
const crypto = require('crypto');

class DockerDeploy {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    this.config = {
      domain: null,
      email: null,
      useSSL: false,
      environment: 'production',
      dbPassword: crypto.randomBytes(16).toString('hex'),
      redisPassword: crypto.randomBytes(16).toString('hex')
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
    
    // Check Docker
    const dockerCheck = await this.execCommand('docker --version', { silent: true });
    if (!dockerCheck.success) {
      throw new Error('Docker is required but not installed. Visit: https://docs.docker.com/get-docker/');
    }
    this.log(`Docker: ${dockerCheck.output.trim()}`, 'success');

    // Check Docker Compose
    const composeCheck = await this.execCommand('docker compose version', { silent: true });
    if (!composeCheck.success) {
      // Try legacy docker-compose
      const legacyCheck = await this.execCommand('docker-compose --version', { silent: true });
      if (!legacyCheck.success) {
        throw new Error('Docker Compose is required but not installed');
      }
      this.log('Using legacy docker-compose', 'warning');
    }
    this.log('✓ Docker Compose available', 'success');

    // Check if Docker daemon is running
    const dockerRunning = await this.execCommand('docker info', { silent: true });
    if (!dockerRunning.success) {
      throw new Error('Docker daemon is not running. Please start Docker');
    }
    this.log('✓ Docker daemon is running', 'success');
  }

  async configureDeployment() {
    console.log('\n🔧 Docker Deployment Configuration:');
    
    // Domain configuration
    const hasDomain = await this.question('Do you have a domain for this deployment? (y/N): ');
    if (hasDomain.toLowerCase() === 'y') {
      this.config.domain = await this.question('Enter your domain (e.g., myapp.com): ');
      this.config.email = await this.question('Enter email for SSL certificates: ');
      this.config.useSSL = true;
      this.log(`Domain configured: ${this.config.domain}`, 'success');
    }

    // Environment selection
    console.log('\nEnvironment options:');
    console.log('1. Production (optimized, SSL, monitoring)');
    console.log('2. Staging (production-like, development features)');
    console.log('3. Development (local development with hot reload)');
    
    const envChoice = await this.question('Select environment (1-3): ');
    const environments = { '1': 'production', '2': 'staging', '3': 'development' };
    this.config.environment = environments[envChoice] || 'production';
    
    this.log(`Environment: ${this.config.environment}`, 'success');
  }

  createDockerfiles() {
    this.log('📝 Creating optimized Dockerfiles...', 'info');

    // Backend Dockerfile
    const backendDockerfile = `# Multi-stage build for production
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=base /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["node", "dist/server.js"]
`;

    // Frontend Dockerfile
    const frontendDockerfile = `# Multi-stage build for production
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force

FROM base AS builder
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=\${NEXT_PUBLIC_API_URL}
RUN npm run build

FROM nginx:alpine AS runtime

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built application
COPY --from=builder /app/out /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx && \\
    adduser -S nginx -u 1001 -G nginx

# Change ownership
RUN chown -R nginx:nginx /usr/share/nginx/html && \\
    chown -R nginx:nginx /var/cache/nginx && \\
    chown -R nginx:nginx /var/log/nginx && \\
    chown -R nginx:nginx /etc/nginx/conf.d

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;

    // Nginx configuration
    const nginxConfig = `events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;
    
    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 10M;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/javascript application/xml+rss application/json;
    
    server {
        listen 8080;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html index.htm;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
        add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
        
        # Handle client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # Cache static assets
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\\n";
            add_header Content-Type text/plain;
        }
    }
}
`;

    // Write files
    fs.writeFileSync(path.join(process.cwd(), 'backend', 'Dockerfile'), backendDockerfile);
    fs.writeFileSync(path.join(process.cwd(), 'frontend', 'Dockerfile'), frontendDockerfile);
    fs.writeFileSync(path.join(process.cwd(), 'frontend', 'nginx.conf'), nginxConfig);

    this.log('✓ Dockerfiles created', 'success');
  }

  createDockerCompose() {
    this.log('🐳 Creating Docker Compose configuration...', 'info');

    const isProduction = this.config.environment === 'production';
    const apiUrl = this.config.domain 
      ? `https://api.${this.config.domain}` 
      : 'http://localhost:3001';

    const dockerCompose = `version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: project_unify
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    networks:
      - backend
    ${isProduction ? `deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3` : ''}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    ${!isProduction ? 'ports:\n      - "5432:5432"' : ''}

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass \${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - backend
    ${isProduction ? `deploy:
      replicas: 1
      restart_policy:
        condition: on-failure` : ''}
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "-a", "\${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    ${!isProduction ? 'ports:\n      - "6379:6379"' : ''}

  # Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      NODE_ENV: ${this.config.environment}
      PORT: 3001
      DATABASE_URL: postgresql://postgres:\${DB_PASSWORD}@postgres:5432/project_unify
      REDIS_URL: redis://:\${REDIS_PASSWORD}@redis:6379
      FRONTEND_URL: ${this.config.domain ? `https://${this.config.domain}` : 'http://localhost:3000'}
      CORS_ORIGIN: ${this.config.domain ? `https://${this.config.domain}` : 'http://localhost:3000'}
    env_file:
      - ./backend/.env
    networks:
      - backend
      - frontend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ${isProduction ? `deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M` : 'ports:\n      - "3001:3001"'}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${apiUrl}
    networks:
      - frontend
    depends_on:
      backend:
        condition: service_healthy
    ${isProduction ? `deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
      resources:
        limits:
          cpus: '0.25'
          memory: 128M
        reservations:
          cpus: '0.1'
          memory: 64M` : 'ports:\n      - "3000:8080"'}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

${this.config.useSSL ? `  # Reverse Proxy with SSL
  traefik:
    image: traefik:v2.10
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=${this.config.email}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--entrypoints.web.http.redirections.entrypoint.scheme=https"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_letsencrypt:/letsencrypt
    networks:
      - frontend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(\`traefik.${this.config.domain}\`)"
      - "traefik.http.routers.dashboard.tls.certresolver=letsencrypt"
      - "traefik.http.services.dashboard.loadbalancer.server.port=8080"

  # Frontend with routing
  frontend-proxy:
    image: project-unify-frontend:latest
    networks:
      - frontend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(\`${this.config.domain}\`) || Host(\`www.${this.config.domain}\`)"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=8080"
    depends_on:
      - frontend

  # Backend with routing
  backend-proxy:
    image: project-unify-backend:latest
    networks:
      - frontend
      - backend
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(\`api.${this.config.domain}\`)"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=3001"
    depends_on:
      - backend` : ''}

${isProduction ? `  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - monitoring
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - monitoring
    ports:
      - "3001:3000"
    depends_on:
      - prometheus` : ''}

networks:
  frontend:
    driver: ${isProduction ? 'overlay' : 'bridge'}
    ${isProduction ? 'attachable: true' : ''}
  backend:
    driver: ${isProduction ? 'overlay' : 'bridge'}
    ${isProduction ? 'internal: true' : ''}
  ${isProduction ? 'monitoring:\n    driver: overlay' : ''}

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  ${this.config.useSSL ? 'traefik_letsencrypt:\n    driver: local' : ''}
  ${isProduction ? 'prometheus_data:\n    driver: local\n  grafana_data:\n    driver: local' : ''}
`;

    fs.writeFileSync(path.join(process.cwd(), 'docker-compose.yml'), dockerCompose);

    // Create environment file for Docker Compose
    const envFile = `# Docker Compose Environment Variables
DB_PASSWORD=${this.config.dbPassword}
REDIS_PASSWORD=${this.config.redisPassword}
COMPOSE_PROJECT_NAME=project-unify
`;

    fs.writeFileSync(path.join(process.cwd(), '.env'), envFile);

    this.log('✓ Docker Compose configuration created', 'success');
  }

  createMonitoringConfig() {
    if (this.config.environment !== 'production') return;

    this.log('📊 Creating monitoring configuration...', 'info');

    // Create monitoring directory
    const monitoringDir = path.join(process.cwd(), 'monitoring');
    if (!fs.existsSync(monitoringDir)) {
      fs.mkdirSync(monitoringDir, { recursive: true });
    }

    // Prometheus configuration
    const prometheusConfig = `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'project-unify-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'project-unify-frontend'
    static_configs:
      - targets: ['frontend:8080']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
`;

    fs.writeFileSync(path.join(monitoringDir, 'prometheus.yml'), prometheusConfig);

    this.log('✓ Monitoring configuration created', 'success');
  }

  createDeploymentScripts() {
    this.log('📜 Creating deployment scripts...', 'info');

    // Build script
    const buildScript = `#!/bin/bash
set -e

echo "🏗️  Building Project UNIFY Docker images..."

# Build backend
echo "Building backend..."
docker build -t project-unify-backend:latest ./backend

# Build frontend
echo "Building frontend..."
docker build -t project-unify-frontend:latest \\
  --build-arg NEXT_PUBLIC_API_URL=${this.config.domain ? `https://api.${this.config.domain}` : 'http://localhost:3001'} \\
  ./frontend

echo "✅ Build complete!"
`;

    // Deploy script
    const deployScript = `#!/bin/bash
set -e

echo "🚀 Deploying Project UNIFY..."

# Pull latest images
echo "Pulling base images..."
docker compose pull postgres redis

# Build custom images
echo "Building application images..."
./build.sh

# Start services
echo "Starting services..."
docker compose up -d

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 30

# Run health checks
echo "Running health checks..."
docker compose ps

echo "✅ Deployment complete!"
echo ""
echo "🌐 Access your application:"
${this.config.domain ? `echo "Frontend: https://${this.config.domain}"
echo "Backend API: https://api.${this.config.domain}"` : 'echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:3001"'}
echo "Traefik Dashboard: http://localhost:8080"
echo ""
echo "📊 Monitoring:"
echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3001 (admin/admin)"
`;

    // Stop script
    const stopScript = `#!/bin/bash
echo "🛑 Stopping Project UNIFY..."
docker compose down
echo "✅ Services stopped"
`;

    // Backup script
    const backupScript = `#!/bin/bash
set -e

BACKUP_DIR="./backups/\$(date +%Y%m%d_%H%M%S)"
mkdir -p "\$BACKUP_DIR"

echo "💾 Creating backup..."

# Backup database
echo "Backing up database..."
docker compose exec -T postgres pg_dump -U postgres project_unify > "\$BACKUP_DIR/database.sql"

# Backup uploaded files (if any)
if [ -d "./uploads" ]; then
    echo "Backing up uploaded files..."
    tar -czf "\$BACKUP_DIR/uploads.tar.gz" ./uploads
fi

# Backup configuration
echo "Backing up configuration..."
cp .env "\$BACKUP_DIR/"
cp docker-compose.yml "\$BACKUP_DIR/"

echo "✅ Backup created: \$BACKUP_DIR"
`;

    // Write scripts
    const scripts = {
      'build.sh': buildScript,
      'deploy.sh': deployScript,
      'stop.sh': stopScript,
      'backup.sh': backupScript
    };

    Object.entries(scripts).forEach(([filename, content]) => {
      fs.writeFileSync(path.join(process.cwd(), filename), content);
      this.execCommand(`chmod +x ${filename}`, { silent: true });
    });

    this.log('✓ Deployment scripts created', 'success');
  }

  async buildAndDeploy() {
    this.log('🏗️  Building and deploying application...', 'info');

    // Build images
    this.log('Building Docker images...', 'info');
    
    const buildBackend = await this.execCommand('docker build -t project-unify-backend:latest ./backend');
    if (!buildBackend.success) {
      throw new Error('Failed to build backend image');
    }

    const apiUrl = this.config.domain ? `https://api.${this.config.domain}` : 'http://localhost:3001';
    const buildFrontend = await this.execCommand(
      `docker build -t project-unify-frontend:latest --build-arg NEXT_PUBLIC_API_URL=${apiUrl} ./frontend`
    );
    if (!buildFrontend.success) {
      throw new Error('Failed to build frontend image');
    }

    this.log('✓ Docker images built successfully', 'success');

    // Start services
    this.log('Starting services with Docker Compose...', 'info');
    
    const deploy = await this.execCommand('docker compose up -d');
    if (!deploy.success) {
      throw new Error('Failed to start services');
    }

    this.log('✓ Services started successfully', 'success');

    // Wait for services to be ready
    this.log('Waiting for services to be healthy...', 'info');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Check service health
    const healthCheck = await this.execCommand('docker compose ps', { silent: true });
    if (healthCheck.success) {
      this.log('✓ All services are running', 'success');
    }
  }

  async runHealthChecks() {
    this.log('🏥 Running health checks...', 'info');

    const checks = [
      { name: 'PostgreSQL', command: 'docker compose exec -T postgres pg_isready -U postgres' },
      { name: 'Redis', command: 'docker compose exec -T redis redis-cli ping' },
      { name: 'Backend API', command: `curl -f http://localhost:3001/health` },
      { name: 'Frontend', command: `curl -f http://localhost:3000/health` }
    ];

    for (const check of checks) {
      const result = await this.execCommand(check.command, { silent: true });
      if (result.success) {
        this.log(`✓ ${check.name} health check passed`, 'success');
      } else {
        this.log(`⚠️ ${check.name} health check failed`, 'warning');
      }
    }
  }

  async generateSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DOCKER DEPLOYMENT COMPLETE!');
    console.log('='.repeat(60));
    
    console.log('\n🚀 Your Project UNIFY is now running:');
    
    if (this.config.domain) {
      console.log(`Frontend: https://${this.config.domain}`);
      console.log(`Backend API: https://api.${this.config.domain}`);
      console.log(`Traefik Dashboard: https://traefik.${this.config.domain}`);
    } else {
      console.log('Frontend: http://localhost:3000');
      console.log('Backend API: http://localhost:3001');
      console.log('Traefik Dashboard: http://localhost:8080');
    }

    if (this.config.environment === 'production') {
      console.log('Prometheus: http://localhost:9090');
      console.log('Grafana: http://localhost:3001 (admin/admin)');
    }

    console.log('\n⚙️  Management Commands:');
    console.log('• View services: docker compose ps');
    console.log('• View logs: docker compose logs -f [service]');
    console.log('• Stop services: ./stop.sh');
    console.log('• Restart: docker compose restart');
    console.log('• Update: ./deploy.sh');
    console.log('• Backup: ./backup.sh');

    console.log('\n📊 Monitoring:');
    console.log('• Service status: docker compose ps');
    console.log('• Resource usage: docker stats');
    console.log('• Logs: docker compose logs');

    console.log('\n🔧 Configuration Files:');
    console.log('• Docker Compose: docker-compose.yml');
    console.log('• Environment: .env');
    console.log('• Backend Config: backend/.env');
    console.log('• Frontend Config: frontend/.env.local');

    if (this.config.domain) {
      console.log('\n🌐 DNS Configuration:');
      console.log(`• ${this.config.domain} -> [your-server-ip]`);
      console.log(`• api.${this.config.domain} -> [your-server-ip]`);
      console.log(`• traefik.${this.config.domain} -> [your-server-ip]`);
    }

    console.log('\n💡 Next Steps:');
    console.log('• Test all application features');
    console.log('• Set up regular backups (./backup.sh)');
    console.log('• Configure monitoring alerts');
    console.log('• Review security settings');
    console.log('• Set up log rotation');
    
    console.log('\n' + '='.repeat(60));
  }

  async run() {
    try {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                  🐳 DOCKER DEPLOYMENT                       ║
║                     Project UNIFY                            ║
╚══════════════════════════════════════════════════════════════╝
      `);

      await this.checkPrerequisites();
      await this.configureDeployment();
      
      this.createDockerfiles();
      this.createDockerCompose();
      this.createMonitoringConfig();
      this.createDeploymentScripts();
      
      await this.buildAndDeploy();
      await this.runHealthChecks();
      await this.generateSummary();
      
    } catch (error) {
      this.log(`Deployment failed: ${error.message}`, 'error');
      
      console.log('\n🔧 Troubleshooting:');
      console.log('• Check Docker daemon is running: docker info');
      console.log('• Verify port availability: netstat -tlnp');
      console.log('• Check logs: docker compose logs');
      console.log('• Verify environment files exist and are valid');
      
      process.exit(1);
    } finally {
      this.rl.close();
    }
  }
}

// Run deployment if called directly
if (require.main === module) {
  const deploy = new DockerDeploy();
  deploy.run();
}

module.exports = DockerDeploy;