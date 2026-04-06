# This module provides tools for checking text against certain policies, 
# such as identifying potential personally identifiable information (PII),
# regulated domain content, or signs of data exfiltration.
import json

# Policy rules: list of (keywords_any, flag, description) tuples.
# A flag is raised if ANY of the keywords appear in the text (case-insensitive).
_RULES = [
    # PII / data exposure
    (["user_id", "email", "ssn", "credit card", "pii"],
     "possible_pii_in_logs",
     "Log evidence may contain personally identifiable information"),
    # Regulated payment / financial domain
    (["payment", "checkout", "billing", "card", "transaction", "stripe", "order"],
     "regulated_domain_attention",
     "Incident touches payment or checkout flow — requires compliance review"),
    # Service availability / SLO breach
    (["502", "503", "504", "error rate", "% of requests", "% requests", "slo", "sla", "downtime"],
     "slo_breach_risk",
     "Error rate or gateway errors may indicate an SLO breach — check dashboards"),
    # Authentication / access control
    (["auth", "token", "jwt", "login", "session", "unauthorized", "403", "401"],
     "auth_control_review",
     "Authentication or access-control anomaly detected — review token and session policies"),
    # Data integrity / exfiltration
    (["data leak", "exfil", "dump", "export", "sensitive data"],
     "potential_data_exfiltration",
     "Possible data exfiltration signal — escalate to security team immediately"),
    # Database / persistence layer
    (["db timeout", "deadlock", "replica", "connection pool", "db latency", "slow query"],
     "database_health_flag",
     "Database performance degradation detected — may cascade to dependent services"),
    # Deployment / change correlation
    (["deploy", "release", "rollout", "upgrade", "migration", "config change"],
     "recent_change_correlation",
     "Incident may be correlated with a recent deployment or configuration change"),
]

def policy_check_impl(text: str) -> str:
    """Check incident text and log evidence against operational and compliance policies.

    Returns a list of policy flags with descriptions of why each was raised.
    """
    lower = text.lower()
    flags = []
    for keywords, flag, description in _RULES:
        if any(kw in lower for kw in keywords):
            flags.append({"flag": flag, "reason": description})
    return json.dumps({"flags": flags})