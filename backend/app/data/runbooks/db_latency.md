# Runbook: DB latency and timeouts

Signals
- db timeout errors from dependent services
- pool saturation warnings
- increased 5xx at gateway

Mitigation
1. Confirm pool saturation and slow queries
2. Temporarily scale DB read replicas or increase pool
3. Enable circuit breaker at gateway for non-critical routes
4. Roll back recent migrations if correlated

Escalation
- If sustained beyond 10 minutes with customer impact, page DBA on-call