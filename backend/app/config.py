"""Configuration. Secrets come only from environment variables (see .env.example)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


@dataclass
class Config:
    groq_api_key: str = field(default_factory=lambda: os.getenv("GROQ_API_KEY", "").strip())
    groq_model: str = field(default_factory=lambda: os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").strip())
    groq_api_base: str = field(
        default_factory=lambda: os.getenv("GROQ_API_BASE", "https://api.groq.com/openai/v1/chat/completions")
    )
    request_timeout: float = field(default_factory=lambda: _float("GROQ_TIMEOUT", 90.0))

    # input limits
    min_chars: int = 10
    max_chars: int = 8000


def get_config() -> Config:
    return Config()