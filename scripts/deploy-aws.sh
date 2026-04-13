#!/bin/bash

# Project UNIFY - AWS Full Stack Deployment Script
# This script automates the deployment process to AWS (ECS + S3 + CloudFront + RDS)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="project-unify"
AWS_REGION="us-east-1"
VPC_CIDR="10.0.0.0/16"
SUBNET1_CIDR="10.0.1.0/24"
SUBNET2_CIDR="10.0.2.0/24"
DB_INSTANCE_CLASS="db.t3.micro"
ECS_INSTANCE_TYPE="t3.small"

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

check_aws_cli() {
    log_info "Checking AWS CLI..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it and configure your credentials."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log_success "AWS CLI is configured"
}

create_vpc() {
    log_info "Creating VPC and networking..."
    
    # Create VPC
    VPC_ID=$(aws ec2 create-vpc \
        --cidr-block $VPC_CIDR \
        --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$PROJECT_NAME-vpc}]" \
        --query 'Vpc.VpcId' \
        --output text)
    
    log_success "Created VPC: $VPC_ID"
    
    # Create Internet Gateway
    IGW_ID=$(aws ec2 create-internet-gateway \
        --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=$PROJECT_NAME-igw}]" \
        --query 'InternetGateway.InternetGatewayId' \
        --output text)
    
    # Attach Internet Gateway to VPC
    aws ec2 attach-internet-gateway \
        --vpc-id $VPC_ID \
        --internet-gateway-id $IGW_ID
    
    log_success "Created and attached Internet Gateway: $IGW_ID"
    
    # Get availability zones
    AZ1=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text)
    AZ2=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[1].ZoneName' --output text)
    
    # Create subnets
    SUBNET1_ID=$(aws ec2 create-subnet \
        --vpc-id $VPC_ID \
        --cidr-block $SUBNET1_CIDR \
        --availability-zone $AZ1 \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$PROJECT_NAME-subnet-1}]" \
        --query 'Subnet.SubnetId' \
        --output text)
    
    SUBNET2_ID=$(aws ec2 create-subnet \
        --vpc-id $VPC_ID \
        --cidr-block $SUBNET2_CIDR \
        --availability-zone $AZ2 \
        --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$PROJECT_NAME-subnet-2}]" \
        --query 'Subnet.SubnetId' \
        --output text)
    
    log_success "Created subnets: $SUBNET1_ID, $SUBNET2_ID"
    
    # Create route table
    ROUTE_TABLE_ID=$(aws ec2 create-route-table \
        --vpc-id $VPC_ID \
        --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=$PROJECT_NAME-rt}]" \
        --query 'RouteTable.RouteTableId' \
        --output text)
    
    # Add route to Internet Gateway
    aws ec2 create-route \
        --route-table-id $ROUTE_TABLE_ID \
        --destination-cidr-block 0.0.0.0/0 \
        --gateway-id $IGW_ID
    
    # Associate subnets with route table
    aws ec2 associate-route-table --subnet-id $SUBNET1_ID --route-table-id $ROUTE_TABLE_ID
    aws ec2 associate-route-table --subnet-id $SUBNET2_ID --route-table-id $ROUTE_TABLE_ID
    
    # Enable auto-assign public IP for subnets
    aws ec2 modify-subnet-attribute --subnet-id $SUBNET1_ID --map-public-ip-on-launch
    aws ec2 modify-subnet-attribute --subnet-id $SUBNET2_ID --map-public-ip-on-launch
    
    log_success "VPC networking setup completed"
    
    # Save VPC info
    cat > aws-resources.json << EOF
{
  "vpc_id": "$VPC_ID",
  "subnet1_id": "$SUBNET1_ID",
  "subnet2_id": "$SUBNET2_ID",
  "igw_id": "$IGW_ID",
  "route_table_id": "$ROUTE_TABLE_ID"
}
EOF
}

create_security_groups() {
    log_info "Creating security groups..."
    
    # Load VPC ID
    VPC_ID=$(jq -r '.vpc_id' aws-resources.json)
    
    # Create security group for RDS
    RDS_SG_ID=$(aws ec2 create-security-group \
        --group-name "$PROJECT_NAME-rds-sg" \
        --description "Security group for RDS database" \
        --vpc-id $VPC_ID \
        --query 'GroupId' \
        --output text)
    
    # Create security group for ECS
    ECS_SG_ID=$(aws ec2 create-security-group \
        --group-name "$PROJECT_NAME-ecs-sg" \
        --description "Security group for ECS tasks" \
        --vpc-id $VPC_ID \
        --query 'GroupId' \
        --output text)
    
    # Create security group for ALB
    ALB_SG_ID=$(aws ec2 create-security-group \
        --group-name "$PROJECT_NAME-alb-sg" \
        --description "Security group for Application Load Balancer" \
        --vpc-id $VPC_ID \
        --query 'GroupId' \
        --output text)
    
    # Configure ALB security group (allow HTTP/HTTPS from anywhere)
    aws ec2 authorize-security-group-ingress \
        --group-id $ALB_SG_ID \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0
    
    aws ec2 authorize-security-group-ingress \
        --group-id $ALB_SG_ID \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0
    
    # Configure ECS security group (allow traffic from ALB)
    aws ec2 authorize-security-group-ingress \
        --group-id $ECS_SG_ID \
        --protocol tcp \
        --port 3001 \
        --source-group $ALB_SG_ID
    
    # Configure RDS security group (allow traffic from ECS)
    aws ec2 authorize-security-group-ingress \
        --group-id $RDS_SG_ID \
        --protocol tcp \
        --port 5432 \
        --source-group $ECS_SG_ID
    
    log_success "Security groups created: RDS($RDS_SG_ID), ECS($ECS_SG_ID), ALB($ALB_SG_ID)"
    
    # Update resources file
    jq ". + {\"rds_sg_id\": \"$RDS_SG_ID\", \"ecs_sg_id\": \"$ECS_SG_ID\", \"alb_sg_id\": \"$ALB_SG_ID\"}" aws-resources.json > temp.json && mv temp.json aws-resources.json
}

create_rds() {
    log_info "Creating RDS PostgreSQL database..."
    
    # Load resource IDs
    SUBNET1_ID=$(jq -r '.subnet1_id' aws-resources.json)
    SUBNET2_ID=$(jq -r '.subnet2_id' aws-resources.json)
    RDS_SG_ID=$(jq -r '.rds_sg_id' aws-resources.json)
    
    # Create DB subnet group
    aws rds create-db-subnet-group \
        --db-subnet-group-name "$PROJECT_NAME-db-subnet-group" \
        --db-subnet-group-description "Subnet group for $PROJECT_NAME database" \
        --subnet-ids $SUBNET1_ID $SUBNET2_ID
    
    # Generate random password
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Create RDS instance
    aws rds create-db-instance \
        --db-instance-identifier "$PROJECT_NAME-db" \
        --db-instance-class $DB_INSTANCE_CLASS \
        --engine postgres \
        --engine-version 15.4 \
        --master-username postgres \
        --master-user-password "$DB_PASSWORD" \
        --allocated-storage 20 \
        --storage-type gp2 \
        --db-subnet-group-name "$PROJECT_NAME-db-subnet-group" \
        --vpc-security-group-ids $RDS_SG_ID \
        --backup-retention-period 7 \
        --storage-encrypted \
        --deletion-protection
    
    log_info "RDS instance creation initiated. This may take 10-15 minutes..."
    
    # Wait for RDS to be available
    aws rds wait db-instance-available --db-instance-identifier "$PROJECT_NAME-db"
    
    # Get RDS endpoint
    DB_ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier "$PROJECT_NAME-db" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    log_success "RDS database created: $DB_ENDPOINT"
    
    # Store database credentials in AWS Secrets Manager
    aws secretsmanager create-secret \
        --name "$PROJECT_NAME/database" \
        --description "Database credentials for $PROJECT_NAME" \
        --secret-string "{\"username\":\"postgres\",\"password\":\"$DB_PASSWORD\",\"host\":\"$DB_ENDPOINT\",\"port\":5432,\"dbname\":\"postgres\"}"
    
    # Update resources file
    jq ". + {\"db_endpoint\": \"$DB_ENDPOINT\", \"db_password\": \"$DB_PASSWORD\"}" aws-resources.json > temp.json && mv temp.json aws-resources.json
    
    log_success "Database credentials stored in AWS Secrets Manager"
}

create_ecr_repositories() {
    log_info "Creating ECR repositories..."
    
    # Create repository for backend
    aws ecr create-repository --repository-name "$PROJECT_NAME-backend" || true
    
    # Get ECR URI
    ECR_URI=$(aws ecr describe-repositories --repository-names "$PROJECT_NAME-backend" --query 'repositories[0].repositoryUri' --output text)
    
    log_success "ECR repository created: $ECR_URI"
    
    # Update resources file
    jq ". + {\"ecr_uri\": \"$ECR_URI\"}" aws-resources.json > temp.json && mv temp.json aws-resources.json
}

build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    ECR_URI=$(jq -r '.ecr_uri' aws-resources.json)
    
    # Get ECR login token
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI
    
    # Build backend image
    log_info "Building backend image..."
    cd backend
    docker build -f Dockerfile.prod -t $ECR_URI:latest .
    docker push $ECR_URI:latest
    cd ..
    
    log_success "Backend image pushed to ECR"
}

create_ecs_cluster() {
    log_info "Creating ECS cluster..."
    
    # Create ECS cluster
    aws ecs create-cluster --cluster-name "$PROJECT_NAME-cluster"
    
    # Create task execution role
    cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    # Create IAM role for ECS task execution
    aws iam create-role \
        --role-name "$PROJECT_NAME-ecs-execution-role" \
        --assume-role-policy-document file://trust-policy.json || true
    
    # Attach policy to role
    aws iam attach-role-policy \
        --role-name "$PROJECT_NAME-ecs-execution-role" \
        --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
    
    # Create custom policy for secrets access
    cat > secrets-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:$AWS_REGION:*:secret:$PROJECT_NAME/*"
    }
  ]
}
EOF

    aws iam put-role-policy \
        --role-name "$PROJECT_NAME-ecs-execution-role" \
        --policy-name "SecretsManagerAccess" \
        --policy-document file://secrets-policy.json
    
    # Get account ID
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Update resources file
    jq ". + {\"account_id\": \"$ACCOUNT_ID\"}" aws-resources.json > temp.json && mv temp.json aws-resources.json
    
    log_success "ECS cluster and IAM roles created"
    
    # Cleanup temporary files
    rm -f trust-policy.json secrets-policy.json
}

create_load_balancer() {
    log_info "Creating Application Load Balancer..."
    
    # Load resource IDs
    SUBNET1_ID=$(jq -r '.subnet1_id' aws-resources.json)
    SUBNET2_ID=$(jq -r '.subnet2_id' aws-resources.json)
    ALB_SG_ID=$(jq -r '.alb_sg_id' aws-resources.json)
    VPC_ID=$(jq -r '.vpc_id' aws-resources.json)
    
    # Create ALB
    ALB_ARN=$(aws elbv2 create-load-balancer \
        --name "$PROJECT_NAME-alb" \
        --subnets $SUBNET1_ID $SUBNET2_ID \
        --security-groups $ALB_SG_ID \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text)
    
    # Create target group
    TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
        --name "$PROJECT_NAME-tg" \
        --protocol HTTP \
        --port 3001 \
        --vpc-id $VPC_ID \
        --target-type ip \
        --health-check-path /health \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    
    # Create listener
    aws elbv2 create-listener \
        --load-balancer-arn $ALB_ARN \
        --protocol HTTP \
        --port 80 \
        --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN
    
    # Get ALB DNS name
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --load-balancer-arns $ALB_ARN \
        --query 'LoadBalancers[0].DNSName' \
        --output text)
    
    log_success "Load balancer created: $ALB_DNS"
    
    # Update resources file
    jq ". + {\"alb_arn\": \"$ALB_ARN\", \"target_group_arn\": \"$TARGET_GROUP_ARN\", \"alb_dns\": \"$ALB_DNS\"}" aws-resources.json > temp.json && mv temp.json aws-resources.json
}

create_ecs_service() {
    log_info "Creating ECS task definition and service..."
    
    # Load resource IDs
    ECR_URI=$(jq -r '.ecr_uri' aws-resources.json)
    ACCOUNT_ID=$(jq -r '.account_id' aws-resources.json)
    TARGET_GROUP_ARN=$(jq -r '.target_group_arn' aws-resources.json)
    SUBNET1_ID=$(jq -r '.subnet1_id' aws-resources.json)
    SUBNET2_ID=$(jq -r '.subnet2_id' aws-resources.json)
    ECS_SG_ID=$(jq -r '.ecs_sg_id' aws-resources.json)
    
    # Create task definition
    cat > task-definition.json << EOF
{
  "family": "$PROJECT_NAME-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/$PROJECT_NAME-ecs-execution-role",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "$ECR_URI:latest",
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
          "valueFrom": "arn:aws:secretsmanager:$AWS_REGION:$ACCOUNT_ID:secret:$PROJECT_NAME/database:username::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/$PROJECT_NAME-backend",
          "awslogs-region": "$AWS_REGION",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

    # Create CloudWatch log group
    aws logs create-log-group --log-group-name "/ecs/$PROJECT_NAME-backend" || true
    
    # Register task definition
    aws ecs register-task-definition --cli-input-json file://task-definition.json
    
    # Create ECS service
    aws ecs create-service \
        --cluster "$PROJECT_NAME-cluster" \
        --service-name "$PROJECT_NAME-backend" \
        --task-definition "$PROJECT_NAME-backend:1" \
        --desired-count 2 \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$SUBNET1_ID,$SUBNET2_ID],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
        --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=backend,containerPort=3001"
    
    log_success "ECS service created and starting..."
    
    # Cleanup
    rm -f task-definition.json
}

create_s3_cloudfront() {
    log_info "Setting up S3 and CloudFront for frontend..."
    
    # Create S3 bucket for frontend
    BUCKET_NAME="$PROJECT_NAME-frontend-$(date +%s)"
    aws s3 mb "s3://$BUCKET_NAME"
    
    # Build frontend
    log_info "Building frontend..."
    cd frontend
    npm install
    npm run build
    
    # Upload to S3
    aws s3 sync out/ "s3://$BUCKET_NAME" --delete
    
    # Create bucket policy for CloudFront access
    cat > bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontAccess",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

    aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy file://bucket-policy.json
    
    # Create CloudFront distribution
    cat > cloudfront-config.json << EOF
{
  "CallerReference": "$PROJECT_NAME-$(date +%s)",
  "Comment": "$PROJECT_NAME Frontend Distribution",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-$BUCKET_NAME",
        "DomainName": "$BUCKET_NAME.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$BUCKET_NAME",
    "ViewerProtocolPolicy": "redirect-to-https",
    "MinTTL": 0,
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "TrustedSigners": {
      "Enabled": false,
      "Quantity": 0
    }
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

    DISTRIBUTION_ID=$(aws cloudfront create-distribution --distribution-config file://cloudfront-config.json --query 'Distribution.Id' --output text)
    
    # Get CloudFront domain name
    CLOUDFRONT_DOMAIN=$(aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.DomainName' --output text)
    
    log_success "CloudFront distribution created: $CLOUDFRONT_DOMAIN"
    
    # Update resources file
    jq ". + {\"s3_bucket\": \"$BUCKET_NAME\", \"cloudfront_id\": \"$DISTRIBUTION_ID\", \"cloudfront_domain\": \"$CLOUDFRONT_DOMAIN\"}" aws-resources.json > temp.json && mv temp.json aws-resources.json
    
    cd ..
    rm -f bucket-policy.json cloudfront-config.json
}

run_health_checks() {
    log_info "Running health checks..."
    
    ALB_DNS=$(jq -r '.alb_dns' aws-resources.json)
    
    log_info "Waiting for ECS service to be stable..."
    aws ecs wait services-stable --cluster "$PROJECT_NAME-cluster" --services "$PROJECT_NAME-backend"
    
    # Check backend health
    log_info "Checking backend health at: http://$ALB_DNS/health"
    
    for i in {1..10}; do
        if curl -s "http://$ALB_DNS/health" > /dev/null; then
            log_success "Backend is healthy"
            break
        else
            log_warning "Backend health check failed, retrying in 30 seconds... ($i/10)"
            sleep 30
        fi
    done
}

cleanup_temp_files() {
    log_info "Cleaning up temporary files..."
    rm -f aws-resources.json
}

main() {
    log_info "Starting Project UNIFY deployment to AWS"
    log_info "======================================"
    
    # Parse command line arguments
    SKIP_VPC=false
    SKIP_RDS=false
    SKIP_FRONTEND=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-vpc)
                SKIP_VPC=true
                shift
                ;;
            --skip-rds)
                SKIP_RDS=true
                shift
                ;;
            --skip-frontend)
                SKIP_FRONTEND=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-vpc       Skip VPC creation (use existing)"
                echo "  --skip-rds       Skip RDS creation (use existing)"
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
    
    # Check prerequisites
    check_aws_cli
    
    # Create infrastructure
    if [ "$SKIP_VPC" = false ]; then
        create_vpc
        create_security_groups
    fi
    
    if [ "$SKIP_RDS" = false ]; then
        create_rds
    fi
    
    # Deploy backend
    create_ecr_repositories
    build_and_push_images
    create_ecs_cluster
    create_load_balancer
    create_ecs_service
    
    # Deploy frontend
    if [ "$SKIP_FRONTEND" = false ]; then
        create_s3_cloudfront
    fi
    
    # Final checks
    run_health_checks
    
    log_success "AWS deployment completed successfully!"
    log_info "Backend URL: http://$(jq -r '.alb_dns' aws-resources.json)"
    
    if [ "$SKIP_FRONTEND" = false ]; then
        log_info "Frontend URL: https://$(jq -r '.cloudfront_domain' aws-resources.json)"
    fi
    
    log_info "Next steps:"
    log_info "1. Set up custom domain names"
    log_info "2. Configure SSL certificates"
    log_info "3. Set up monitoring and alerts"
    log_info "4. Configure backup and disaster recovery"
}

# Trap to cleanup on exit
trap cleanup_temp_files EXIT

# Run main function
main "$@"