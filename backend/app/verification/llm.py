"""Minimal Groq (OpenAI-compatible) chat client returning parsed JSON."""
from __future__ import annotations

import json
import re
import time

import requests


class LLMError(RuntimeError):
    def __init__(self, kind: str, detail: str = ""):
        super().__init__(f"{kind}: {detail}" if detail else kind)
        self.kind = kind  # missing_key | rate_limited | timeout | http_error | invalid_output | network_error


def parse_json_text(text: str) -> dict:
    """Parse model output as a JSON object, tolerating ```json fences or leading/trailing prose."""
    if not isinstance(text, str) or not text.strip():
        raise LLMError("invalid_output", "empty response")
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t, flags=re.I)
    try:
        obj = json.loads(t)
    except ValueError:
        m = re.search(r"\{.*\}", t, re.S)
        if not m:
            raise LLMError("invalid_output", "no JSON object found")
        try:
            obj = json.loads(m.group(0))
        except ValueError as exc:
            raise LLMError("invalid_output", "malformed JSON") from exc
    if not isinstance(obj, dict):
        raise LLMError("invalid_output", "JSON root is not an object")
    return obj


class GroqClient:
    def __init__(self, api_key: str, model: str, base_url: str, timeout: float = 45.0, session=None):
        self.key, self.model, self.base, self.timeout = api_key, model, base_url, timeout
        self.session = session or requests.Session()

    @property
    def configured(self) -> bool:
        return bool(self.key)

    def chat_json(self, system: str, user: str, temperature: float = 0.0, max_tokens: int = 2500) -> dict:
        if not self.key:
            raise LLMError("missing_key", "GROQ_API_KEY is not set")
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
        }
        last: Exception | None = None
        for attempt in range(2):
            try:
                r = self.session.post(self.base, json=payload, timeout=self.timeout,
                                      headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"})
            except requests.Timeout as exc:
                last = LLMError("timeout")
                continue
            except requests.RequestException as exc:
                raise LLMError("network_error", type(exc).__name__) from exc
            if r.status_code == 429 and attempt == 0:
                time.sleep(min(float(r.headers.get("retry-after", 2) or 2), 5))
                last = LLMError("rate_limited")
                continue
            if r.status_code == 429:
                raise LLMError("rate_limited", "Groq rate limit reached")
            if r.status_code in (401, 403):
                raise LLMError("http_error", f"authentication failed ({r.status_code}); check GROQ_API_KEY")
            if r.status_code >= 500 and attempt == 0:
                last = LLMError("http_error", str(r.status_code))
                continue
            if r.status_code >= 400:
                detail = ""
                try:
                    detail = r.json().get("error", {}).get("message", "")[:200]
                except Exception:
                    pass
                raise LLMError("http_error", f"{r.status_code} {detail}".strip())
            try:
                content = r.json()["choices"][0]["message"]["content"]
            except (ValueError, KeyError, IndexError, TypeError) as exc:
                raise LLMError("invalid_output", "unexpected response envelope") from exc
            return parse_json_text(content)
        raise last or LLMError("http_error")
