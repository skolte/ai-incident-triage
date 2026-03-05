
# Incident Triage Agent (React + FastAPI + LangGraph)

## Overview
This project is a full-stack AI agent system that analyzes ambiguous incident reports and produces structured incident tickets while streaming the internal reasoning process to the UI.

The system demonstrates modern **agentic AI architecture**, including tool usage, orchestration, observability, and real-time execution traces.

---

# Architecture

Frontend:
React (Vite + TypeScript)

Backend:
FastAPI + LangGraph

Agent Layer:
TriageAgent with tool orchestration

Tools:
- log_search
- list_runbooks
- read_runbook
- policy_check

Streaming:
Server Sent Events (SSE)

Deployment Target:
AWS Amplify (frontend) + ECS Fargate behind ALB (backend)

---

# System Flow

User Input (React UI)
        |
        v
POST /api/triage
        |
        v
FastAPI Backend
        |
        v
LangGraph Agent
        |
        v
Tool Calls (logs, runbooks, policy)
        |
        v
Structured Incident Ticket
        |
        v
SSE Stream → React Trace Panel

---

# Implemented AI Concepts

Agent Reasoning Loop

Tool Calling

Structured LLM Outputs

Observability and Execution Trace

Event Streaming Architecture

Multi-Agent Ready Design

---

# Folder Structure

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

frontend/

src/
    App.tsx
    api.ts
    components/
        IncidentForm.tsx
        TracePanel.tsx
        TicketViewer.tsx

---

# Streaming Event Model

Events streamed to frontend:

run_started
agent_started
tool_call
tool_result
agent_completed
final_result
error
heartbeat

Each event contains:

type
run_id
agent
sequence
timestamp
data

---

# Example Event Timeline

run_started
agent_started
tool_call
tool_result
agent_completed
final_result

---

# Example Output

Incident Ticket:

Title:
Intermittent 502 Errors During Checkout

Severity:
SEV2

Evidence:
User reports of intermittent 502 errors

Mitigation:
Check gateway logs
Inspect upstream services

---

# Skills Demonstrated

AI Agent Architecture

LangGraph Agent Orchestration

FastAPI Backend APIs

React Observability Dashboard

Server-Sent Event Streaming

Structured LLM Outputs

Cloud Deployable Architecture

---

# Next Learning Phases

Phase 1 – Multi-Agent Architecture

Add SupervisorAgent
Add ComplianceAgent
Add SummaryAgent

Phase 2 – RAG Retrieval

Convert runbook lookup into vector search
Use embeddings for semantic retrieval

Phase 3 – Observability

Token usage tracking
Latency metrics
Tool success rates

Phase 4 – Persistence

Store run history
Store trace logs
Store incident artifacts

Phase 5 – Cloud Deployment

Deploy React to AWS Amplify
Deploy FastAPI to ECS Fargate
Configure ALB for SSE streaming

---

# How to Run

Backend

uvicorn app.app:app --reload --port 8000

Frontend

npm install
npm run dev

---

# Learning Goal

The purpose of this project is to progressively build a **production-grade agentic AI system** while learning:

Agent orchestration
Tool routing
Observability
RAG
Cloud deployment

---

# AI Incident Triage System

A working AI-powered incident triage system with:
- React frontend with SSE streaming
- FastAPI backend
- LangGraph orchestration
- tools for logs, runbooks, policy checks
- structured JSON incident tickets

## Local development

### Frontend
cd frontend
npm install
npm run dev

### Backend
cd backend
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000