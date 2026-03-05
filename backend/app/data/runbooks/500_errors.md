# Runbook: HTTP 500 / 502 / 503 Errors

Description  
HTTP 5xx errors indicate that a server failed to process a valid request. These errors are typically caused by upstream service failures, resource exhaustion, or application bugs.

Common Signals

- Increased HTTP 500, 502, or 503 responses
- API gateway logs showing "upstream connect error"
- Sudden spike in error rate in monitoring dashboards
- Customer reports of checkout failures or application errors
- Increased latency before failures occur

Possible Root Causes

1. Upstream service failure
2. Database connection exhaustion
3. Application deployment introducing a regression
4. Network connectivity issues between services
5. Circuit breaker triggered due to downstream instability

Immediate Diagnostics

1. Check gateway logs for 502 or 503 errors
2. Identify which downstream service is failing
3. Check recent deployments within the last 30 minutes
4. Review container or instance health metrics
5. Verify database connection pool usage

Example Log Indicators

- "502 upstream connect error"
- "service unavailable"
- "connection refused"
- "upstream request timeout"

Mitigation Steps

1. Identify failing upstream service
2. Restart unhealthy containers or instances
3. Roll back most recent deployment if errors began after release
4. Increase autoscaling capacity temporarily
5. Enable circuit breaker or degrade non-critical functionality

Escalation Criteria

Escalate to SEV1 if:

- More than 25% of requests are failing
- Customer checkout or authentication is affected
- Errors persist longer than 10 minutes
- No clear mitigation identified after initial investigation

Escalation Contacts

- On-call SRE
- Platform Engineering
- Service owner for impacted microservice