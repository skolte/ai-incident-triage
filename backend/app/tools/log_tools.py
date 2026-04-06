# This module provides tools for searching through log files based on specified criteria such as service name, 
# message content, and log level.
import json
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
LOG_FILES = [DATA_DIR / "logs.jsonl", DATA_DIR / "logs_extended.jsonl"]

def log_search_impl(service: Optional[str] = None, contains: Optional[str] = None, level: Optional[str] = None) -> str:
    """Search log files by service, message content, and/or level.

    'contains' matches against msg, service name, and any string field —
    so searching for 'checkout' finds both checkout-service entries and
    log messages that mention checkout.
    """
    matches = []
    for log_path in LOG_FILES:
        if not log_path.exists():
            continue
        with open(log_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                # Filter by service (exact match)
                if service and row.get("service") != service:
                    continue
                # Filter by level (exact match)
                if level and row.get("level") != level:
                    continue
                # Filter by contains: search msg AND service name AND endpoint fields
                if contains:
                    needle = contains.lower()
                    searchable = " ".join(
                        str(v) for k, v in row.items()
                        if k in ("msg", "service", "endpoint", "path", "error", "reason")
                    ).lower()
                    if needle not in searchable:
                        continue
                matches.append(row)
                if len(matches) >= 15:
                    break
        if len(matches) >= 15:
            break
    return "\n".join(json.dumps(m) for m in matches) or "NO_MATCHES"