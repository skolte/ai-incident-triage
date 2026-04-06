# This module provides tools for checking text against certain policies, 
# such as identifying potential personally identifiable information (PII),
# regulated domain content, or signs of data exfiltration.
import json

# The policy_check_impl function takes a text input and checks for specific keywords to determine if any policy flags should be raised.
# It looks for terms like "user_id" to flag possible PII, "payment" to flag regulated domain attention, and "data leak" or "exfil" to flag potential data exfiltration.
# The function returns a JSON string containing a list of flags that were raised based on the content of the input text.
def policy_check_impl(text: str) -> str:
    flags = []
    lower = text.lower()
    if "user_id" in lower:
        flags.append("possible_pii_in_evidence")
    if "payment" in lower:
        flags.append("regulated_domain_attention")
    if "data leak" in lower or "exfil" in lower:
        flags.append("potential_data_exfiltration")
    return json.dumps({"flags": flags})