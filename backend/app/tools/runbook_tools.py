# This module provides tools for managing runbooks, which are markdown files containing procedures and information for handling incidents.
from pathlib import Path

# The RUNBOOK_DIR constant defines the directory where the runbook markdown files are stored, which is expected to be in the "data/runbooks" directory relative to this module.
RUNBOOK_DIR = Path(__file__).resolve().parent.parent / "data" / "runbooks"

# The list_runbooks_impl function lists all the markdown files in the runbook directory and returns their names as a newline-separated string.
# If no runbooks are found, it returns "NONE".
def list_runbooks_impl() -> str:
    files = [p.name for p in RUNBOOK_DIR.glob("*.md")]
    return "\n".join(sorted(files)) if files else "NONE"

# The read_runbook_impl function takes a filename as input, checks if the corresponding markdown file exists in the runbook directory, and returns its content as a string.
# If the file does not exist, it returns a "NOT_FOUND" message with the filename
def read_runbook_impl(filename: str) -> str:
    path = RUNBOOK_DIR / filename
    if not path.exists():
        return f"NOT_FOUND: {filename}"
    return path.read_text(encoding="utf-8")