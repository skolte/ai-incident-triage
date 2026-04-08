# AI Incident Triage Agent
Agentic AI System Architecture | React + FastAPI + LangGraph

---

# Project Overview

This project implements a **production-style AI incident triage system** designed to demonstrate modern **agentic AI architecture patterns**.

The system accepts ambiguous incident reports (for example service failures, error spikes, or operational alerts), analyzes them using an LLM-powered agent, gathers evidence using operational tools, and produces a **structured incident ticket**.

Unlike traditional AI chat interfaces, the system exposes the internal reasoning process through **real-time streaming observability**, allowing users to see exactly how the agent reasons and which tools it uses.

This project was built to learn and demonstrate:

- Agent orchestration
- Tool-using LLM systems
- Real-time AI observability
- Full-stack AI applications
- Cloud deployment architectures

---

# Core System Capabilities

The system performs the following workflow:

1. Accept incident report from user
2. Start an AI triage run
3. Use an LLM-powered agent to analyze the report
4. Call diagnostic tools to gather evidence
5. Retrieve operational runbooks
6. Perform compliance checks
7. Produce structured incident ticket
8. Stream execution events to the UI in real time

---

# Technology Stack

## Frontend
- React
- Vite
- TypeScript
- Server Sent Events (SSE)

## Backend
- Python
- FastAPI
- LangGraph
- LangChain
- OpenAI API

## Infrastructure
- AWS Amplify (frontend hosting)
- CloudFront (HTTPS edge)
- Application Load Balancer
- ECS Fargate containers

---

# High-Level Architecture
User
│
▼
React UI (Amplify)
│
▼
CloudFront CDN (HTTPS)
│
▼
Application Load Balancer
│
▼
ECS Fargate Container
│
▼
FastAPI Backend
│
▼
LangGraph Agent Runtime
│
▼
Operational Tools
│
▼
Structured Incident Ticket


---

# Backend Architecture

The backend uses a layered architecture.
API Layer
│
▼
Run Store + SSE Streaming
│
▼
Orchestrator
│
▼
Agent Layer
│
▼
Tool Layer

---

# Agent Architecture

Current system uses a **tool-using agent** implemented with LangGraph.

### Current Agent
TriageAgent

Responsibilities:

- interpret incident reports
- gather evidence
- call operational tools
- synthesize findings
- generate structured incident tickets

### Tools Used
log_search
list_runbooks
read_runbook
policy_check

These simulate real operational systems such as:

- log aggregation systems
- incident runbooks
- compliance checks

---

# Event Streaming Architecture

The system streams internal AI execution events using **Server Sent Events (SSE)**.

### Event Types
run_started
agent_started
tool_call
tool_result
agent_completed
final_result
error
heartbeat

### Event Payload

Each event includes:
type
run_id
agent
sequence
timestamp
data

### Example Execution Timeline
run_started
agent_started
tool_call
tool_result
tool_call
tool_result
agent_completed
final_result

These events power the **Execution Trace Panel** in the UI.

---

# Frontend Architecture

The React frontend visualizes the entire AI reasoning process.

Components:


IncidentForm
TracePanel
TicketViewer


Responsibilities:

**IncidentForm**

- collect incident report
- start triage run

**TracePanel**

- display tool calls
- display agent steps
- show execution timeline

**TicketViewer**

- display structured incident ticket

---

# Backend Folder Structure


backend/

app/
agents/
base_agent.py
triage_agent.py

orchestrators/
single_agent_orchestrator.py

tools/
log_tools.py
runbook_tools.py
policy_tools.py

core/
run_store.py
sse.py

schemas/
api.py
events.py
incident.py
state.py

data/
logs.jsonl
runbooks/


---

# Frontend Folder Structure


frontend/

src/
App.tsx
api.ts

components/
IncidentForm.tsx
TracePanel.tsx
TicketViewer.tsx


---

# Example AI Output

Incident Ticket

Title  
Intermittent 502 Errors During Checkout

Severity  
SEV2

Evidence  

- User reports of intermittent 502 errors
- No matching upstream errors in logs

Mitigation Plan  

- Check gateway logs
- inspect upstream services
- review recent deployments
- inspect container health

Confidence  
0.7

---

# Skills Demonstrated

This project demonstrates modern **AI platform engineering skills**:

- Agent architecture design
- Tool-calling LLM systems
- LangGraph orchestration
- FastAPI API development
- React observability dashboards
- Server-Sent Event streaming
- Structured AI outputs
- Cloud-native deployment patterns

Relevant for roles such as:

- AI Platform Engineer
- AI Systems Architect
- LLM Infrastructure Engineer
- AI Solutions Architect

---

# Future Roadmap

## Phase 1 — Multi-Agent Architecture


SupervisorAgent
├── TriageAgent
├── ComplianceAgent
└── SummaryAgent


## Phase 2 — Retrieval-Augmented Generation

Replace runbook lookup with semantic search using embeddings.

## Phase 3 — Observability

Add:

- token usage
- latency metrics
- tool success rate
- run dashboards

## Phase 4 — Persistence

Store:

- run history
- event logs
- incident tickets

## Phase 5 — Production Hardening

Add:

- authentication
- API rate limiting
- model guardrails
- monitoring

---

# Running the System

## Backend


cd backend
python -m venv .venv
pip install -r requirements.txt
uvicorn app.app:app --reload --port 8000


## Frontend


cd frontend
npm install
npm run dev


---

# Learning Outcome

This project demonstrates how to design a **production-style agentic AI system** including:

- AI orchestration
- tool routing
- streaming observability
- full-stack AI architecture
- cloud deployment

It provides a strong foundation for building **advanced AI systems and platforms**.


| Service / Concept                            | Category / Sub-Category          | What does it do?                                                                                           | Why did we use it in this project?                                                                                 |
| -------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Amazon ECS (Elastic Container Service)**   | Compute, Container Orchestration | Managed container orchestration service that runs and manages Docker containers.                           | Used to orchestrate the backend AI Incident Triage service containers and ensure tasks are running reliably.       |
| **AWS Fargate**                              | Compute, Serverless Containers   | Serverless compute engine for containers that removes the need to manage EC2 servers.                      | Used to run ECS tasks without managing infrastructure, allowing the backend AI service to scale automatically.     |
| **Amazon ECR (Elastic Container Registry)**  | Containers, Image Registry       | Secure container image registry for storing Docker images.                                                 | Used to store the backend Docker image and allow ECS to pull and run the container.                                |
| **ECS Cluster**                              | Container Infrastructure         | Logical grouping of compute capacity where ECS tasks run.                                                  | Used to organize and run the triage backend containers.                                                            |
| **ECS Task Definition**                      | Container Configuration          | Blueprint describing container configuration such as image, CPU, memory, environment variables, and ports. | Used to define how the triage backend container should run.                                                        |
| **ECS Task**                                 | Container Runtime                | A running instance of a container based on a task definition.                                              | Represents the running AI triage backend container processing requests.                                            |
| **ECS Service**                              | Container Management             | Ensures a specified number of tasks are always running and integrates with load balancers.                 | Used to keep the backend container continuously running and automatically restart failed tasks.                    |
| **Amazon VPC (Virtual Private Cloud)**       | Networking                       | Provides isolated virtual networking in AWS.                                                               | Used to securely host ECS services, load balancers, and networking resources.                                      |
| **Subnets**                                  | Networking, VPC Components       | Logical subdivisions of a VPC used to control traffic routing.                                             | Used to separate public components like the load balancer from backend container workloads.                        |
| **Security Groups**                          | Networking, Firewall             | Virtual firewall controlling inbound and outbound traffic for AWS resources.                               | Used to allow HTTP traffic to the load balancer and permit communication between ALB and ECS containers.           |
| **Application Load Balancer (ALB)**          | Networking, Load Balancing       | Layer-7 load balancer that distributes HTTP/HTTPS traffic across multiple targets.                         | Used as the public entry point for the triage API and to route traffic to ECS tasks.                               |
| **Target Groups**                            | Load Balancing                   | Logical groups of backend resources that receive traffic from a load balancer.                             | Used to route traffic from the ALB to the ECS container instances running the backend service.                     |
| **Amazon CloudFront**                        | Networking, CDN                  | Global content delivery network that caches and delivers content from edge locations.                      | Used to accelerate frontend delivery and reduce latency for users accessing the system.                            |
| **Amazon API Gateway**                       | API Management                   | Fully managed service for creating, publishing, and securing APIs.                                         | Used as an API front door to expose triage service endpoints in a structured and scalable way.                     |
| **AWS CloudFormation**                       | Infrastructure as Code           | Service for provisioning AWS resources using declarative templates.                                        | Used to deploy the ECS cluster, networking, load balancer, and other infrastructure consistently and reproducibly. |
| **AWS IAM (Identity and Access Management)** | Security                         | Manages permissions and roles for AWS services and users.                                                  | Used to provide ECS task roles, ECR access permissions, and CloudFormation deployment permissions.                 |
| **AWSVPC Network Mode**                      | Container Networking             | Networking mode where each container receives its own elastic network interface within the VPC.            | Used with Fargate to allow containers to communicate securely within the VPC.                                      |
| **Amazon CloudWatch**                        | Monitoring and Observability     | Collects logs, metrics, and monitoring data for AWS resources.                                             | Used to monitor ECS tasks, application logs, and system metrics for the triage service.                            |
| **Docker**                                   | Containerization Platform        | Tool used to package applications and dependencies into containers.                                        | Used to containerize the backend FastAPI service before pushing it to ECR and running it in ECS.                   |
| **Infrastructure as Code (IaC)**             | DevOps Concept                   | Practice of managing infrastructure using code templates rather than manual configuration.                 | Implemented through CloudFormation templates to deploy the entire AI triage infrastructure automatically.          |
