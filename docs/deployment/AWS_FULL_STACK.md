# AWS Full Stack Deployment Guide

This comprehensive guide covers deploying Project UNIFY on AWS using various services for a production-ready, scalable infrastructure.

## 🎯 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CloudFront    │────│   S3 (Frontend)  │    │  ECS (Backend)  │
│     (CDN)       │    │    Next.js       │    │   Express API   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         │                        │                       │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Route 53      │    │   Application    │    │  RDS PostgreSQL │
│    (DNS)        │    │  Load Balancer   │    │   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- AWS Account with billing enabled
- AWS CLI installed and configured
- Docker installed locally
- Domain name (optional but recommended)
- Basic knowledge of AWS services

## 🚀 Step 1: Infrastructure Setup

### 1.1 Create VPC and Networking

```bash
# Create VPC using AWS CLI
aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=project-unify-vpc}]'

# Create public subnets (for ALB)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxxxxxx \
  --cidr-block 10.0.1.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=project-unify-public-1a}]'

aws ec2 create-subnet \
  --vpc-id vpc-xxxxxxxxx \
  --cidr-block 10.0.2.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=project-unify-public-1b}]'

# Create private subnets (for ECS tasks and RDS)
aws ec2 create-subnet \
  --vpc-id vpc-xxxxxxxxx \
  --cidr-block 10.0.3.0/24 \
  --availability-zone us-east-1a \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=project-unify-private-1a}]'

aws ec2 create-subnet \
  --vpc-id vpc-xxxxxxxxx \
  --cidr-block 10.0.4.0/24 \
  --availability-zone us-east-1b \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=project-unify-private-1b}]'
```

### 1.2 CloudFormation Template

Create `infrastructure/cloudformation.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Project UNIFY Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
  
  DomainName:
    Type: String
    Description: Domain name for the application
    Default: projectunify.com

Resources:
  # VPC Configuration
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-project-unify-vpc

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-project-unify-igw

  # Public Subnets
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-public-subnet-1

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-public-subnet-2

  # Private Subnets
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.3.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-private-subnet-1

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.4.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-private-subnet-2

  # RDS Subnet Group
  DBSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Subnet group for RDS database
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
      Tags:
        - Key: Name
          Value: !Sub ${Environment}-db-subnet-group

  # RDS PostgreSQL Instance
  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub ${Environment}-project-unify-db
      DBInstanceClass: db.t3.micro
      Engine: postgres
      EngineVersion: '15.4'
      AllocatedStorage: 20
      StorageType: gp2
      StorageEncrypted: true
      DBName: project_unify
      MasterUsername: postgres
      MasterUserPassword: !Ref DatabasePassword
      DBSubnetGroupName: !Ref DBSubnetGroup
      VPCSecurityGroups:
        - !Ref DatabaseSecurityGroup
      BackupRetentionPeriod: 7
      MultiAZ: false
      PubliclyAccessible: false
      DeletionProtection: true

  # Security Groups
  DatabaseSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for RDS database
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref ECSSecurityGroup

  ECSSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for ECS tasks
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 3001
          ToPort: 3001
          SourceSecurityGroupId: !Ref ALBSecurityGroup

  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Application Load Balancer
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0

Parameters:
  DatabasePassword:
    Type: String
    NoEcho: true
    Description: Password for the RDS database
    MinLength: 8
    MaxLength: 128

Outputs:
  VPCId:
    Description: VPC ID
    Value: !Ref VPC
    Export:
      Name: !Sub ${Environment}-VPC-ID

  DatabaseEndpoint:
    Description: RDS Database Endpoint
    Value: !GetAtt Database.Endpoint.Address
    Export:
      Name: !Sub ${Environment}-DB-Endpoint
```

Deploy the infrastructure:

```bash
# Deploy CloudFormation stack
aws cloudformation create-stack \
  --stack-name project-unify-infrastructure \
  --template-body file://infrastructure/cloudformation.yaml \
  --parameters ParameterKey=Environment,ParameterValue=production \
               ParameterKey=DomainName,ParameterValue=yourdomain.com \
               ParameterKey=DatabasePassword,ParameterValue=YourSecurePassword123! \
  --capabilities CAPABILITY_IAM
```

## 🐳 Step 2: Backend Deployment with ECS

### 2.1 Create ECR Repository

```bash
# Create ECR repository for backend
aws ecr create-repository \
  --repository-name project-unify/backend \
  --region us-east-1

# Get login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
```

### 2.2 Build and Push Docker Image

Create `backend/Dockerfile.production`:

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Build application
RUN npm run build

# Remove dev dependencies and source files
RUN rm -rf src/ tsconfig.json

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start application
CMD ["npm", "start"]
```

Build and push:

```bash
# Build Docker image
cd backend
docker build -f Dockerfile.production -t project-unify-backend .

# Tag for ECR
docker tag project-unify-backend:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/project-unify/backend:latest

# Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/project-unify/backend:latest
```

### 2.3 ECS Task Definition

Create `infrastructure/ecs-task-definition.json`:

```json
{
  "family": "project-unify-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::123456789012:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "123456789012.dkr.ecr.us-east-1.amazonaws.com/project-unify/backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3001"
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
        },
        {
          "name": "SENDGRID_API_KEY",
          "valueFrom": "arn:aws:ssm:us-east-1:123456789012:parameter/project-unify/sendgrid-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/project-unify-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "curl -f http://localhost:3001/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### 2.4 Store Secrets in Systems Manager

```bash
# Store database URL
aws ssm put-parameter \
  --name "/project-unify/database-url" \
  --value "postgresql://postgres:YourPassword@your-db-endpoint:5432/project_unify" \
  --type "SecureString"

# Store JWT secret
aws ssm put-parameter \
  --name "/project-unify/jwt-secret" \
  --value "your-super-secret-jwt-key-32-characters-minimum" \
  --type "SecureString"

# Store SendGrid API key
aws ssm put-parameter \
  --name "/project-unify/sendgrid-key" \
  --value "SG.your-sendgrid-api-key" \
  --type "SecureString"
```

### 2.5 Create ECS Service

```bash
# Create ECS cluster
aws ecs create-cluster \
  --cluster-name project-unify-cluster \
  --capacity-providers FARGATE \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1

# Register task definition
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/ecs-task-definition.json

# Create service
aws ecs create-service \
  --cluster project-unify-cluster \
  --service-name project-unify-backend \
  --task-definition project-unify-backend:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxxxxx,subnet-yyyyyyyy],securityGroups=[sg-xxxxxxxxx],assignPublicIp=DISABLED}" \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/project-unify-backend/xxxxxxxxxx,containerName=backend,containerPort=3001
```

## 🌐 Step 3: Frontend Deployment with S3 and CloudFront

### 3.1 Build Frontend for Production

```bash
cd frontend

# Install dependencies
npm install

# Build for production
NEXT_PUBLIC_API_URL=https://api.yourdomain.com npm run build
```

### 3.2 Create S3 Bucket and CloudFront Distribution

Create `infrastructure/frontend-cloudformation.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Project UNIFY Frontend Infrastructure'

Parameters:
  DomainName:
    Type: String
    Description: Domain name for the application
    Default: projectunify.com

Resources:
  # S3 Bucket for Frontend
  FrontendBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub ${DomainName}-frontend
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256

  # CloudFront Origin Access Identity
  CloudFrontOriginAccessIdentity:
    Type: AWS::CloudFront::CloudFrontOriginAccessIdentity
    Properties:
      CloudFrontOriginAccessIdentityConfig:
        Comment: !Sub 'OAI for ${DomainName}'

  # CloudFront Distribution
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Origins:
          - DomainName: !GetAtt FrontendBucket.RegionalDomainName
            Id: S3Origin
            S3OriginConfig:
              OriginAccessIdentity: !Sub 'origin-access-identity/cloudfront/${CloudFrontOriginAccessIdentity}'
        Enabled: true
        DefaultRootObject: index.html
        Comment: !Sub 'CloudFront distribution for ${DomainName}'
        DefaultCacheBehavior:
          AllowedMethods:
            - DELETE
            - GET
            - HEAD
            - OPTIONS
            - PATCH
            - POST
            - PUT
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad # CachingDisabled
          OriginRequestPolicyId: 88a5eaf4-2fd4-4709-b370-b4c650ea3fcf # CORS-S3Origin
        CustomErrorResponses:
          - ErrorCode: 403
            ResponseCode: 200
            ResponsePagePath: /index.html
          - ErrorCode: 404
            ResponseCode: 200
            ResponsePagePath: /index.html
        Aliases:
          - !Ref DomainName
          - !Sub 'www.${DomainName}'
        ViewerCertificate:
          AcmCertificateArn: !Ref SSLCertificate
          SslSupportMethod: sni-only
          MinimumProtocolVersion: TLSv1.2_2021

  # SSL Certificate
  SSLCertificate:
    Type: AWS::CertificateManager::Certificate
    Properties:
      DomainName: !Ref DomainName
      SubjectAlternativeNames:
        - !Sub 'www.${DomainName}'
        - !Sub 'api.${DomainName}'
      ValidationMethod: DNS

Outputs:
  CloudFrontDomainName:
    Description: CloudFront Distribution Domain Name
    Value: !GetAtt CloudFrontDistribution.DomainName
    Export:
      Name: !Sub '${AWS::StackName}-CloudFrontDomainName'

  FrontendBucketName:
    Description: S3 Bucket Name for Frontend
    Value: !Ref FrontendBucket
    Export:
      Name: !Sub '${AWS::StackName}-FrontendBucket'
```

Deploy frontend infrastructure:

```bash
aws cloudformation create-stack \
  --stack-name project-unify-frontend \
  --template-body file://infrastructure/frontend-cloudformation.yaml \
  --parameters ParameterKey=DomainName,ParameterValue=yourdomain.com
```

### 3.3 Deploy Frontend to S3

```bash
# Sync built files to S3
aws s3 sync frontend/out/ s3://yourdomain.com-frontend/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

## 🔄 Step 4: CI/CD Pipeline with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: project-unify/backend
  ECS_SERVICE: project-unify-backend
  ECS_CLUSTER: project-unify-cluster
  ECS_TASK_DEFINITION: infrastructure/ecs-task-definition.json
  CONTAINER_NAME: backend

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd backend && npm ci
          cd ../frontend && npm ci
      
      - name: Run tests
        run: |
          cd backend && npm test
          cd ../frontend && npm test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build, tag, and push image to Amazon ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd backend
          docker build -f Dockerfile.production -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Fill in the new image ID in the Amazon ECS task definition
        id: task-def
        uses: aws-actions/amazon-ecs-render-task-definition@v1
        with:
          task-definition: ${{ env.ECS_TASK_DEFINITION }}
          container-name: ${{ env.CONTAINER_NAME }}
          image: ${{ steps.build-image.outputs.image }}

      - name: Deploy Amazon ECS task definition
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: ${{ steps.task-def.outputs.task-definition }}
          service: ${{ env.ECS_SERVICE }}
          cluster: ${{ env.ECS_CLUSTER }}
          wait-for-service-stability: true

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Install and build
        run: |
          cd frontend
          npm ci
          NEXT_PUBLIC_API_URL=https://api.yourdomain.com npm run build

      - name: Deploy to S3
        run: |
          aws s3 sync frontend/out/ s3://${{ secrets.S3_BUCKET_NAME }}/ --delete

      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

## 📊 Step 5: Monitoring and Logging

### 5.1 CloudWatch Setup

Create `infrastructure/monitoring-cloudformation.yaml`:

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Project UNIFY Monitoring Infrastructure'

Resources:
  # CloudWatch Log Groups
  BackendLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: /ecs/project-unify-backend
      RetentionInDays: 30

  # CloudWatch Alarms
  HighCPUAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmDescription: 'High CPU utilization'
      AlarmActions:
        - !Ref SNSTopic
      MetricName: CPUUtilization
      Namespace: AWS/ECS
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: ServiceName
          Value: project-unify-backend
        - Name: ClusterName
          Value: project-unify-cluster

  HighMemoryAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmDescription: 'High memory utilization'
      AlarmActions:
        - !Ref SNSTopic
      MetricName: MemoryUtilization
      Namespace: AWS/ECS
      Statistic: Average
      Period: 300
      EvaluationPeriods: 2
      Threshold: 80
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: ServiceName
          Value: project-unify-backend
        - Name: ClusterName
          Value: project-unify-cluster

  # SNS Topic for Alerts
  SNSTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: project-unify-alerts
      DisplayName: 'Project UNIFY Alerts'

  # SNS Subscription
  SNSSubscription:
    Type: AWS::SNS::Subscription
    Properties:
      Protocol: email
      TopicArn: !Ref SNSTopic
      Endpoint: alerts@yourdomain.com
```

### 5.2 Application Performance Monitoring

Add to your backend application:

```typescript
// backend/src/middleware/monitoring.ts
import { Request, Response, NextFunction } from 'express'
import { CloudWatch } from 'aws-sdk'

const cloudwatch = new CloudWatch({ region: process.env.AWS_REGION })

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  
  res.on('finish', async () => {
    const duration = Date.now() - start
    
    // Send custom metrics to CloudWatch
    const params = {
      Namespace: 'ProjectUnify/API',
      MetricData: [
        {
          MetricName: 'ResponseTime',
          Value: duration,
          Unit: 'Milliseconds',
          Dimensions: [
            {
              Name: 'Endpoint',
              Value: req.path
            },
            {
              Name: 'Method',
              Value: req.method
            },
            {
              Name: 'StatusCode',
              Value: res.statusCode.toString()
            }
          ]
        }
      ]
    }
    
    try {
      await cloudwatch.putMetricData(params).promise()
    } catch (error) {
      console.error('Failed to send metrics:', error)
    }
  })
  
  next()
}
```

## 💰 Cost Optimization

### 5.1 Resource Optimization

```bash
# Use Spot instances for development
# Configure auto-scaling policies
# Set up CloudWatch billing alerts
# Use S3 Intelligent Tiering
# Enable CloudFront caching
```

### 5.2 Cost Monitoring

```yaml
# CloudWatch Billing Alarm
BillingAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmDescription: 'Billing alarm for AWS costs'
    AlarmActions:
      - !Ref SNSTopic
    MetricName: EstimatedCharges
    Namespace: AWS/Billing
    Statistic: Maximum
    Period: 86400
    EvaluationPeriods: 1
    Threshold: 100
    ComparisonOperator: GreaterThanThreshold
    Dimensions:
      - Name: Currency
        Value: USD
```

## 🔒 Security Best Practices

### 5.1 Security Checklist

- [ ] Enable VPC Flow Logs
- [ ] Use IAM roles with least privilege
- [ ] Enable AWS Config for compliance
- [ ] Set up AWS GuardDuty for threat detection
- [ ] Use AWS Secrets Manager for sensitive data
- [ ] Enable CloudTrail for audit logging
- [ ] Configure WAF for web application protection
- [ ] Use Systems Manager Session Manager instead of SSH

### 5.2 Security Monitoring

```bash
# Enable GuardDuty
aws guardduty create-detector --enable

# Enable Config
aws configservice put-configuration-recorder \
  --configuration-recorder name=default,roleARN=arn:aws:iam::123456789012:role/config-role

# Enable CloudTrail
aws cloudtrail create-trail \
  --name project-unify-trail \
  --s3-bucket-name project-unify-cloudtrail-logs
```

This AWS deployment provides enterprise-grade infrastructure with high availability, security, and scalability for Project UNIFY.