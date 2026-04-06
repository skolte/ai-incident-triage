# Runbook: Authentication Failures

Description  
Authentication failures occur when the identity verification process fails. These can be caused by invalid tokens, expired credentials, misconfigured identity providers, or key rotation mismatches.

Common Signals

- Increase in authentication errors in logs
- Login requests failing across multiple users
- JWT validation errors
- OAuth token exchange failures
- Identity provider API errors

Example Log Indicators

- "jwt validation failed"
- "kid not found"
- "token expired"
- "invalid signature"
- "unauthorized request"

Possible Root Causes

1. Token signing key rotation not propagated
2. Identity provider outage
3. Clock drift causing token expiration
4. Configuration mismatch between services
5. OAuth redirect or client configuration issues

Immediate Diagnostics

1. Check authentication service logs
2. Verify JWT signing keys match expected key IDs
3. Confirm identity provider availability
4. Validate system time synchronization across services
5. Inspect recent configuration changes to auth services

Mitigation Steps

1. Refresh cached signing keys
2. Restart authentication service instances
3. Re-sync identity provider metadata
4. Roll back authentication configuration changes
5. Temporarily allow token grace period if clock drift suspected

Customer Impact

Users may experience:

- inability to log in
- session expiration
- authorization errors

Escalation Criteria

Escalate to SEV1 if:

- authentication failures exceed 20% of login attempts
- all users are unable to log in
- identity provider integration is failing globally

Escalation Contacts

- Identity Platform Team
- Security Engineering
- SRE On-call