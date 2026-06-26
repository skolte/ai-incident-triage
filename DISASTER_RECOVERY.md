# AI Incident Triage - Disaster Recovery & Infrastructure Documentation

**Created:** 2026-06-25  
**Purpose:** Complete documentation of all AWS infrastructure, services, and recovery procedures. Use this guide to revive the entire system on a new machine or account.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      User                               │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│           AWS CloudFront + Amplify (Frontend)           │
│  - React frontend (Vite, TypeScript)                    │
│  - Amplify App: ai-incident-triage-prod                 │
│  - CloudFront CDN (global distribution)                 │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│         Application Load Balancer (ALB)                 │
│  - Protocol: HTTP (port 80)                             │
│  - Health check: /healthz (10s interval)                │
│  - Load balancing across 2 AZs                          │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│         ECS Fargate Cluster (Backend)                   │
│  - Container: FastAPI + LangGraph Agent                 │
│  - Fargate launch type (serverless)                     │
│  - VPC with public subnets in 2 AZs                     │
│  - CloudWatch Logs for monitoring                       │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│         ECR (Elastic Container Registry)                │
│  - Docker image repository                              │
│  - Backend container images                             │
└─────────────────────────────────────────────────────────┘
```

---

## 2. AWS Services Summary

| Service | Usage | Configuration |
|---------|-------|---------------|
| **VPC** | Isolated network | CIDR: 10.20.0.0/16 |
| **Public Subnets (2x)** | ALB and ECS tasks | 10.20.1.0/24 (AZ-a), 10.20.2.0/24 (AZ-b) |
| **Internet Gateway** | Public internet access | Attached to VPC |
| **Security Groups (2x)** | Network firewall | ALB-SG (port 80), ECS-SG (port 8000) |
| **Application Load Balancer** | Traffic distribution | HTTP port 80, health checks on /healthz |
| **Target Group** | ECS task routing | IP-based, HTTP 8000, 10s health check |
| **ECS Cluster** | Container orchestration | Name: `ai-incident-cluster` |
| **ECS Task Definition** | Container blueprint | Family: `ai-incident-backend`, Fargate |
| **ECS Service** | Always-running tasks | Desired count: 1 (configurable) |
| **ECR Repository** | Docker image storage | Private repository |
| **CloudWatch Logs** | Application logs | Log group: `/ecs/ai-incident` (14-day retention) |
| **Amplify** | Frontend hosting | App: `ai-incident-triage-prod` |
| **CloudFront** | CDN for frontend | Auto-provisioned by Amplify |
| **CloudFormation** | Infrastructure as Code | Template: `ai-incident-full-stack.yaml` |
| **IAM Roles** | Service permissions | ECS task execution role |

---

## 3. Resource Details & IDs

### CloudFormation Stack
- **Stack Name:** `ai-incident` (or custom name)
- **Template:** `backend/ai-incident-full-stack.yaml`
- **Parameters:**
  - ProjectName: `ai-incident`
  - ContainerImage: `<AWS_ACCOUNT>.dkr.ecr.<REGION>.amazonaws.com/ai-incident-backend:latest`
  - OpenAIAPIKey: `sk-...` (from .env)
  - AllowedOrigins: `http://localhost:5173,https://main.dlvx8idi4h2r9.amplifyapp.com`
  - ContainerPort: `8000`
  - DesiredCount: `1`
  - Cpu: `512`
  - Memory: `1024`

### Key Resource Names (from CloudFormation)
- **VPC:** `ai-incident-vpc`
- **Public Subnets:** `ai-incident-public-a`, `ai-incident-public-b`
- **Internet Gateway:** `ai-incident-igw`
- **Route Table:** `ai-incident-public-rt`
- **ALB Security Group:** `ai-incident-alb-sg`
- **ECS Security Group:** `ai-incident-ecs-sg`
- **ALB:** `ai-incident-alb`
- **Target Group:** `ai-incident-tg`
- **ECS Cluster:** `ai-incident-cluster`
- **ECS Task Definition:** `ai-incident-backend`
- **ECS Service:** `ai-incident-service`
- **CloudWatch Log Group:** `/ecs/ai-incident`
- **IAM Execution Role:** `ai-incident-ecs-exec-role`

### Amplify Frontend
- **App Name:** `ai-incident-triage-prod`
- **Build Config:** `amplify.yml` (builds frontend/dist)
- **Default Domain:** `https://main.dlvx8idi4h2r9.amplifyapp.com`
- **CloudFront Distribution:** Auto-created

---

## 4. Environment Variables

### Backend (backend/.env or ECS Task Definition)
```
OPENAI_API_KEY=sk-...                    # Required: OpenAI API key
LANGCHAIN_TRACING_V2=true               # Optional: LangSmith tracing
LANGCHAIN_API_KEY=ls-...                # Optional: LangSmith API key
LANGCHAIN_PROJECT=ai-incident-triage    # LangSmith project name
ALLOWED_ORIGINS=http://localhost:5173,https://main.dlvx8idi4h2r9.amplifyapp.com
```

### Frontend (frontend/.env)
```
VITE_API_BASE_URL=http://<ALB_DNS>      # ALB endpoint (or custom domain)
```

---

## 5. Deployment Procedures

### 5.1 Deploy Backend to AWS

#### Prerequisites
- AWS CLI configured with credentials
- Docker installed locally
- ECR repository created
- CloudFormation permissions

#### Steps

**1. Build and push Docker image to ECR**
```bash
cd backend

# Authenticate Docker with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <AWS_ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t ai-incident-backend:latest .

# Tag for ECR
docker tag ai-incident-backend:latest \
  <AWS_ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/ai-incident-backend:latest

# Push to ECR
docker push <AWS_ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/ai-incident-backend:latest
```

**2. Deploy/Update CloudFormation Stack**
```bash
# First time deployment
aws cloudformation create-stack \
  --stack-name ai-incident \
  --template-body file://backend/ai-incident-full-stack.yaml \
  --parameters \
    ParameterKey=ProjectName,ParameterValue=ai-incident \
    ParameterKey=ContainerImage,ParameterValue=<AWS_ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/ai-incident-backend:latest \
    ParameterKey=OpenAIAPIKey,ParameterValue=sk-... \
    ParameterKey=AllowedOrigins,ParameterValue=http://localhost:5173,https://main.dlvx8idi4h2r9.amplifyapp.com \
    ParameterKey=ContainerPort,ParameterValue=8000 \
    ParameterKey=DesiredCount,ParameterValue=1 \
    ParameterKey=Cpu,ParameterValue=512 \
    ParameterKey=Memory,ParameterValue=1024 \
  --region us-east-1

# Update existing stack
aws cloudformation update-stack \
  --stack-name ai-incident \
  --template-body file://backend/ai-incident-full-stack.yaml \
  --parameters \
    ParameterKey=ProjectName,UsePreviousValue=true \
    ParameterKey=ContainerImage,ParameterValue=<AWS_ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/ai-incident-backend:latest \
    ... [other parameters]
  --region us-east-1

# Monitor stack creation
aws cloudformation wait stack-create-complete --stack-name ai-incident --region us-east-1
aws cloudformation describe-stacks --stack-name ai-incident --region us-east-1
```

**3. Get ALB DNS name**
```bash
aws cloudformation describe-stacks \
  --stack-name ai-incident \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text \
  --region us-east-1
```

### 5.2 Deploy Frontend to Amplify

#### Prerequisites
- GitHub repo connected to Amplify
- Amplify app created

#### Steps

**1. Push code to GitHub**
```bash
git push origin main
```

**2. Trigger Amplify deployment**
Amplify auto-triggers on push to main branch (if configured).

Or manually via CLI:
```bash
# List apps
aws amplify list-apps --region us-east-1

# Start deployment
aws amplify start-deployment \
  --app-id <APP_ID> \
  --branch-name main \
  --source-url https://github.com/skolte/ai-incident-triage \
  --region us-east-1
```

**3. Update environment variable in Amplify**
```bash
aws amplify update-app \
  --app-id <APP_ID> \
  --environment-variables VITE_API_BASE_URL=<ALB_DNS_OR_CUSTOM_DOMAIN> \
  --region us-east-1
```

---

## 6. Monitoring & Logs

### CloudWatch Logs
```bash
# View recent logs
aws logs tail /ecs/ai-incident --follow --region us-east-1

# Get last 100 log events
aws logs get-log-events \
  --log-group-name /ecs/ai-incident \
  --log-stream-name ecs/api/xxx \
  --region us-east-1
```

### ECS Task Status
```bash
# List running tasks
aws ecs list-tasks \
  --cluster ai-incident-cluster \
  --region us-east-1

# Describe task
aws ecs describe-tasks \
  --cluster ai-incident-cluster \
  --tasks <TASK_ARN> \
  --region us-east-1
```

### ALB Health Check
```bash
# Get target group health
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN> \
  --region us-east-1
```

---

## 7. Shutdown Procedures

### 7.1 Scale Down ECS Service (no deletion)
```bash
aws ecs update-service \
  --cluster ai-incident-cluster \
  --service ai-incident-service \
  --desired-count 0 \
  --region us-east-1
```

### 7.2 Delete CloudFormation Stack
```bash
# This deletes: VPC, Subnets, ECS Cluster, Service, ALB, SecurityGroups, IAM Role, CloudWatch LogGroup
aws cloudformation delete-stack \
  --stack-name ai-incident \
  --region us-east-1

# Monitor deletion
aws cloudformation wait stack-delete-complete --stack-name ai-incident --region us-east-1
```

### 7.3 Delete ECR Repository
```bash
# Delete repository (removes all images)
aws ecr delete-repository \
  --repository-name ai-incident-backend \
  --force \
  --region us-east-1
```

### 7.4 Delete Amplify App
```bash
# Get app ID
aws amplify list-apps --region us-east-1

# Delete app
aws amplify delete-app \
  --app-id <APP_ID> \
  --region us-east-1
```

### 7.5 Delete CloudWatch Logs (if stack deletion doesn't remove them)
```bash
aws logs delete-log-group \
  --log-group-name /ecs/ai-incident \
  --region us-east-1
```

---

## 8. Cost Breakdown (Monthly ~$100)

| Service | Cost | Notes |
|---------|------|-------|
| ECS Fargate | ~$30 | 512 CPU + 1024 MB RAM, 24/7 |
| ALB | ~$16 | Fixed charge + data processing |
| NAT Gateway* | ~$32 | Data processing charges (if applicable) |
| Data Transfer | ~$10 | Inter-AZ and outbound traffic |
| CloudWatch Logs | ~$5 | Log storage and ingestion |
| Amplify | ~$5 | Hosting and build minutes |
| **Total** | **~$98** | *May vary based on actual usage |

**Cost Optimization:**
- Remove NAT Gateway if not needed
- Use Reserved Instances for cost savings
- Set up auto-scaling to zero during off-hours

---

## 9. Key Files & Locations

| Purpose | File Path | Description |
|---------|-----------|-------------|
| IaC Template | `backend/ai-incident-full-stack.yaml` | CloudFormation template for entire stack |
| Docker Image | `backend/Dockerfile` | Backend container definition |
| Frontend Build | `amplify.yml` | Amplify build configuration |
| Backend Config | `backend/.env` | Environment variables (never commit secrets!) |
| Frontend Config | `frontend/.env` | Frontend environment variables |
| Dependencies | `backend/requirements.txt` | Python dependencies |
| Dependencies | `frontend/package.json` | Node.js dependencies |
| Entry Point | `backend/app/app.py` | FastAPI application |

---

## 10. Emergency Recovery Checklist

### If AWS Infrastructure is Lost

- [ ] Clone GitHub repo: `git clone https://github.com/skolte/ai-incident-triage.git`
- [ ] Create ECR repository (if needed)
- [ ] Set up environment variables (OpenAI API key, etc.)
- [ ] Build and push Docker image to ECR
- [ ] Create CloudFormation stack (see section 5.1)
- [ ] Verify ALB is healthy
- [ ] Get ALB DNS name
- [ ] Update Amplify environment variables with ALB DNS
- [ ] Test frontend → backend connectivity
- [ ] Monitor CloudWatch logs

### If Code/Local Repository is Lost

- [ ] This document is in GitHub
- [ ] Clone from: `git clone https://github.com/skolte/ai-incident-triage.git`
- [ ] All source code is version controlled
- [ ] CloudFormation template is in repo
- [ ] Docker image is in ECR (latest image tagged)

---

## 11. Important Credentials & Keys

**IMPORTANT:** Do NOT commit these to GitHub. Keep in secure vault:
- AWS Access Key ID
- AWS Secret Access Key
- OpenAI API Key: `sk-...`
- LangChain API Key (if using): `ls-...`
- GitHub PAT (if needed for deployment)
- Amplify webhook tokens

---

## 12. Architecture Decisions & Tradeoffs

### Why Fargate?
- No EC2 instance management
- Automatic scaling
- Pay only for running time
- Serverless approach

### Why ALB (not API Gateway)?
- Lower latency
- Better for Server-Sent Events (SSE)
- Direct VPC integration
- Simpler for non-REST APIs

### Why Public Subnets?
- Fargate tasks need public IPs for outbound
- Could optimize with NAT Gateway later
- Current setup simpler for development

### Why 2 AZs?
- High availability
- ALB requires multi-AZ
- Fault tolerance

---

## 13. Contacts & References

- **Repository:** https://github.com/skolte/ai-incident-triage
- **AWS Account:** [INSERT YOUR AWS ACCOUNT ID]
- **Region:** us-east-1
- **Owner:** Sandeep Kolte
- **Email:** sandeep@neevronil.org

---

## 14. Change Log

| Date | Change | Details |
|------|--------|---------|
| 2026-06-25 | Initial DR Doc | Created comprehensive disaster recovery guide |

---

**Last Updated:** 2026-06-25  
**Review Frequency:** Update after any infrastructure changes
