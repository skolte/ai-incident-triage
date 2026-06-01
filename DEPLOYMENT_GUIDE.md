# Deployment Guide: ECS to App Runner Migration

## Overview

This guide walks you through migrating ai-incident-triage from expensive ECS/ALB/VPC infrastructure (~$73/month) to serverless App Runner (~$3.50/month).

**Savings: ~$67-70/month (90%+ reduction), same full functionality.**

---

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Docker image pushed to ECR: `ai-incident-backend` repository
3. OpenAI API key available
4. Current Amplify app ID and domain (for CORS configuration)

---

## Step 1: Deploy App Runner

Replace the values below and run:

```bash
# Get your ECR image URI (find latest tag)
ECR_IMAGE_URI=$(aws ecr describe-images \
  --repository-name ai-incident-backend \
  --query 'sort_by(imageDetails,&imagePushedAt)[-1].imageUri' \
  --output text)

echo "Using image: $ECR_IMAGE_URI"

# Deploy the App Runner service via CloudFormation
aws cloudformation deploy \
  --template-file backend/apprunner-deploy.yaml \
  --stack-name ai-incident-apprunner \
  --parameter-overrides \
    ContainerImage=$ECR_IMAGE_URI \
    OpenAIAPIKey=<YOUR_OPENAI_API_KEY> \
    AllowedOrigins='https://main.dlvx8idi4h2r9.amplifyapp.com' \
    LangchainApiKey='<OPTIONAL_LANGSMITH_KEY>' \
  --capabilities CAPABILITY_NAMED_IAM
```

Wait 3-5 minutes for the service to reach "RUNNING" status.

---

## Step 2: Get App Runner URL

```bash
# Extract the service URL
SERVICE_ARN=$(aws cloudformation describe-stacks \
  --stack-name ai-incident-apprunner \
  --query 'Stacks[0].Outputs[?OutputKey==`ServiceArn`].OutputValue' \
  --output text)

APP_RUNNER_URL=$(aws apprunner describe-service \
  --service-arn $SERVICE_ARN \
  --query 'Service.ServiceUrl' \
  --output text)

echo "App Runner URL: $APP_RUNNER_URL"
```

**Note:** App Runner provides HTTPS automatically. The URL will be `https://<random-id>.awsapprunner.com`.

---

## Step 3: Verify App Runner is Healthy

```bash
# Health check
curl -I https://<app-runner-url>/healthz
# Should return HTTP 200
```

---

## Step 4: Test the Backend Directly (Optional)

```bash
# Submit a test incident
curl -X POST https://<app-runner-url>/api/triage \
  -H 'Content-Type: application/json' \
  -d '{"incident_text":"Database connection timeout"}'

# You'll get back: {"run_id": "..."}
# This verifies the backend is working.
```

---

## Step 5: Update Amplify Environment Variables

1. **Open AWS Amplify Console**
2. **Select app:** ai-incident-triage
3. **Go to:** App settings → Environment variables
4. **Update or create:**
   - Key: `VITE_API_BASE_URL`
   - Value: `https://<app-runner-url>` (from Step 2)
5. **Save** and trigger a redeploy

---

## Step 6: Redeploy Amplify Frontend

1. **In Amplify Console**, go to **Deployments**
2. **Click** "Redeploy this version" on the latest commit
3. **Wait** 2-3 minutes for the build to complete

Alternatively, push a commit to trigger auto-redeploy:
```bash
git commit --allow-empty -m "Redeploy with App Runner backend"
git push
```

---

## Step 7: Test the Full Demo

1. **Open** the Amplify frontend URL: `https://main.dlvx8idi4h2r9.amplifyapp.com`
2. **Submit an incident:**
   - Use one of the quick scenarios or free-form text
3. **Verify the pipeline:**
   - See "Incident Input" → 3 agent nodes → "Operational Tools" → "Incident Ticket"
   - Watch the agents run in real-time (SSE events streaming)
   - Final ticket should render with severity, root cause, mitigation plan
4. **Check the trace panel** — should show all tool calls and results

---

## Step 8: Delete the Old ECS/ALB/VPC Stack

Once you've verified the App Runner deployment works:

```bash
# DELETE THE OLD STACK (this is irreversible, be sure!)
aws cloudformation delete-stack --stack-name ai-incident-full-stack

# Monitor deletion
aws cloudformation wait stack-delete-complete --stack-name ai-incident-full-stack
```

**What gets deleted:**
- VPC (10.20.0.0/16)
- ECS Cluster, Service, Task Definition
- Application Load Balancer, Target Group
- Security Groups, Internet Gateway
- Public Subnets, Route Tables
- CloudWatch Log Group (`/ecs/ai-incident`)
- IAM Execution Role

**What stays:**
- ECR repository (`ai-incident-backend`) — still needed for App Runner
- Amplify app
- CloudFormation stack `ai-incident-apprunner`

---

## Step 9: Verify Cost Reduction

Check AWS Billing Dashboard (Billing & Cost Management):

- **Before migration:** ~$73/month for ai-incident-triage
- **After migration:** ~$5.54/month (App Runner + Amplify + ECR)

Changes appear in the next billing cycle. Use Cost Explorer filters by resource type or tags to confirm.

---

## Rollback Plan (If Something Goes Wrong)

If the frontend can't reach the backend:

1. **Check Amplify environment variable** — verify `VITE_API_BASE_URL` is set to the correct App Runner URL
2. **Check App Runner service status** — `aws apprunner describe-service --service-arn <arn>`
3. **Check Amplify frontend build logs** — did the frontend redeploy successfully?
4. **Revert Amplify:** Redeploy the previous commit (uses the old ALB URL)
5. **Keep old stack:** Don't delete `ai-incident-full-stack` until you're 100% confident

If you need to restore the old stack (before deletion completes):

```bash
aws cloudformation cancel-update-stack --stack-name ai-incident-full-stack
```

---

## Troubleshooting

### Problem: "Connection refused" or "503 Service Unavailable"

**Solution:**
1. Wait a few minutes (App Runner might still be deploying)
2. Check service status: `aws apprunner describe-service --service-arn <arn>`
3. Check logs in App Runner console → Logs tab

### Problem: Frontend shows "API not reachable"

**Solution:**
1. Verify Amplify has the correct `VITE_API_BASE_URL` env var
2. Check if Amplify did a full redeploy (not cached)
3. Clear browser cache and refresh

### Problem: CORS errors in browser console

**Solution:**
1. Check `AllowedOrigins` parameter matches your Amplify domain exactly
2. Re-deploy the App Runner stack with corrected origins
3. Hard refresh the frontend

### Problem: App Runner service won't start

**Solution:**
1. Check ECR image exists and is accessible
2. Verify `ContainerImage` parameter uses correct URI format
3. Check IAM role has `AWSAppRunnerServicePolicyForECRAccess`
4. View CloudFormation events for detailed error messages

---

## Cost Comparison

| Service | Old (ECS) | New (App Runner) | Saved |
|---------|-----------|------------------|-------|
| ECS Fargate | $17.93 | $0 | $17.93 |
| ALB | $16.34 | $0 | $16.34 |
| VPC/IPs | $21.76 | $0 | $21.76 |
| EBS | $15.68 | $0 | $15.68 |
| App Runner | $0 | $3.50 | — |
| Amplify | $1.54 | $1.54 | $0 |
| ECR | $0.50 | $0.50 | $0 |
| **Monthly Total** | **~$73** | **~$5.54** | **~$67/month** |

---

## What Changed (Technical Summary)

### Deployment
- **Old:** CloudFormation manages VPC, ECS cluster/service, ALB, security groups
- **New:** CloudFormation manages only App Runner service, auto-scaling config, IAM role

### Runtime
- **Old:** Python FastAPI in ECS Fargate task (512 mCPU, 1GB RAM)
- **New:** Same Python FastAPI in App Runner container (0.5 CPU, 1GB RAM)

### Networking
- **Old:** Behind ALB, exposed via ALB DNS name (HTTP), CORS controlled by ALB
- **New:** Direct HTTPS endpoint from App Runner, CORS controlled by env var

### State
- **Old:** In-memory state in ECS task, lost on task restart
- **New:** In-memory state in App Runner instance, lost on instance restart
  - **No change in behavior** — both are ephemeral demos

### SSE Streaming
- **Old:** ALB → ECS task (HTTP)
- **New:** App Runner (HTTPS with 300s timeout)
  - **No change in behavior** — agents complete in <2 minutes

---

## Monitoring & Alerts

Set up cost alerts to catch unexpected spikes:

```bash
# Create a budget alert (optional)
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json
```

Monitor via AWS Cost Explorer:
- Filter by service: App Runner, Amplify, ECR
- Check monthly estimate vs. forecast

---

## Questions?

- **App Runner docs:** https://docs.aws.amazon.com/apprunner/
- **CloudFormation reference:** https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apprunner-service.html
- **Cost breakdown:** AWS Billing & Cost Management console
