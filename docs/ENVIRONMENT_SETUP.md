# Environment Setup Guide - Project UNIFY

This comprehensive guide covers setting up all required and optional services for Project UNIFY, including free and paid alternatives with detailed pricing information.

## 🎯 Quick Setup Checklist

### Essential Services (Required)
- [ ] **Database**: PostgreSQL or Supabase
- [ ] **Cache**: Redis (local or cloud)
- [ ] **Authentication**: JWT secrets
- [ ] **Email**: SendGrid, Mailgun, or AWS SES

### Optional Services (Recommended)
- [ ] **File Storage**: AWS S3 or Cloudinary
- [ ] **AI Services**: OpenAI or Google AI
- [ ] **Monitoring**: Sentry
- [ ] **Analytics**: Google Analytics
- [ ] **Payments**: Stripe (if premium features needed)

## 📊 Service Comparison Matrix

| Service Category | Free Option | Free Limits | Paid Option | Paid Pricing | Recommendation |
|-----------------|-------------|-------------|-------------|--------------|----------------|
| **Database** | PostgreSQL (local) | Unlimited | Supabase Pro | $25/month | Supabase for production |
| **Email** | SendGrid | 100/day | SendGrid Essentials | $14.95/month | SendGrid |
| **Storage** | Cloudinary | 25GB/month | AWS S3 | $0.023/GB | AWS S3 for scale |
| **AI/ML** | OpenAI | $5 credit | OpenAI Pay-as-go | $0.002/1K tokens | OpenAI GPT-3.5 |
| **Cache** | Redis (local) | Unlimited | Redis Cloud | $5/month | Redis Cloud |
| **Monitoring** | Sentry | 5K errors/month | Sentry Team | $26/month | Sentry |

## 🗄️ Database Setup

### Option 1: PostgreSQL (Local Development)

**Cost**: Free
**Complexity**: Medium
**Best for**: Development, small deployments

#### Installation

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
Download from [postgresql.org](https://www.postgresql.org/download/windows/)

#### Setup
```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE project_unify;
CREATE USER unify_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE project_unify TO unify_user;
\q
```

**Environment Configuration:**
```env
DATABASE_URL=postgresql://unify_user:your_password@localhost:5432/project_unify
```

### Option 2: Supabase (Recommended)

**Free Tier**: 500MB database, 2GB bandwidth/month, 50MB file uploads
**Pro Tier**: $25/month - Unlimited database, 8GB bandwidth, 5GB file uploads
**Best for**: Production, rapid development

#### Setup Steps

1. **Sign up** at [supabase.com](https://supabase.com)
2. **Create new project**
   - Choose organization
   - Set project name: `project-unify`
   - Set database password
   - Choose region (closest to users)
3. **Get connection details**
   - Go to Settings > Database
   - Copy the connection string
4. **Configure environment**

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Optional: Use Supabase client
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Supabase Advantages
- ✅ Automatic backups
- ✅ Built-in authentication
- ✅ Real-time subscriptions
- ✅ File storage included
- ✅ Dashboard for data management

### Option 3: AWS RDS PostgreSQL

**Free Tier**: 750 hours/month, 20GB storage (12 months)
**Paid**: Starts at ~$15/month for db.t3.micro
**Best for**: Enterprise, high availability

#### Setup (Brief)
1. Create AWS account
2. Navigate to RDS
3. Create PostgreSQL instance
4. Configure security groups
5. Get endpoint URL

## 📧 Email Service Setup

### Option 1: SendGrid (Recommended)

**Free Tier**: 100 emails/day forever
**Essentials**: $14.95/month - 40,000 emails/month
**Pro**: $89.95/month - 1,500,000 emails/month

#### Setup Steps

1. **Sign up** at [sendgrid.com](https://sendgrid.com)
2. **Verify your account** (email + phone)
3. **Create API Key**
   - Go to Settings > API Keys
   - Click "Create API Key"
   - Choose "Full Access" or "Restricted Access"
   - Copy the API key (shown only once)
4. **Set up sender authentication**
   - Go to Settings > Sender Authentication
   - Verify a single sender email OR
   - Set up domain authentication (recommended)

```env
SENDGRID_API_KEY=SG.your-api-key-here
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Project UNIFY
```

#### SendGrid Advantages
- ✅ Generous free tier
- ✅ Excellent deliverability
- ✅ Comprehensive analytics
- ✅ Template management
- ✅ Easy integration

### Option 2: Mailgun

**Free Trial**: 5,000 emails/month for 3 months
**Foundation**: $35/month - 50,000 emails/month
**Growth**: $80/month - 100,000 emails/month

#### Setup Steps
1. Sign up at [mailgun.com](https://mailgun.com)
2. Add and verify your domain
3. Get API credentials from dashboard

```env
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.yourdomain.com
```

### Option 3: AWS SES

**Free Tier**: 62,000 emails/month when sent from EC2
**Paid**: $0.10 per 1,000 emails + $0.12 per 1,000 received emails
**Best for**: High volume, cost optimization

#### Setup Steps
1. Create AWS account
2. Navigate to SES
3. Verify email addresses or domains
4. Create IAM user with SES permissions

```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
SES_FROM_EMAIL=noreply@yourdomain.com
```

## 💾 File Storage Setup

### Option 1: AWS S3 (Recommended for Production)

**Free Tier**: 5GB storage, 20,000 GET requests, 2,000 PUT requests/month
**Standard**: $0.023 per GB/month + request costs
**Best for**: Scalability, reliability

#### Setup Steps

1. **Create AWS Account** at [aws.amazon.com](https://aws.amazon.com)
2. **Create S3 Bucket**
   ```bash
   # Using AWS CLI
   aws s3 mb s3://project-unify-files-[random-suffix]
   ```
3. **Create IAM User**
   - Go to IAM > Users > Add User
   - Attach policy: `AmazonS3FullAccess` (or create custom policy)
   - Save Access Key ID and Secret Access Key
4. **Configure CORS** (for direct uploads)
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
       "ExposeHeaders": []
     }
   ]
   ```

```env
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=project-unify-files-unique-suffix
```

#### S3 Cost Estimation
- **Storage**: $0.023/GB/month
- **Requests**: $0.0004/1K PUT, $0.0004/10K GET
- **Data Transfer**: $0.09/GB (first 10TB/month)

### Option 2: Cloudinary (Easy Setup)

**Free Tier**: 25GB storage, 25GB bandwidth/month, 25 credits/month
**Plus**: $99/month - 100GB storage, 100GB bandwidth
**Advanced**: $224/month - 200GB storage, 200GB bandwidth

#### Setup Steps

1. **Sign up** at [cloudinary.com](https://cloudinary.com)
2. **Get credentials** from dashboard
3. **Create upload preset**
   - Go to Settings > Upload
   - Create unsigned upload preset for client uploads

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-api-secret

# Frontend
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-preset
```

#### Cloudinary Advantages
- ✅ Automatic image optimization
- ✅ Built-in transformations
- ✅ CDN included
- ✅ Easy integration
- ✅ Video support

### Option 3: Supabase Storage

**Included with Supabase subscription**
**Free Tier**: 1GB storage
**Pro Tier**: 100GB included, $0.021/GB beyond

#### Setup
```env
SUPABASE_STORAGE_BUCKET=avatars
```

## 🤖 AI Services Setup

### Option 1: OpenAI (Recommended)

**Free**: $5 credit for new users (expires after 3 months)
**Pay-as-you-go**: 
- GPT-3.5 Turbo: $0.002/1K tokens
- GPT-4: $0.03/1K tokens (input), $0.06/1K tokens (output)

#### Setup Steps

1. **Sign up** at [platform.openai.com](https://platform.openai.com)
2. **Add payment method** (required after free credit)
3. **Create API Key**
   - Go to API Keys section
   - Click "Create new secret key"
   - Copy key (shown only once)
4. **Set usage limits** (recommended)
   - Go to Usage > Limits
   - Set monthly budget limit

```env
OPENAI_API_KEY=sk-...your-key-here
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=1000
```

#### Cost Estimation for Project UNIFY
- **Job matching**: ~100 tokens per request = $0.0002
- **Resume analysis**: ~500 tokens per request = $0.001
- **Chat features**: ~200 tokens per message = $0.0004
- **Monthly estimate**: 1000 users × 10 requests = $2-10/month

### Option 2: Google AI (Gemini)

**Free Tier**: 60 requests per minute
**Paid**: Pay-per-use (pricing varies by model)

#### Setup Steps
1. Sign up at [ai.google.dev](https://ai.google.dev)
2. Create API key
3. Enable Gemini API

```env
GOOGLE_AI_API_KEY=your-google-ai-key
GOOGLE_AI_MODEL=gemini-pro
```

### Option 3: Hugging Face

**Free Tier**: Limited inference API calls
**Pro**: $9/month - Inference Endpoints
**Enterprise**: Custom pricing

```env
HUGGINGFACE_API_KEY=hf_your-key
HUGGINGFACE_MODEL=microsoft/DialoGPT-medium
```

## 🔄 Redis Setup (Caching & Sessions)

### Option 1: Local Redis (Development)

**Cost**: Free
**Best for**: Development, testing

#### Installation
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis

# Windows
# Download from https://redis.io/download
```

```env
REDIS_URL=redis://localhost:6379
```

### Option 2: Redis Cloud (Recommended)

**Free Tier**: 30MB storage, 30 connections
**Fixed Plans**: $5-7/month for 100MB-250MB
**Flexible Plans**: $0.000069/hour per MB

#### Setup Steps
1. Sign up at [redis.com](https://redis.com/try-free)
2. Create database
3. Get connection string

```env
REDIS_URL=redis://default:password@redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345
```

### Option 3: Upstash (Serverless)

**Free Tier**: 10,000 requests/day, 256MB storage
**Pay-per-request**: $0.2 per 100K requests

```env
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

## 💳 Payment Processing (Optional)

### Stripe (Recommended)

**Pricing**: 2.9% + 30¢ per transaction (US)
**No monthly fees**
**Best for**: Most use cases

#### Setup Steps
1. Sign up at [stripe.com](https://stripe.com)
2. Complete account verification
3. Get API keys from dashboard
4. Set up webhooks for your domain

```env
# Backend
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 📊 Monitoring & Analytics

### Option 1: Sentry (Error Tracking)

**Free Tier**: 5,000 errors/month, 1 user
**Team**: $26/month - 50,000 errors/month, unlimited users
**Organization**: $80/month - 200,000 errors/month

#### Setup Steps
1. Sign up at [sentry.io](https://sentry.io)
2. Create new project (Node.js + React)
3. Get DSN from project settings

```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### Option 2: Google Analytics

**Free**: Standard reporting, 10M hits/month per property
**GA360**: Custom enterprise pricing

#### Setup Steps
1. Create account at [analytics.google.com](https://analytics.google.com)
2. Create GA4 property
3. Get Measurement ID

```env
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
```

## 🔐 Security Services

### SSL Certificates

**Let's Encrypt**: Free
**Cloudflare**: Free tier includes SSL
**AWS Certificate Manager**: Free for AWS resources

### Web Application Firewall

**Cloudflare**: Free tier includes basic protection
**AWS WAF**: Pay-per-use
**Sucuri**: $9.99/month

## 📱 Push Notifications (Optional)

### Firebase Cloud Messaging

**Free**: Unlimited notifications
**Best for**: Mobile and web push notifications

#### Setup Steps
1. Create project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Cloud Messaging
3. Get configuration

```env
FCM_SERVER_KEY=your-server-key
NEXT_PUBLIC_FIREBASE_CONFIG={"apiKey":"..."}
```

## 🌍 CDN & Performance

### Cloudflare (Recommended)

**Free Tier**: 
- Unlimited bandwidth
- Basic DDoS protection
- SSL certificate
- Basic analytics

**Pro**: $20/month - Advanced features
**Business**: $200/month - Enhanced security

#### Setup
1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain
3. Update nameservers
4. Configure DNS and security settings

## 💰 Cost Estimation

### Minimal Setup (Free Tier)
- **Database**: Supabase Free (500MB)
- **Email**: SendGrid Free (100/day)
- **Storage**: Cloudinary Free (25GB)
- **AI**: OpenAI Free ($5 credit)
- **Cache**: Local Redis
- **Monitoring**: Sentry Free (5K errors)
- **Total**: $0/month (with limitations)

### Recommended Production Setup
- **Database**: Supabase Pro ($25/month)
- **Email**: SendGrid Essentials ($14.95/month)
- **Storage**: AWS S3 (~$5/month for 100GB)
- **AI**: OpenAI Pay-as-go (~$10/month)
- **Cache**: Redis Cloud ($5/month)
- **Monitoring**: Sentry Team ($26/month)
- **CDN**: Cloudflare Pro ($20/month)
- **Total**: ~$105/month

### Enterprise Setup
- **Database**: AWS RDS (~$50/month)
- **Email**: SendGrid Pro ($89.95/month)
- **Storage**: AWS S3 + CloudFront (~$20/month)
- **AI**: OpenAI with higher limits (~$50/month)
- **Cache**: Redis Enterprise (~$50/month)
- **Monitoring**: Sentry Organization ($80/month)
- **Total**: ~$340/month

## 🚀 Deployment Platforms

### Vercel (Frontend)
**Free**: Hobby projects, 100GB bandwidth
**Pro**: $20/month per user

### Railway (Full-stack)
**Free**: $5 credit/month
**Pro**: $20/month + usage

### AWS/GCP/Azure
**Variable pricing based on usage**

## 📞 Getting Help

If you encounter issues during setup:

1. **Check service status pages**
2. **Review service documentation**
3. **Check our troubleshooting guide**
4. **Join our Discord community**
5. **Create GitHub issue with detailed error logs**

---

This guide covers the most common services and configurations. For specific use cases or custom requirements, please refer to individual service documentation or contact our support team.