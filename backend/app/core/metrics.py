"""Shared token extraction and cost calculation utilities for all agents."""

# gpt-4o-mini pricing (per token)
INPUT_COST_PER_TOKEN  = 0.000_000_150   # $0.150 / 1M
OUTPUT_COST_PER_TOKEN = 0.000_000_600   # $0.600 / 1M


def extract_token_usage(messages: list) -> dict:
    """
    Sum token counts across all AI messages in the result.
    Handles both usage_metadata (langchain-core >= 0.2) and
    response_metadata["token_usage"] (older langchain-openai style).
    """
    prompt_tokens = 0
    completion_tokens = 0

    for msg in messages:
        usage_meta = getattr(msg, "usage_metadata", None)
        if usage_meta:
            prompt_tokens     += usage_meta.get("input_tokens", 0)
            completion_tokens += usage_meta.get("output_tokens", 0)
            continue

        resp_meta = getattr(msg, "response_metadata", {}) or {}
        tu = resp_meta.get("token_usage", {})
        if tu:
            prompt_tokens     += tu.get("prompt_tokens", 0)
            completion_tokens += tu.get("completion_tokens", 0)

    return {
        "prompt_tokens":     prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens":      prompt_tokens + completion_tokens,
    }


def estimate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate cost in USD based on gpt-4o-mini pricing."""
    return round(
        prompt_tokens * INPUT_COST_PER_TOKEN +
        completion_tokens * OUTPUT_COST_PER_TOKEN,
        6,
    )
