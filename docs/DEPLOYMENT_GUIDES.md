# Deployment Guides - Project UNIFY

Complete deployment documentation for various platforms and environments.

## 📋 Table of Contents

- [Platform Comparisons](#platform-comparisons)
- [Vercel + Railway Deployment](#vercel--railway-deployment)
- [AWS Full Stack Deployment](#aws-full-stack-deployment)
- [DigitalOcean App Platform](#digitalocean-app-platform)
- [Google Cloud Platform](#google-cloud-platform)
- [Container Deployments](#container-deployments)
- [CI/CD Pipelines](#cicd-pipelines)
- [Production Readiness](#production-readiness)
- [Troubleshooting](#troubleshooting)

## 🏗 Platform Comparisons

| Platform | Frontend | Backend | Database | Cost (Est.) | Complexity | Best For |
|----------|----------|---------|----------|-------------|------------|----------|
| **Vercel + Railway** | Vercel | Railway | Supabase | $30-50/mo | Low | Startups, MVPs |
| **AWS** | S3+CloudFront | ECS/Lambda | RDS | $50-200/mo | High | Enterprise, Scale |
| **DigitalOcean** | App Platform | App Platform | Managed DB | $25-100/mo | Medium | Mid-size teams |
| **Google Cloud** | Cloud Run | Cloud Run | Cloud SQL | $40-150/mo | Medium | Google ecosystem |
| **Render** | Static Sites | Web Services | PostgreSQL | $20-80/mo | Low | Simple deployments |

## 🚀 Vercel + Railway Deployment

### Overview
- **Frontend**: Vercel (Next.js optimized)
- **Backend**: Railway (containerized Node.js)
- **Database**: Supabase or Railway PostgreSQL
- **Total Cost**: ~$30-50/month

### Step 1: Frontend Deployment (Vercel)

#### 1.1 Prepare Repository
```bash
# Ensure your frontend is in the correct structure
cd frontend
npm run build  # Test local build
```

#### 1.2 Deploy to Vercel
1. **Connect Repository**:
   - Visit [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import from GitHub/GitLab
   - Select your repository

2. **Configure Build Settings**:
   ```
   Framework Preset: Next.js
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: .next
   Install Command: npm install
   ```

3. **Environment Variables**:
   ```bash
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   NEXTAUTH_SECRET=your-nextauth-secret
   NEXTAUTH_URL=https://your-app.vercel.app
   
   # OAuth (if using)
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

#### 1.3 Custom Domain (Optional)
```bash
# Add custom domain in Vercel dashboard
# Update DNS records:
# CNAME: www -> cname.vercel-dns.com
# A: @ -> 76.76.19.61
```

### Step 2: Backend Deployment (Railway)

#### 2.1 Prepare Backend
```bash
cd backend
# Create railway.json
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
```

#### 2.2 Deploy to Railway
1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Initialize Project**:
   ```bash
   cd backend
   railway init
   railway link  # Link to existing project or create new
   ```

3. **Add Database**:
   ```bash
   # Add PostgreSQL database
   railway add postgresql
   
   # Get database URL
   railway variables
   # Copy DATABASE_URL value
   ```

4. **Set Environment Variables**:
   ```bash
   railway variables set NODE_ENV=production
   railway variables set JWT_SECRET=your-jwt-secret
   railway variables set JWT_REFRESH_SECRET=your-refresh-secret
   railway variables set FRONTEND_URL=https://your-app.vercel.app
   railway variables set SENDGRID_API_KEY=your-sendgrid-key
   railway variables set OPENAI_API_KEY=your-openai-key
   # Add other variables from .env.example
   ```

5. **Deploy**:
   ```bash
   railway up
   # Or connect GitHub for automatic deployments
   railway connect
   ```

### Step 3: Database Setup (Supabase Alternative)

#### 3.1 Supabase Setup
1. **Create Project**:
   - Visit [supabase.com](https://supabase.com)
   - Create new project
   - Choose region closest to your users

2. **Get Connection Details**:
   ```bash
   # From Supabase Dashboard > Settings > Database
   DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
   ```

3. **Run Migrations**:
   ```bash
   # Set DATABASE_URL in Railway
   railway variables set DATABASE_URL="your-supabase-url"
   
   # Migrations will run automatically on deployment
   ```

### Step 4: Domain Configuration

#### 4.1 Update CORS Settings
```bash
# In Railway backend environment
railway variables set CORS_ORIGIN=https://your-app.vercel.app,https://your-domain.com
```

#### 4.2 Update Frontend API URL
```bash
# In Vercel environment variables
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

### Step 5: SSL and Security

#### 5.1 Enable HTTPS Redirect (Backend)
```javascript
// In your Express app
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`)
    } else {
      next()
    }
  })
}
```

#### 5.2 Security Headers
```javascript
// Add to your Express app
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  next()
})
```

## ☁️ AWS Full Stack Deployment

### Overview
- **Frontend**: S3 + CloudFront
- **Backend**: ECS Fargate or Lambda
- **Database**: RDS PostgreSQL
- **Total Cost**: ~$50-200/month

### Step 1: Infrastructure Setup

#### 1.1 Create VPC and Networking
```bash
# Create VPC
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=project-unify-vpc}]'

# Create subnets
aws ec2 create-subnet --vpc-id vpc-xxxxx --cidr-block 10.0.1.0/24 --availability-zone us-east-1a
aws ec2 create-subnet --vpc-id vpc-xxxxx --cidr-block 10.0.2.0/24 --availability-zone us-east-1b

# Create internet gateway
aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=project-unify-igw}]'
```

#### 1.2 RDS Database Setup
```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name project-unify-db-subnet \
  --db-subnet-group-description "Project UNIFY DB Subnet Group" \
  --subnet-ids subnet-xxxxx subnet-yyyyy

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier project-unify-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --master-username postgres \
  --master-user-password your-secure-password \
  --allocated-storage 20 \
  --db-subnet-group-name project-unify-db-subnet \
  --vpc-security-group-ids sg-xxxxx
```

### Step 2: Backend Deployment (ECS)

#### 2.1 Create Dockerfile for Production
```dockerfile
# backend/Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs

EXPOSE 3001
CMD ["npm", "start"]
```

#### 2.2 Build and Push to ECR
```bash
# Create ECR repository
aws ecr create-repository --repository-name project-unify-backend

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build and push
cd backend
docker build -f Dockerfile.prod -t project-unify-backend .
docker tag project-unify-backend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/project-unify-backend:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/project-unify-backend:latest
```

#### 2.3 ECS Task Definition
```json
{
  "family": "project-unify-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/project-unify-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:ssm:us-east-1:123456789012:parameter/project-unify/database-url"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:ssm:us-east-1:123456789012:parameter/project-unify/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/project-unify-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### 2.4 Create ECS Service
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name project-unify-cluster

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json

# Create service
aws ecs create-service \
  --cluster project-unify-cluster \
  --service-name project-unify-backend \
  --task-definition project-unify-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-yyyyy],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}"
```

### Step 3: Frontend Deployment (S3 + CloudFront)

#### 3.1 Build and Upload to S3
```bash
cd frontend
npm run build

# Create S3 bucket
aws s3 mb s3://project-unify-frontend-bucket

# Upload files
aws s3 sync out/ s3://project-unify-frontend-bucket --delete

# Set bucket policy for public read
aws s3api put-bucket-policy --bucket project-unify-frontend-bucket --policy file://bucket-policy.json
```

#### 3.2 Bucket Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::project-unify-frontend-bucket/*"
    }
  ]
}
```

#### 3.3 CloudFront Distribution
```bash
# Create CloudFront distribution
aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
```

#### 3.4 CloudFront Configuration
```json
{
  "CallerReference": "project-unify-2024",
  "Comment": "Project UNIFY Frontend Distribution",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-project-unify-frontend-bucket",
        "DomainName": "project-unify-frontend-bucket.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-project-unify-frontend-bucket",
    "ViewerProtocolPolicy": "redirect-to-https",
    "MinTTL": 0,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    }
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
```

## 🌊 DigitalOcean App Platform

### Overview
- **Frontend + Backend**: App Platform
- **Database**: Managed PostgreSQL
- **Total Cost**: ~$25-100/month

### Step 1: Prepare Application

#### 1.1 Create App Spec
```yaml
# .do/app.yaml
name: project-unify
services:
- name: backend
  source_dir: /backend
  github:
    repo: your-username/project-unify
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: DATABASE_URL
    type: SECRET
  - key: JWT_SECRET
    type: SECRET
  - key: SENDGRID_API_KEY
    type: SECRET
  http_port: 3001
  
- name: frontend
  source_dir: /frontend
  github:
    repo: your-username/project-unify
    branch: main
  build_command: npm run build
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NEXT_PUBLIC_API_URL
    value: ${backend.PUBLIC_URL}
  http_port: 3000
  routes:
  - path: /
    
databases:
- name: project-unify-db
  engine: PG
  version: "15"
  size: basic-xs
```

### Step 2: Deploy to DigitalOcean

#### 2.1 Using doctl CLI
```bash
# Install doctl
curl -sL https://github.com/digitalocean/doctl/releases/download/v1.94.0/doctl-1.94.0-linux-amd64.tar.gz | tar -xzv
sudo mv doctl /usr/local/bin

# Authenticate
doctl auth init

# Create app
doctl apps create --spec .do/app.yaml

# Get app info
doctl apps list
```

#### 2.2 Using Web Interface
1. Visit [DigitalOcean Apps](https://cloud.digitalocean.com/apps)
2. Click "Create App"
3. Connect GitHub repository
4. Configure build settings:
   - **Backend**: Source Directory: `backend`, Build Command: `npm run build`, Run Command: `npm start`
   - **Frontend**: Source Directory: `frontend`, Build Command: `npm run build`, Run Command: `npm start`

### Step 3: Database Configuration

#### 3.1 Add Managed Database
```bash
# Create database cluster
doctl databases create project-unify-db --engine pg --version 15 --size db-s-1vcpu-1gb --region nyc1

# Get connection details
doctl databases connection project-unify-db --format ConnectionString
```

#### 3.2 Set Environment Variables
```bash
# Set database URL
doctl apps update YOUR_APP_ID --spec .do/app.yaml

# Or use web interface to add:
# DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
```

## 🔥 Google Cloud Platform

### Overview
- **Frontend**: Cloud Storage + Cloud CDN
- **Backend**: Cloud Run
- **Database**: Cloud SQL PostgreSQL
- **Total Cost**: ~$40-150/month

### Step 1: Setup GCP Project

#### 1.1 Initialize Project
```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize
gcloud init
gcloud config set project your-project-id

# Enable APIs
gcloud services enable run.googleapis.com
gcloud services enable sql-component.googleapis.com
gcloud services enable storage-component.googleapis.com
```

### Step 2: Database Setup (Cloud SQL)

#### 2.1 Create Cloud SQL Instance
```bash
# Create instance
gcloud sql instances create project-unify-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=your-secure-password

# Create database
gcloud sql databases create project_unify --instance=project-unify-db

# Create user
gcloud sql users create app_user \
  --instance=project-unify-db \
  --password=app-password
```

### Step 3: Backend Deployment (Cloud Run)

#### 3.1 Prepare Dockerfile
```dockerfile
# Use the same Dockerfile.prod from AWS section
```

#### 3.2 Build and Deploy
```bash
cd backend

# Build and submit to Container Registry
gcloud builds submit --tag gcr.io/your-project-id/project-unify-backend

# Deploy to Cloud Run
gcloud run deploy project-unify-backend \
  --image gcr.io/your-project-id/project-unify-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DATABASE_URL="postgresql://app_user:app-password@/project_unify?host=/cloudsql/your-project-id:us-central1:project-unify-db" \
  --add-cloudsql-instances your-project-id:us-central1:project-unify-db
```

### Step 4: Frontend Deployment (Cloud Storage)

#### 4.1 Build and Upload
```bash
cd frontend
npm run build

# Create bucket
gsutil mb gs://your-project-unify-frontend

# Upload files
gsutil -m rsync -r -d out/ gs://your-project-unify-frontend

# Make bucket public
gsutil iam ch allUsers:objectViewer gs://your-project-unify-frontend
```

#### 4.2 Setup Load Balancer and CDN
```bash
# Create backend bucket
gcloud compute backend-buckets create project-unify-backend-bucket \
  --gcs-bucket-name=your-project-unify-frontend

# Create URL map
gcloud compute url-maps create project-unify-url-map \
  --default-backend-bucket=project-unify-backend-bucket

# Create HTTP(S) proxy
gcloud compute target-https-proxies create project-unify-https-proxy \
  --url-map=project-unify-url-map \
  --ssl-certificates=your-ssl-cert

# Create forwarding rule
gcloud compute forwarding-rules create project-unify-https-rule \
  --global \
  --target-https-proxy=project-unify-https-proxy \
  --ports=443
```

## 📦 Container Deployments

### Docker Swarm Deployment

#### 1.1 Production Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    networks:
      - app-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    environment:
      - NEXT_PUBLIC_API_URL=https://api.yourdomain.com
    deploy:
      replicas: 2
      restart_policy:
        condition: on-failure
    networks:
      - app-network

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=project_unify
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    deploy:
      replicas: 1
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
    driver: overlay
```

#### 1.2 Initialize Swarm and Deploy
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.prod.yml project-unify

# Scale services
docker service scale project-unify_backend=3
docker service scale project-unify_frontend=2

# Monitor services
docker service ls
docker service logs project-unify_backend
```

### Kubernetes Deployment

#### 2.1 Namespace and ConfigMap
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: project-unify

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: project-unify-config
  namespace: project-unify
data:
  NODE_ENV: "production"
  REDIS_URL: "redis://redis-service:6379"
```

#### 2.2 Secrets
```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: project-unify-secrets
  namespace: project-unify
type: Opaque
data:
  database-url: <base64-encoded-database-url>
  jwt-secret: <base64-encoded-jwt-secret>
  sendgrid-api-key: <base64-encoded-sendgrid-key>
```

#### 2.3 Backend Deployment
```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-deployment
  namespace: project-unify
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: your-registry/project-unify-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: project-unify-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: project-unify-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: project-unify-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: project-unify
spec:
  selector:
    app: backend
  ports:
  - protocol: TCP
    port: 3001
    targetPort: 3001
  type: ClusterIP
```

#### 2.4 Frontend Deployment
```yaml
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend-deployment
  namespace: project-unify
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: your-registry/project-unify-frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NEXT_PUBLIC_API_URL
          value: "https://api.yourdomain.com"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"

---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: project-unify
spec:
  selector:
    app: frontend
  ports:
  - protocol: TCP
    port: 3000
    targetPort: 3000
  type: ClusterIP
```

#### 2.5 Ingress Configuration
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: project-unify-ingress
  namespace: project-unify
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - yourdomain.com
    - api.yourdomain.com
    secretName: project-unify-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 3000
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 3001
```

#### 2.6 Deploy to Kubernetes
```bash
# Apply all configurations
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n project-unify
kubectl get services -n project-unify
kubectl get ingress -n project-unify

# Scale deployments
kubectl scale deployment backend-deployment --replicas=5 -n project-unify

# Update deployment
kubectl set image deployment/backend-deployment backend=your-registry/project-unify-backend:v2 -n project-unify
```

## 🔄 CI/CD Pipelines

### GitHub Actions

#### 1.1 Main Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy Project UNIFY

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: |
          backend/package-lock.json
          frontend/package-lock.json
    
    - name: Install Backend Dependencies
      run: |
        cd backend
        npm ci
    
    - name: Install Frontend Dependencies
      run: |
        cd frontend
        npm ci
    
    - name: Run Backend Tests
      run: |
        cd backend
        npm test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        JWT_SECRET: test-secret
        JWT_REFRESH_SECRET: test-refresh-secret
    
    - name: Run Frontend Tests
      run: |
        cd frontend
        npm test
    
    - name: Build Backend
      run: |
        cd backend
        npm run build
    
    - name: Build Frontend
      run: |
        cd frontend
        npm run build

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and Push Backend Image
      uses: docker/build-push-action@v5
      with:
        context: ./backend
        file: ./backend/Dockerfile.prod
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-backend:${{ github.sha }}
    
    - name: Build and Push Frontend Image
      uses: docker/build-push-action@v5
      with:
        context: ./frontend
        file: ./frontend/Dockerfile.prod
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}-frontend:${{ github.sha }}
    
    - name: Deploy to Staging
      run: |
        # Deploy to your staging environment
        # This could be Railway, Render, or your own infrastructure
        echo "Deploying to staging..."

  deploy-production:
    needs: [test, deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Deploy to Production
      run: |
        # Deploy to production
        # Update Kubernetes deployments, Railway, etc.
        echo "Deploying to production..."
```

#### 1.2 Database Migration Workflow
```yaml
# .github/workflows/migrate.yml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to migrate'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
    
    - name: Install Dependencies
      run: |
        cd backend
        npm ci
    
    - name: Run Migrations
      run: |
        cd backend
        npm run migrate
      env:
        DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### GitLab CI

#### 2.1 GitLab CI Configuration
```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy-staging
  - deploy-production

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

services:
  - docker:20.10.16-dind
  - postgres:15-alpine

variables:
  POSTGRES_DB: test_db
  POSTGRES_USER: postgres
  POSTGRES_PASSWORD: postgres
  POSTGRES_HOST_AUTH_METHOD: trust

before_script:
  - apt-get update -qq && apt-get install -y -qq git curl
  - curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  - apt-get install -y nodejs

test-backend:
  stage: test
  script:
    - cd backend
    - npm ci
    - npm run test
  variables:
    DATABASE_URL: "postgresql://postgres:postgres@postgres:5432/test_db"
    JWT_SECRET: "test-secret"
    JWT_REFRESH_SECRET: "test-refresh-secret"

test-frontend:
  stage: test
  script:
    - cd frontend
    - npm ci
    - npm run test

build-images:
  stage: build
  image: docker:20.10.16
  services:
    - docker:20.10.16-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -f backend/Dockerfile.prod -t $CI_REGISTRY_IMAGE/backend:$CI_COMMIT_SHA backend/
    - docker build -f frontend/Dockerfile.prod -t $CI_REGISTRY_IMAGE/frontend:$CI_COMMIT_SHA frontend/
    - docker push $CI_REGISTRY_IMAGE/backend:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY_IMAGE/frontend:$CI_COMMIT_SHA
  only:
    - main

deploy-staging:
  stage: deploy-staging
  script:
    - echo "Deploying to staging environment"
    # Add your staging deployment commands here
  environment:
    name: staging
    url: https://staging.yourdomain.com
  only:
    - main

deploy-production:
  stage: deploy-production
  script:
    - echo "Deploying to production environment"
    # Add your production deployment commands here
  environment:
    name: production
    url: https://yourdomain.com
  when: manual
  only:
    - main
```

## 🛡 Production Readiness

### Monitoring Setup

#### 1.1 Prometheus Configuration
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'project-unify-backend'
    static_configs:
      - targets: ['backend:3001']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'project-unify-frontend'
    static_configs:
      - targets: ['frontend:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

#### 1.2 Grafana Dashboard
```json
{
  "dashboard": {
    "id": null,
    "title": "Project UNIFY Monitoring",
    "tags": ["project-unify"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"project-unify-backend\"}[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "id": 2,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"project-unify-backend\"}[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      }
    ]
  }
}
```

#### 1.3 Docker Compose for Monitoring
```yaml
# monitoring/docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager.yml:/etc/alertmanager/alertmanager.yml

volumes:
  grafana-storage:
```

### Logging Setup

#### 2.1 ELK Stack Configuration
```yaml
# logging/docker-compose.elk.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    ports:
      - "5044:5044"
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

volumes:
  elasticsearch-data:
```

#### 2.2 Logstash Configuration
```ruby
# logging/logstash.conf
input {
  beats {
    port => 5044
  }
}

filter {
  if [fields][service] == "project-unify-backend" {
    grok {
      match => { "message" => "%{TIMESTAMP_ISO8601:timestamp} %{LOGLEVEL:level} %{GREEDYDATA:message}" }
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "project-unify-%{+YYYY.MM.dd}"
  }
}
```

### Security Hardening

#### 3.1 Nginx Security Configuration
```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Hide nginx version
    server_tokens off;

    # Frontend
    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        location / {
            proxy_pass http://frontend:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # Backend API
    server {
        listen 443 ssl http2;
        server_name api.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        location / {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend:3001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api/v1/auth/login {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://backend:3001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## 🚨 Troubleshooting

### Common Deployment Issues

#### 1. Database Connection Issues

**Problem**: `ECONNREFUSED` or timeout errors
```bash
# Check database connectivity
pg_isready -h your-db-host -p 5432

# Test connection string
psql "postgresql://user:pass@host:port/db" -c "SELECT 1;"

# Check firewall rules
telnet your-db-host 5432
```

**Solutions**:
- Verify connection string format
- Check firewall/security group rules
- Ensure database is running and accessible
- Verify SSL requirements (`?sslmode=require`)

#### 2. Environment Variable Issues

**Problem**: Variables not loading or undefined
```bash
# Debug environment variables
printenv | grep PROJECT_UNIFY
node -e "console.log(process.env.DATABASE_URL)"

# Check file encoding
file .env
head -c 20 .env | od -c
```

**Solutions**:
- Ensure `.env` file exists and has correct format
- Check for BOM or special characters
- Verify variable names match exactly
- Use quotes for values with spaces or special characters

#### 3. Build Failures

**Problem**: TypeScript or build errors
```bash
# Clear caches
rm -rf node_modules package-lock.json
rm -rf .next (for frontend)
rm -rf dist (for backend)

# Reinstall dependencies
npm ci

# Check TypeScript configuration
npx tsc --noEmit
```

**Solutions**:
- Update dependencies to compatible versions
- Fix TypeScript errors before deployment
- Ensure all required files are included in build
- Check memory limits during build process

#### 4. SSL/TLS Certificate Issues

**Problem**: Certificate errors or HTTPS not working
```bash
# Check certificate validity
openssl x509 -in cert.pem -text -noout

# Test SSL connection
openssl s_client -connect yourdomain.com:443

# Check certificate chain
curl -I https://yourdomain.com
```

**Solutions**:
- Ensure certificate includes full chain
- Verify domain matches certificate
- Check certificate expiration date
- Use Let's Encrypt for free certificates

#### 5. Performance Issues

**Problem**: Slow response times or high resource usage
```bash
# Monitor resource usage
docker stats
htop

# Check database performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

# Profile Node.js application
node --prof app.js
node --prof-process isolate-*.log > processed.txt
```

**Solutions**:
- Add database indexes for frequently queried columns
- Implement Redis caching for expensive operations
- Optimize Docker images (multi-stage builds)
- Use CDN for static assets
- Enable gzip compression

### Monitoring and Alerting

#### Health Check Endpoints
```javascript
// backend/src/routes/health.ts
app.get('/health', async (req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'unknown',
    redis: 'unknown'
  }

  try {
    // Database check
    await pool.query('SELECT 1')
    checks.database = 'healthy'
  } catch (error) {
    checks.database = 'unhealthy'
    checks.status = 'degraded'
  }

  try {
    // Redis check
    await redis.ping()
    checks.redis = 'healthy'
  } catch (error) {
    checks.redis = 'unhealthy'
    checks.status = 'degraded'
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503
  res.status(statusCode).json(checks)
})
```

#### Alerting Rules
```yaml
# monitoring/alert-rules.yml
groups:
- name: project-unify-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is above 10% for 5 minutes"

  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database is down"
      description: "PostgreSQL database is not responding"

  - alert: HighMemoryUsage
    expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is above 90%"
```

This comprehensive deployment guide covers multiple platforms and deployment strategies. Each section includes step-by-step instructions, configuration files, and troubleshooting tips to ensure successful deployments.