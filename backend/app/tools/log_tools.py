# This module provides tools for searching through log files based on specified criteria such as service name, 
# message content, and log level.
import json
from pathlib import Path
from typing import Optional

# The path to the log file, which is expected to be in JSON Lines format and located in the "data" directory relative to this module.
LOG_PATH = Path(__file__).resolve().parent.parent / "data" / "logs.jsonl"

# The log_search_impl function takes optional parameters for filtering log entries by service name, message content, and log level.
# It returns a string containing the matching log entries in JSON format.
# If no matches are found, it returns "NO_MATCHES". The log file is expected to be located at a specific path relative to this module.
def log_search_impl(service: Optional[str] = None, contains: Optional[str] = None, level: Optional[str] = None) -> str:
    matches = []
    with open(LOG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)
            if service and row.get("service") != service:
                continue
            if contains and contains.lower() not in row.get("msg", "").lower():
                continue
            if level and row.get("level") != level:
                continue
            matches.append(row)
    return "\n".join(json.dumps(m) for m in matches[:10]) or "NO_MATCHES"