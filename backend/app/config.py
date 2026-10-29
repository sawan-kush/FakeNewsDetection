"""Central configuration. Secrets come only from environment variables (see .env.example)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

MODES = ("headline", "article", "both")


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@dataclass
class Config:
    # --- secrets / external services -------------------------------------
    groq_api_key: str = field(default_factory=lambda: os.getenv("GROQ_API_KEY", ""))
    groq_model: str = field(default_factory=lambda: os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"))
    # Groq's built-in web search runs inside "compound" models (single tool call, low latency)
    groq_search_model: str = field(default_factory=lambda: os.getenv("GROQ_SEARCH_MODEL", "groq/compound-mini"))
    groq_api_base: str = field(
        default_factory=lambda: os.getenv("GROQ_API_BASE", "https://api.groq.com/openai/v1/chat/completions")
    )

    # --- paths ------------------------------------------------------------
    artifact_dir: Path = field(
        default_factory=lambda: Path(os.getenv("TRUTHLENS_ARTIFACT_DIR", BACKEND_DIR / "artifacts"))
    )
    history_db: Path = field(
        default_factory=lambda: Path(os.getenv("TRUTHLENS_HISTORY_DB", BACKEND_DIR / "data" / "history.sqlite3"))
    )

    # --- input limits -----------------------------------------------------
    headline_min: int = 10
    headline_max: int = 300
    article_min: int = 50
    article_max: int = 20000

    # --- retrieval --------------------------------------------------------
    max_claims: int = field(default_factory=lambda: _int("MAX_CLAIMS", 3))
    results_per_query: int = field(default_factory=lambda: _int("RESULTS_PER_QUERY", 6))
    queries_per_claim: int = field(default_factory=lambda: _int("QUERIES_PER_CLAIM", 1))
    max_pages_to_fetch: int = field(default_factory=lambda: _int("MAX_PAGES_TO_FETCH", 6))
    http_timeout: float = field(default_factory=lambda: _float("HTTP_TIMEOUT", 8.0))
    max_page_bytes: int = 1_500_000
    respect_robots: bool = field(default_factory=lambda: os.getenv("RESPECT_ROBOTS", "true").lower() != "false")
    user_agent: str = "TruthLensBot/1.0 (+evidence retrieval; respects robots.txt)"

    # --- misc -------------------------------------------------------------
    job_ttl_seconds: int = 1800
    log_user_text: bool = field(default_factory=lambda: os.getenv("LOG_USER_TEXT", "false").lower() == "true")


def get_config() -> Config:
    return Config()