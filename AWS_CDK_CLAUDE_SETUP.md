# AWS CDK & Claude Integration Setup Guide

**Purpose:** Enable Claude Code to directly create, update, and terminate AWS services using AWS CLI and CDK.

---

## 1. Prerequisites

- AWS Account with sufficient permissions
- AWS CLI v2 installed (`aws --version`)
- Node.js and npm installed (`node --version`, `npm --version`)
- Claude Code CLI installed
- Git (already installed)

---

## 2. AWS Credentials Setup

### 2.1 Create IAM User for Claude (Recommended)

Instead of using root credentials, create a dedicated IAM user:

```bash
# Create IAM user via AWS Console or CLI
aws iam create-user --user-name claude-ai-infra

# Create access key
aws iam create-access-key --user-name claude-ai-infra
```

**Output:**
```json
{
  "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",
  "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
}
```

Save these securely!

### 2.2 Attach Policies to IAM User

```bash
# Full EC2, ECS, CloudFormation, and ECR permissions
aws iam attach-user-policy \
  --user-name claude-ai-infra \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# OR more restrictive approach (Recommended for security):
# - EC2FullAccess
# - AmazonECS_FullAccess
# - AmazonEC2ContainerRegistryFullAccess
# - CloudFormationFullAccess
# - IAMFullAccess
```

### 2.3 Configure AWS Profile

**Option A: Interactive Configuration**
```bash
aws configure --profile claude-ai

# Prompts:
# AWS Access Key ID: AKIAIOSFODNN7EXAMPLE
# AWS Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
# Default region name: us-east-1
# Default output format: json
```

**Option B: Manual Configuration**

Edit `~/.aws/credentials`:
```ini
[claude-ai]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

Edit `~/.aws/config`:
```ini
[profile claude-ai]
region = us-east-1
output = json
```

### 2.4 Verify Configuration

```bash
# Test credentials
aws s3 ls --profile claude-ai

# Get account ID
aws sts get-caller-identity --profile claude-ai

# Output should show:
# {
#     "UserId": "AIDAI...",
#     "Account": "123456789012",
#     "Arn": "arn:aws:iam::123456789012:user/claude-ai-infra"
# }
```

---

## 3. AWS CDK Setup

### 3.1 Install AWS CDK Globally

```bash
npm install -g aws-cdk

# Verify installation
cdk --version
```

### 3.2 Initialize CDK Project in Repository

```bash
cd /path/to/ai-incident-triage

# Create CDK TypeScript project
cdk init app --language typescript

# This creates:
# - lib/
# - bin/
# - cdk.json
# - tsconfig.json
# - package.json (updated)
```

Or add to existing project:
```bash
mkdir cdk
cd cdk

cdk init app --language typescript --no-git
```

### 3.3 Install CDK Dependencies

```bash
cd cdk  # if you created separate directory

npm install
```

---

## 4. Configure Claude Code to Use AWS CLI & CDK

### 4.1 Update Claude Code Settings

Create/update `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Write",
      "Edit",
      "Bash(aws *)",
      "Bash(cdk *)",
      "Bash(git *)",
      "Bash(npm *)",
      "Bash(npx *)"
    ],
    "deny": [
      "Bash(aws iam delete*)",
      "Bash(aws iam remove*)",
      "Bash(cdk destroy --force)"
    ]
  },
  "env": {
    "AWS_PROFILE": "claude-ai",
    "AWS_REGION": "us-east-1"
  }
}
```

### 4.2 Set Environment Variables Globally

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, or `~/.profile`):

```bash
export AWS_PROFILE=claude-ai
export AWS_REGION=us-east-1
```

Then reload:
```bash
source ~/.bashrc  # or ~/.zshrc
```

---

## 5. Example CDK Stack for AI Incident Triage

Create `cdk/lib/ai-incident-stack.ts`:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';

export class AiIncidentStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'AiIncidentVpc', {
      cidrMask: 24,
      maxAzs: 2,
      natGateways: 0,
    });

    // ECR Repository
    const repository = new ecr.Repository(this, 'AiIncidentRepo', {
      repositoryName: 'ai-incident-backend',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'AiIncidentCluster', {
      vpc: vpc,
      clusterName: 'ai-incident-cluster',
    });

    // CloudWatch Logs
    const logGroup = new logs.LogGroup(this, 'AiIncidentLogs', {
      logGroupName: '/ecs/ai-incident',
      retentionInDays: 14,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Fargate Task Definition
    const taskDef = new ecs.FargateTaskDefinition(this, 'AiIncidentTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
    });

    taskDef.addContainer('api', {
      image: ecs.ContainerImage.fromEcrRepository(repository, 'latest'),
      containerPort: 8000,
      environment: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        ALLOWED_ORIGINS: 'http://localhost:5173,https://your-amplify-domain.com',
      },
      logging: ecs.LogDriver.awsLogs({
        logGroup: logGroup,
        streamPrefix: 'ecs',
      }),
    });

    // ECS Service
    const service = new ecs.FargateService(this, 'AiIncidentService', {
      cluster: cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      serviceName: 'ai-incident-service',
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'AiIncidentALB', {
      vpc: vpc,
      internetFacing: true,
      loadBalancerName: 'ai-incident-alb',
    });

    const listener = alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    listener.addTargets('AiIncidentTargets', {
      port: 8000,
      targets: [service],
      healthCheck: {
        path: '/healthz',
        interval: cdk.Duration.seconds(10),
        timeout: cdk.Duration.seconds(5),
      },
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'ALB DNS Name',
    });

    new cdk.CfnOutput(this, 'ECRRepositoryURI', {
      value: repository.repositoryUri,
      description: 'ECR Repository URI',
    });
  }
}
```

Create `cdk/bin/ai-incident.ts`:

```typescript
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AiIncidentStack } from '../lib/ai-incident-stack';

const app = new cdk.App();

new AiIncidentStack(app, 'AiIncidentStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

app.synth();
```

---

## 6. CDK Commands for Claude

### Basic Commands

```bash
# Bootstrap CDK (one-time setup per AWS account/region)
cdk bootstrap

# Synthesize CloudFormation template
cdk synth

# List stacks
cdk list

# Show what will be created/changed
cdk diff

# Deploy stack
cdk deploy

# Deploy without approval prompt
cdk deploy --require-approval never

# Delete stack
cdk destroy

# Get stack outputs
cdk output
```

### Real-World Examples

**Scale ECS service to 3 instances:**
```bash
# Using AWS CLI
aws ecs update-service \
  --cluster ai-incident-cluster \
  --service ai-incident-service \
  --desired-count 3 \
  --profile claude-ai
```

**Update container image:**
```bash
# Push new image to ECR
aws ecr get-login-password --region us-east-1 --profile claude-ai | \
  docker login --username AWS --password-stdin <ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com

docker build -t ai-incident-backend:v2 backend/
docker tag ai-incident-backend:v2 <ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/ai-incident-backend:v2
docker push <ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/ai-incident-backend:v2

# Update ECS service
aws ecs update-service \
  --cluster ai-incident-cluster \
  --service ai-incident-service \
  --force-new-deployment \
  --profile claude-ai
```

**Create CloudFront distribution:**
```bash
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json \
  --profile claude-ai
```

---

## 7. Security Best Practices

### 7.1 Restrict IAM Policy

Instead of `AdministratorAccess`, create a custom policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "ecs:*",
        "ecr:*",
        "elasticloadbalancing:*",
        "cloudformation:*",
        "logs:*",
        "iam:GetRole",
        "iam:PassRole",
        "iam:CreateRole",
        "iam:PutRolePolicy"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Deny",
      "Action": [
        "iam:DeleteUser",
        "iam:DeleteRole",
        "iam:DeletePolicy",
        "iam:DeleteAccessKey"
      ],
      "Resource": "*"
    }
  ]
}
```

### 7.2 Enable MFA

```bash
# Configure MFA for IAM user (recommended)
aws iam enable-mfa-device \
  --user-name claude-ai-infra \
  --serial-number arn:aws:iam::ACCOUNT:mfa/claude-ai
```

### 7.3 Rotate Access Keys

```bash
# Create new access key
aws iam create-access-key --user-name claude-ai-infra

# Deactivate old key
aws iam update-access-key \
  --user-name claude-ai-infra \
  --access-key-id AKIAIOSFODNN7EXAMPLE \
  --status Inactive

# Delete old key (after 90 days)
aws iam delete-access-key \
  --user-name claude-ai-infra \
  --access-key-id AKIAIOSFODNN7EXAMPLE
```

### 7.4 CloudTrail Logging

```bash
# Enable CloudTrail to audit all Claude-initiated AWS actions
aws cloudtrail create-trail \
  --name claude-ai-audit \
  --s3-bucket-name claude-ai-audit-logs
```

---

## 8. Claude Commands for AWS Management

Once configured, you can ask Claude:

**Examples:**

```
"Scale the ECS service to 5 instances"
→ Claude runs: aws ecs update-service --cluster ai-incident-cluster --service ai-incident-service --desired-count 5 --profile claude-ai

"Check the ALB health status"
→ Claude runs: aws elbv2 describe-target-health --target-group-arn <ARN>

"Update the ECR image and redeploy"
→ Claude orchestrates: docker build, push, and ECS update

"Create a new Lambda function to process incidents"
→ Claude uses CDK to define and deploy Lambda

"Show me the current stack status"
→ Claude runs: cdk list, cdk diff, aws cloudformation describe-stacks
```

---

## 9. Troubleshooting

### Issue: "Unable to locate credentials"

```bash
# Check credentials file
cat ~/.aws/credentials

# Check config file
cat ~/.aws/config

# Verify profile is set
echo $AWS_PROFILE

# Set profile explicitly
export AWS_PROFILE=claude-ai
```

### Issue: "Access Denied" errors

```bash
# Check permissions
aws iam list-attached-user-policies --user-name claude-ai-infra

# Check specific policy
aws iam get-user-policy --user-name claude-ai-infra --policy-name <PolicyName>
```

### Issue: CDK Bootstrap Fails

```bash
# CDK needs bootstrap per account/region
cdk bootstrap aws://ACCOUNT/REGION

# Example
cdk bootstrap aws://123456789012/us-east-1
```

### Issue: Claude Can't Run AWS Commands

```bash
# Check .claude/settings.json has correct permissions
cat .claude/settings.json

# Verify AWS_PROFILE env var is set
echo $AWS_PROFILE

# Test AWS CLI directly
aws sts get-caller-identity --profile claude-ai
```

---

## 10. Integration with CI/CD

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy with CDK

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Deploy with CDK
        run: |
          npm install -g aws-cdk
          cd cdk
          npm install
          cdk deploy --require-approval never
```

---

## 11. Recommended Workflow

1. **Define infrastructure in CDK** (TypeScript/Python)
2. **Test locally:** `cdk synth` → review CloudFormation
3. **Stage changes:** `cdk diff` → verify modifications
4. **Deploy:** `cdk deploy` → push to AWS
5. **Monitor:** `cdk output` → get resource details
6. **Update:** Ask Claude to make changes → Claude uses AWS CLI/CDK

---

## 12. Quick Reference

| Task | Command |
|------|---------|
| List AWS profiles | `cat ~/.aws/credentials` |
| Test credentials | `aws sts get-caller-identity --profile claude-ai` |
| Bootstrap CDK | `cdk bootstrap` |
| Synth template | `cdk synth` |
| View changes | `cdk diff` |
| Deploy stack | `cdk deploy` |
| Delete stack | `cdk destroy` |
| Scale ECS | `aws ecs update-service --desired-count N` |
| View logs | `aws logs tail /ecs/ai-incident --follow` |
| List stacks | `aws cloudformation list-stacks` |

---

## 13. Environment Variables for Claude

Add to `.claude/settings.json` or `.claude/settings.local.json`:

```json
{
  "env": {
    "AWS_PROFILE": "claude-ai",
    "AWS_REGION": "us-east-1",
    "AWS_ACCOUNT_ID": "123456789012",
    "CDK_DEFAULT_ACCOUNT": "123456789012",
    "CDK_DEFAULT_REGION": "us-east-1"
  }
}
```

---

## 14. Next Steps

1. ✅ Create IAM user and get credentials
2. ✅ Configure AWS CLI profile (`aws configure --profile claude-ai`)
3. ✅ Test credentials (`aws sts get-caller-identity --profile claude-ai`)
4. ✅ Install AWS CDK (`npm install -g aws-cdk`)
5. ✅ Initialize CDK project in repository (`cdk init app`)
6. ✅ Update `.claude/settings.json` with permissions and env vars
7. ✅ Start using Claude to manage AWS infrastructure

---

## 15. References

- [AWS CLI Documentation](https://docs.aws.amazon.com/cli/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [CDK TypeScript Reference](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib-readme.html)

---

**Last Updated:** 2026-06-26  
**Author:** Sandeep Kolte  
**Status:** Ready for implementation
