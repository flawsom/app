# Docker & Kubernetes Deployment Guide

This guide covers containerized deployment of Project UNIFY using Docker Swarm and Kubernetes for production environments.

## 🎯 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Ingress       │────│   Frontend Pod   │    │  Backend Pods   │
│  (nginx/traefik)│    │    (Next.js)     │    │  (Express API)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         │                        │                       │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LoadBalancer  │    │   ConfigMaps &   │    │  PostgreSQL     │
│    Service      │    │     Secrets      │    │   StatefulSet   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- Docker 20.10+ installed
- Kubernetes cluster (local: minikube/k3s, cloud: EKS/GKE/AKS)
- kubectl configured
- Helm 3.x (optional but recommended)
- Basic knowledge of containers and orchestration

## 🐳 Part 1: Docker Swarm Deployment

### 1.1 Production Docker Images

Create optimized Dockerfiles for production:

**Backend Dockerfile (`backend/Dockerfile.prod`):**

```dockerfile
# Multi-stage build for production
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

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
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
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start application
CMD ["node", "dist/server.js"]
```

**Frontend Dockerfile (`frontend/Dockerfile.prod`):**

```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime

# Copy built application
COPY --from=builder /app/out /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 -G nginx

# Change ownership
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

**Frontend nginx configuration (`frontend/nginx.conf`):**

```nginx
events {
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
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

### 1.2 Docker Swarm Stack

Create `docker-stack.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: project_unify
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - backend
    deploy:
      replicas: 1
      placement:
        constraints:
          - node.role == manager
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass /run/secrets/redis_password
    secrets:
      - redis_password
    volumes:
      - redis_data:/data
    networks:
      - backend
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend API
  backend:
    image: project-unify/backend:latest
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@database:5432/project_unify
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET_FILE: /run/secrets/jwt_secret
      SENDGRID_API_KEY_FILE: /run/secrets/sendgrid_key
      FRONTEND_URL: https://yourdomain.com
    secrets:
      - jwt_secret
      - sendgrid_key
    networks:
      - backend
      - frontend
    depends_on:
      - database
      - redis
    deploy:
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
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend
  frontend:
    image: project-unify/frontend:latest
    networks:
      - frontend
    deploy:
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
          memory: 64M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Reverse Proxy
  traefik:
    image: traefik:v2.10
    command:
      - "--api.dashboard=true"
      - "--providers.docker.swarmMode=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@yourdomain.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_letsencrypt:/letsencrypt
    networks:
      - frontend
    deploy:
      placement:
        constraints:
          - node.role == manager
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.dashboard.rule=Host(`traefik.yourdomain.com`)"
        - "traefik.http.routers.dashboard.tls.certresolver=letsencrypt"
        - "traefik.http.services.dashboard.loadbalancer.server.port=8080"

  # Frontend routing
  frontend-router:
    image: project-unify/frontend:latest
    networks:
      - frontend
    deploy:
      replicas: 2
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.frontend.rule=Host(`yourdomain.com`) || Host(`www.yourdomain.com`)"
        - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
        - "traefik.http.services.frontend.loadbalancer.server.port=8080"

  # Backend routing
  backend-router:
    image: project-unify/backend:latest
    networks:
      - frontend
      - backend
    deploy:
      replicas: 3
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.backend.rule=Host(`api.yourdomain.com`)"
        - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
        - "traefik.http.services.backend.loadbalancer.server.port=3001"

networks:
  frontend:
    driver: overlay
    attachable: true
  backend:
    driver: overlay
    internal: true

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  traefik_letsencrypt:
    driver: local

secrets:
  db_password:
    external: true
  redis_password:
    external: true
  jwt_secret:
    external: true
  sendgrid_key:
    external: true
```

### 1.3 Deploy to Docker Swarm

```bash
# Initialize Docker Swarm (if not already done)
docker swarm init

# Create secrets
echo "your-secure-db-password" | docker secret create db_password -
echo "your-secure-redis-password" | docker secret create redis_password -
echo "your-super-secret-jwt-key-32-chars-minimum" | docker secret create jwt_secret -
echo "SG.your-sendgrid-api-key" | docker secret create sendgrid_key -

# Build and tag images
docker build -f backend/Dockerfile.prod -t project-unify/backend:latest backend/
docker build -f frontend/Dockerfile.prod -t project-unify/frontend:latest frontend/

# Deploy stack
docker stack deploy -c docker-stack.yml project-unify

# Check services
docker service ls
docker service logs project-unify_backend
```

## ☸️ Part 2: Kubernetes Deployment

### 2.1 Kubernetes Manifests

Create `k8s/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: project-unify
  labels:
    name: project-unify
```

Create `k8s/secrets.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: project-unify-secrets
  namespace: project-unify
type: Opaque
data:
  # Base64 encoded values
  database-url: cG9zdGdyZXNxbDovL3Bvc3RncmVzOnlvdXItcGFzc3dvcmRAcG9zdGdyZXNxbDo1NDMyL3Byb2plY3RfdW5pZnk=
  jwt-secret: eW91ci1zdXBlci1zZWNyZXQtand0LWtleS0zMi1jaGFycy1taW5pbXVt
  redis-password: eW91ci1zZWN1cmUtcmVkaXMtcGFzc3dvcmQ=
  sendgrid-key: U0cueW91ci1zZW5kZ3JpZC1hcGkta2V5
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: project-unify-config
  namespace: project-unify
data:
  NODE_ENV: "production"
  FRONTEND_URL: "https://yourdomain.com"
  REDIS_URL: "redis://:password@redis:6379"
```

Create `k8s/postgresql.yaml`:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgresql
  namespace: project-unify
spec:
  serviceName: postgresql
  replicas: 1
  selector:
    matchLabels:
      app: postgresql
  template:
    metadata:
      labels:
        app: postgresql
    spec:
      containers:
      - name: postgresql
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: project_unify
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: project-unify-secrets
              key: postgres-password
        ports:
        - containerPort: 5432
          name: postgresql
        volumeMounts:
        - name: postgresql-storage
          mountPath: /var/lib/postgresql/data
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U postgres
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
  volumeClaimTemplates:
  - metadata:
      name: postgresql-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgresql
  namespace: project-unify
spec:
  selector:
    app: postgresql
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
```

Create `k8s/redis.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: project-unify
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - --requirepass
        - $(REDIS_PASSWORD)
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: project-unify-secrets
              key: redis-password
        ports:
        - containerPort: 6379
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: project-unify
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
```

Create `k8s/backend.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
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
        image: project-unify/backend:latest
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: project-unify-config
              key: NODE_ENV
        - name: PORT
          value: "3001"
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
        - name: SENDGRID_API_KEY
          valueFrom:
            secretKeyRef:
              name: project-unify-secrets
              key: sendgrid-key
        - name: FRONTEND_URL
          valueFrom:
            configMapKeyRef:
              name: project-unify-config
              key: FRONTEND_URL
        ports:
        - containerPort: 3001
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
  name: backend
  namespace: project-unify
spec:
  selector:
    app: backend
  ports:
  - port: 80
    targetPort: 3001
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: project-unify
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

Create `k8s/frontend.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
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
        image: project-unify/frontend:latest
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: project-unify
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

Create `k8s/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: project-unify-ingress
  namespace: project-unify
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - yourdomain.com
    - www.yourdomain.com
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
            name: frontend
            port:
              number: 80
  - host: www.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 80
```

### 2.2 Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n project-unify
kubectl get services -n project-unify
kubectl get ingress -n project-unify

# Check logs
kubectl logs -f deployment/backend -n project-unify
kubectl logs -f deployment/frontend -n project-unify

# Scale deployment
kubectl scale deployment backend --replicas=5 -n project-unify
```

### 2.3 Helm Chart (Alternative)

Create `helm/project-unify/Chart.yaml`:

```yaml
apiVersion: v2
name: project-unify
description: A Helm chart for Project UNIFY
type: application
version: 0.1.0
appVersion: "1.0.0"
dependencies:
- name: postgresql
  version: 12.1.2
  repository: https://charts.bitnami.com/bitnami
- name: redis
  version: 17.4.3
  repository: https://charts.bitnami.com/bitnami
```

Create `helm/project-unify/values.yaml`:

```yaml
# Global configuration
global:
  imageRegistry: ""
  imagePullSecrets: []

# Backend configuration
backend:
  replicaCount: 3
  image:
    repository: project-unify/backend
    tag: latest
    pullPolicy: IfNotPresent
  
  service:
    type: ClusterIP
    port: 80
    targetPort: 3001
  
  resources:
    limits:
      cpu: 500m
      memory: 512Mi
    requests:
      cpu: 250m
      memory: 256Mi
  
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80

# Frontend configuration
frontend:
  replicaCount: 2
  image:
    repository: project-unify/frontend
    tag: latest
    pullPolicy: IfNotPresent
  
  service:
    type: ClusterIP
    port: 80
    targetPort: 8080
  
  resources:
    limits:
      cpu: 100m
      memory: 128Mi
    requests:
      cpu: 50m
      memory: 64Mi

# Ingress configuration
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  hosts:
    - host: yourdomain.com
      paths:
        - path: /
          pathType: Prefix
          service: frontend
    - host: api.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
          service: backend
  tls:
    - secretName: project-unify-tls
      hosts:
        - yourdomain.com
        - api.yourdomain.com

# PostgreSQL configuration
postgresql:
  enabled: true
  auth:
    postgresPassword: "your-secure-password"
    database: "project_unify"
  primary:
    persistence:
      enabled: true
      size: 10Gi

# Redis configuration
redis:
  enabled: true
  auth:
    enabled: true
    password: "your-redis-password"
  master:
    persistence:
      enabled: true
      size: 2Gi
```

Deploy with Helm:

```bash
# Add Bitnami repository
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install chart
helm install project-unify ./helm/project-unify -n project-unify --create-namespace

# Upgrade
helm upgrade project-unify ./helm/project-unify -n project-unify
```

## 📊 Monitoring and Logging

### 3.1 Prometheus and Grafana

Create `k8s/monitoring.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: project-unify
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
    scrape_configs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
    - job_name: 'project-unify-backend'
      static_configs:
      - targets: ['backend:80']
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: project-unify
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:latest
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: prometheus-config
          mountPath: /etc/prometheus
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      volumes:
      - name: prometheus-config
        configMap:
          name: prometheus-config
```

### 3.2 Logging with ELK Stack

Create `k8s/logging.yaml`:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
  namespace: project-unify
spec:
  selector:
    matchLabels:
      name: fluentd
  template:
    metadata:
      labels:
        name: fluentd
    spec:
      containers:
      - name: fluentd
        image: fluent/fluentd-kubernetes-daemonset:v1-debian-elasticsearch
        env:
        - name: FLUENT_ELASTICSEARCH_HOST
          value: "elasticsearch"
        - name: FLUENT_ELASTICSEARCH_PORT
          value: "9200"
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        resources:
          limits:
            memory: 200Mi
          requests:
            cpu: 100m
            memory: 200Mi
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

## 🔄 CI/CD with GitOps

Create `.github/workflows/k8s-deploy.yml`:

```yaml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout repository
      uses: actions/checkout@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Build and push Backend image
      uses: docker/build-push-action@v3
      with:
        context: ./backend
        file: ./backend/Dockerfile.prod
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:${{ github.sha }}

    - name: Build and push Frontend image
      uses: docker/build-push-action@v3
      with:
        context: ./frontend
        file: ./frontend/Dockerfile.prod
        push: true
        tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:${{ github.sha }}

    - name: Deploy to Kubernetes
      uses: azure/k8s-deploy@v1
      with:
        manifests: |
          k8s/namespace.yaml
          k8s/secrets.yaml
          k8s/postgresql.yaml
          k8s/redis.yaml
          k8s/backend.yaml
          k8s/frontend.yaml
          k8s/ingress.yaml
        images: |
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:${{ github.sha }}
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:${{ github.sha }}
        kubectl-version: 'latest'
```

## 🔒 Security Best Practices

### Security Checklist

- [ ] Use non-root containers
- [ ] Implement Pod Security Standards
- [ ] Enable Network Policies
- [ ] Use RBAC for service accounts
- [ ] Scan images for vulnerabilities
- [ ] Enable audit logging
- [ ] Use secrets management
- [ ] Implement resource quotas
- [ ] Enable admission controllers

### Network Policies

Create `k8s/network-policies.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-netpol
  namespace: project-unify
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgresql
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

This comprehensive Docker and Kubernetes deployment guide provides production-ready containerized infrastructure for Project UNIFY with high availability, scalability, and security.