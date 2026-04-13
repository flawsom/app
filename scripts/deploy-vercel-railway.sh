#!/bin/bash

# Project UNIFY - Vercel + Railway Deployment Script
# This script automates the deployment process to Vercel (frontend) and Railway (backend)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="project-unify"
FRONTEND_DIR="frontend"
BACKEND_DIR="backend"

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    # Check npm/pnpm
    if ! command -v pnpm &> /dev/null; then
        if ! command -v npm &> /dev/null; then
            log_error "Neither npm nor pnpm is installed."
            exit 1
        else
            log_warning "pnpm not found, using npm instead"
            PACKAGE_MANAGER="npm"
        fi
    else
        PACKAGE_MANAGER="pnpm"
    fi
    
    # Check Vercel CLI
    if ! command -v vercel &> /dev/null; then
        log_info "Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    # Check Railway CLI
    if ! command -v railway &> /dev/null; then
        log_info "Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    log_success "All dependencies are available"
}

setup_environment() {
    log_info "Setting up environment files..."
    
    # Check if .env files exist
    if [ ! -f "$BACKEND_DIR/.env" ]; then
        if [ -f "$BACKEND_DIR/.env.example" ]; then
            log_warning "Backend .env not found, copying from .env.example"
            cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
            log_error "Please configure $BACKEND_DIR/.env with your actual values before continuing"
            exit 1
        else
            log_error "Neither $BACKEND_DIR/.env nor $BACKEND_DIR/.env.example found"
            exit 1
        fi
    fi
    
    if [ ! -f "$FRONTEND_DIR/.env.local" ]; then
        if [ -f "$FRONTEND_DIR/.env.example" ]; then
            log_warning "Frontend .env.local not found, copying from .env.example"
            cp "$FRONTEND_DIR/.env.example" "$FRONTEND_DIR/.env.local"
            log_error "Please configure $FRONTEND_DIR/.env.local with your actual values before continuing"
            exit 1
        else
            log_error "Neither $FRONTEND_DIR/.env.local nor $FRONTEND_DIR/.env.example found"
            exit 1
        fi
    fi
    
    log_success "Environment files are ready"
}

test_build() {
    log_info "Testing local builds..."
    
    # Test backend build
    log_info "Testing backend build..."
    cd "$BACKEND_DIR"
    $PACKAGE_MANAGER install
    $PACKAGE_MANAGER run build
    cd ..
    
    # Test frontend build
    log_info "Testing frontend build..."
    cd "$FRONTEND_DIR"
    $PACKAGE_MANAGER install
    $PACKAGE_MANAGER run build
    cd ..
    
    log_success "Local builds completed successfully"
}

deploy_backend() {
    log_info "Deploying backend to Railway..."
    
    cd "$BACKEND_DIR"
    
    # Check if Railway is initialized
    if [ ! -f "railway.json" ]; then
        log_info "Creating railway.json configuration..."
        cat > railway.json << EOF
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health"
  }
}
EOF
    fi
    
    # Login to Railway if not already logged in
    if ! railway whoami &> /dev/null; then
        log_info "Please log in to Railway..."
        railway login
    fi
    
    # Initialize Railway project if not exists
    if [ ! -f ".railway" ]; then
        log_info "Initializing Railway project..."
        railway init
    fi
    
    # Deploy to Railway
    log_info "Deploying to Railway..."
    railway up
    
    # Get the deployment URL
    BACKEND_URL=$(railway status --json | jq -r '.deployments[0].url' 2>/dev/null || echo "")
    
    if [ -n "$BACKEND_URL" ]; then
        log_success "Backend deployed to: $BACKEND_URL"
        echo "$BACKEND_URL" > ../backend-url.txt
    else
        log_warning "Could not determine backend URL automatically"
        read -p "Please enter your Railway backend URL: " BACKEND_URL
        echo "$BACKEND_URL" > ../backend-url.txt
    fi
    
    cd ..
}

deploy_frontend() {
    log_info "Deploying frontend to Vercel..."
    
    cd "$FRONTEND_DIR"
    
    # Update API URL if backend was deployed
    if [ -f "../backend-url.txt" ]; then
        BACKEND_URL=$(cat ../backend-url.txt)
        log_info "Updating NEXT_PUBLIC_API_URL to: $BACKEND_URL"
        
        # Update .env.local
        if grep -q "NEXT_PUBLIC_API_URL" .env.local; then
            sed -i.bak "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=$BACKEND_URL|" .env.local
        else
            echo "NEXT_PUBLIC_API_URL=$BACKEND_URL" >> .env.local
        fi
    fi
    
    # Login to Vercel if not already logged in
    if ! vercel whoami &> /dev/null; then
        log_info "Please log in to Vercel..."
        vercel login
    fi
    
    # Deploy to Vercel
    log_info "Deploying to Vercel..."
    vercel --prod
    
    # Get the deployment URL
    FRONTEND_URL=$(vercel ls --json | jq -r '.[0].url' 2>/dev/null || echo "")
    
    if [ -n "$FRONTEND_URL" ]; then
        log_success "Frontend deployed to: https://$FRONTEND_URL"
    else
        log_warning "Could not determine frontend URL automatically"
    fi
    
    cd ..
}

update_cors() {
    log_info "Updating CORS configuration..."
    
    if [ -f "backend-url.txt" ] && [ -f "$FRONTEND_DIR/.env.local" ]; then
        BACKEND_URL=$(cat backend-url.txt)
        FRONTEND_URL=$(grep "VERCEL_URL" "$FRONTEND_DIR/.env.local" | cut -d'=' -f2 || echo "")
        
        if [ -n "$FRONTEND_URL" ]; then
            log_info "Updating backend CORS settings..."
            cd "$BACKEND_DIR"
            
            # Update CORS_ORIGIN in Railway
            railway variables set CORS_ORIGIN="https://$FRONTEND_URL"
            
            cd ..
            log_success "CORS configuration updated"
        fi
    fi
}

run_health_checks() {
    log_info "Running health checks..."
    
    # Check backend health
    if [ -f "backend-url.txt" ]; then
        BACKEND_URL=$(cat backend-url.txt)
        log_info "Checking backend health at: $BACKEND_URL/health"
        
        for i in {1..5}; do
            if curl -s "$BACKEND_URL/health" > /dev/null; then
                log_success "Backend is healthy"
                break
            else
                log_warning "Backend health check failed, retrying in 10 seconds... ($i/5)"
                sleep 10
            fi
        done
    fi
    
    # Run environment tests
    if [ -f "scripts/test-environment.js" ]; then
        log_info "Running environment tests..."
        node scripts/test-environment.js
    fi
}

cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f backend-url.txt
    rm -f "$FRONTEND_DIR/.env.local.bak"
}

main() {
    log_info "Starting Project UNIFY deployment to Vercel + Railway"
    log_info "=================================================="
    
    # Parse command line arguments
    SKIP_TESTS=false
    SKIP_BACKEND=false
    SKIP_FRONTEND=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-backend)
                SKIP_BACKEND=true
                shift
                ;;
            --skip-frontend)
                SKIP_FRONTEND=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-tests     Skip build tests"
                echo "  --skip-backend   Skip backend deployment"
                echo "  --skip-frontend  Skip frontend deployment"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    check_dependencies
    setup_environment
    
    if [ "$SKIP_TESTS" = false ]; then
        test_build
    fi
    
    if [ "$SKIP_BACKEND" = false ]; then
        deploy_backend
    fi
    
    if [ "$SKIP_FRONTEND" = false ]; then
        deploy_frontend
    fi
    
    update_cors
    run_health_checks
    cleanup
    
    log_success "Deployment completed successfully!"
    log_info "Next steps:"
    log_info "1. Test your application thoroughly"
    log_info "2. Set up custom domains if needed"
    log_info "3. Configure monitoring and alerts"
    log_info "4. Set up CI/CD pipelines for automatic deployments"
}

# Trap to cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"