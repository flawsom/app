# Vercel + Railway Deployment Guide

This guide covers deploying Project UNIFY with the frontend on Vercel and backend on Railway - a popular modern stack for full-stack applications.

## 🎯 Overview

- **Frontend**: Vercel (Next.js optimized)
- **Backend**: Railway (Node.js/Express)
- **Database**: Railway PostgreSQL or Supabase
- **Cost**: ~$5-20/month depending on usage

## 📋 Prerequisites

- GitHub account with Project UNIFY repository
- Vercel account (free tier available)
- Railway account (free tier available)
- Domain name (optional)

## 🚀 Step 1: Backend Deployment on Railway

### 1.1 Create Railway Account

1. Visit [railway.app](https://railway.app)
2. Sign up with GitHub
3. Connect your GitHub account

### 1.2 Deploy Backend

1. **Create New Project**
   ```bash
   # In Railway dashboard
   New Project → Deploy from GitHub repo → Select project-unify
   ```

2. **Configure Build Settings**
   ```yaml
   # railway.json (create in project root)
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "startCommand": "cd backend && npm start",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

3. **Set Environment Variables**
   ```bash
   # In Railway dashboard → Variables tab
   NODE_ENV=production
   PORT=3001
   
   # Database (Railway will provide this)
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   
   # JWT Secrets (generate new ones for production)
   JWT_SECRET=your-production-jwt-secret-32-chars-min
   JWT_REFRESH_SECRET=your-production-refresh-secret-32-chars
   
   # CORS
   FRONTEND_URL=https://your-app.vercel.app
   CORS_ORIGIN=https://your-app.vercel.app
   
   # Email (choose one)
   SENDGRID_API_KEY=SG.your-sendgrid-key
   EMAIL_FROM=noreply@yourdomain.com
   
   # File Storage (choose one)
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret
   
   # AI Services
   OPENAI_API_KEY=sk-your-openai-key
   
   # Monitoring
   SENTRY_DSN=https://your-sentry-dsn
   ```

### 1.3 Add PostgreSQL Database

1. **Add Database Service**
   ```bash
   # In Railway dashboard
   New → Database → Add PostgreSQL
   ```

2. **Connect to Backend**
   ```bash
   # Railway automatically creates DATABASE_URL variable
   # Reference it in your backend variables as:
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```

### 1.4 Configure Custom Domain (Optional)

1. **Add Domain**
   ```bash
   # In Railway dashboard → Settings → Domains
   Add Domain → your-api.yourdomain.com
   ```

2. **Update DNS**
   ```bash
   # Add CNAME record in your DNS provider
   CNAME api your-project.up.railway.app
   ```

## 🌐 Step 2: Frontend Deployment on Vercel

### 2.1 Create Vercel Account

1. Visit [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Install Vercel GitHub app

### 2.2 Deploy Frontend

1. **Import Project**
   ```bash
   # In Vercel dashboard
   New Project → Import Git Repository → Select project-unify
   ```

2. **Configure Build Settings**
   ```bash
   # Framework Preset: Next.js
   # Root Directory: frontend
   # Build Command: npm run build
   # Output Directory: .next
   # Install Command: npm install
   ```

3. **Set Environment Variables**
   ```bash
   # In Vercel dashboard → Settings → Environment Variables
   
   # API Configuration
   NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
   NEXT_PUBLIC_APP_NAME=Project UNIFY
   
   # Authentication (if using OAuth)
   NEXTAUTH_URL=https://your-app.vercel.app
   NEXTAUTH_SECRET=your-nextauth-secret
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   
   # Analytics
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   
   # Payment Processing
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-stripe-key
   
   # Error Tracking
   NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
   ```

### 2.3 Configure Custom Domain

1. **Add Domain**
   ```bash
   # In Vercel dashboard → Settings → Domains
   Add Domain → yourdomain.com
   ```

2. **Update DNS**
   ```bash
   # Add CNAME record
   CNAME www cname.vercel-dns.com
   # Or A record for apex domain
   A @ 76.76.19.61
   ```

## 🔧 Step 3: Configuration and Testing

### 3.1 Update CORS Settings

Update your backend environment variables:

```bash
# In Railway dashboard
FRONTEND_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com,https://your-app.vercel.app
```

### 3.2 Test Deployment

1. **Health Check**
   ```bash
   curl https://your-backend.up.railway.app/health
   ```

2. **Frontend Test**
   ```bash
   # Visit your Vercel URL
   https://your-app.vercel.app
   ```

3. **API Integration Test**
   ```bash
   # Test from frontend to backend
   curl https://your-app.vercel.app/api/test
   ```

## 📊 Step 4: Monitoring and Logging

### 4.1 Railway Monitoring

1. **View Logs**
   ```bash
   # In Railway dashboard → Deployments → View Logs
   ```

2. **Metrics**
   ```bash
   # Monitor CPU, Memory, Network usage in Railway dashboard
   ```

### 4.2 Vercel Analytics

1. **Enable Analytics**
   ```bash
   # In Vercel dashboard → Analytics
   # Upgrade to Pro for detailed analytics
   ```

2. **Performance Monitoring**
   ```bash
   # View Core Web Vitals and performance metrics
   ```

## 💰 Cost Estimation

### Free Tier Limits

**Railway Free Tier:**
- $5 credit/month
- 500 hours execution time
- 1GB RAM, 1 vCPU
- 1GB disk storage

**Vercel Free Tier:**
- 100GB bandwidth/month
- 1,000 serverless function invocations/day
- 100 deployments/day

### Paid Plans

**Railway Pro:**
- $20/month base + usage
- Pay-per-use pricing
- Higher resource limits

**Vercel Pro:**
- $20/month per user
- 1TB bandwidth
- Advanced analytics

## 🚨 Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs in Railway/Vercel dashboard
   # Ensure all dependencies are in package.json
   # Verify Node.js version compatibility
   ```

2. **Environment Variables**
   ```bash
   # Verify all required variables are set
   # Check for typos in variable names
   # Ensure secrets are properly formatted
   ```

3. **CORS Issues**
   ```bash
   # Update CORS_ORIGIN in backend
   # Ensure frontend URL is correct
   # Check for trailing slashes
   ```

4. **Database Connection**
   ```bash
   # Verify DATABASE_URL format
   # Check Railway PostgreSQL status
   # Test connection from Railway logs
   ```

### Performance Optimization

1. **Frontend Optimization**
   ```bash
   # Enable Vercel Edge Functions
   # Optimize images with next/image
   # Use Vercel Analytics for monitoring
   ```

2. **Backend Optimization**
   ```bash
   # Enable Railway autoscaling
   # Optimize database queries
   # Implement caching with Redis
   ```

## 🔄 CI/CD Pipeline

### Automatic Deployments

Both Vercel and Railway support automatic deployments from GitHub:

1. **Push to main branch** → Production deployment
2. **Push to develop branch** → Preview deployment
3. **Pull requests** → Preview deployments

### Manual Deployment

```bash
# Deploy frontend manually
npx vercel --prod

# Deploy backend manually (using Railway CLI)
railway login
railway link
railway up
```

## 🔒 Security Considerations

### Production Security Checklist

- [ ] Use strong JWT secrets (32+ characters)
- [ ] Enable HTTPS for all domains
- [ ] Set proper CORS origins
- [ ] Use environment variables for all secrets
- [ ] Enable Vercel/Railway security headers
- [ ] Set up proper CSP headers
- [ ] Use Sentry for error tracking
- [ ] Enable rate limiting
- [ ] Regular security updates

### Environment Variables Security

```bash
# Never commit these to version control
# Use Railway/Vercel dashboard for secrets
# Rotate keys regularly
# Use different keys for staging/production
```

## 📈 Scaling Considerations

### Horizontal Scaling

**Railway:**
- Automatic scaling based on CPU/memory usage
- Configure scaling rules in dashboard
- Monitor resource usage

**Vercel:**
- Automatic scaling for serverless functions
- Edge network distribution
- No configuration needed

### Database Scaling

```bash
# Railway PostgreSQL
- Upgrade to higher tier plans
- Consider read replicas for heavy read workloads
- Implement connection pooling

# Alternative: External database
- Supabase for managed PostgreSQL
- PlanetScale for MySQL
- MongoDB Atlas for NoSQL
```

This deployment setup provides a modern, scalable foundation for Project UNIFY with minimal operational overhead and excellent developer experience.