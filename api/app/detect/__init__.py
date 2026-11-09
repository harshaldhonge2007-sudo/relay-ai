# lazy imports — individual modules are imported directly by consumers.
# Eager imports are intentionally omitted to avoid triggering asyncpg at load time.

__all__ = [
    "detect_inflight",
    "detect_hidden_dependencies",
    "detect_contradictions",
    "detect_gaps",
]
