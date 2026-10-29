"""Input validation, analysis orchestration and an in-memory job manager with real stage tracking."""
from __future__ import annotations

import logging
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from app.config import MODES, Config
from app.ml.cleaning import clean_str
from app.ml.predictor import ModelUnavailable, Predictor
from app.retrieval import evidence as ev
from app.retrieval.claims import extract_claims
from app.retrieval.fetcher import SafeFetcher
from app.retrieval.groq_search import GroqSearchClient, SearchError
from app.retrieval.sources import QUALITY_LEGEND
from app.verification.llm import GroqClient, LLMError
from app.verification.verifier import VERDICT_LABELS, verify

log = logging.getLogger("truthlens")

STAGES = [
    ("prepare", "Understanding the claim"),
    ("ml", "Checking writing style"),
    ("search", "Searching the web"),
    ("evaluate", "Comparing with sources"),
    ("report", "Preparing your report"),
]

# Messages shown to end users. Technical detail goes to result["diagnostics"] and server logs only.
MSG_NO_SEARCH = "We couldn't search the web to check this right now. Please try again in a moment."
MSG_NO_VERIFIER = "Fact-checking isn't available right now. Please try again later."
MSG_VERIFIER_FAILED = "We couldn't finish fact-checking this time. Please try again."
MSG_NO_EVIDENCE = "We couldn't find reliable evidence about this. That doesn't mean it is false."
MSG_ML_DOWN = "The writing-style check isn't available right now."


class ValidationError(ValueError):
    pass


def validate_payload(cfg: Config, data) -> tuple[str, str, str]:
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object.")
    mode = data.get("mode")
    if mode not in MODES:
        raise ValidationError(f"'mode' must be one of: {', '.join(MODES)}.")
    headline, text = data.get("headline", ""), data.get("text", "")
    for name, v in (("headline", headline), ("text", text)):
        if v is not None and not isinstance(v, str):
            raise ValidationError(f"'{name}' must be a string.")
    headline, text = clean_str(headline or ""), clean_str(text or "")
    if mode in ("headline", "both"):
        if not headline:
            raise ValidationError("A headline is required for this mode.")
        if len(headline) < cfg.headline_min:
            raise ValidationError(f"Headline is too short (minimum {cfg.headline_min} characters).")
    if mode in ("article", "both"):
        if not text:
            raise ValidationError("Article text is required for this mode.")
        if len(text) < cfg.article_min:
            raise ValidationError(f"Article text is too short (minimum {cfg.article_min} characters).")
    if len(headline) > cfg.headline_max:
        raise ValidationError(f"Headline is too long (maximum {cfg.headline_max} characters).")
    if len(text) > cfg.article_max:
        raise ValidationError(f"Article text is too long (maximum {cfg.article_max} characters).")
    if mode == "headline":
        text = ""
    if mode == "article":
        headline = ""
    return mode, headline, text


class Job:
    def __init__(self, mode: str):
        self.id = uuid.uuid4().hex[:16]
        self.mode = mode
        self.created = time.time()
        self.status = "running"  # running | done | error
        self.error: str | None = None
        self.result: dict | None = None
        self.stages = [{"id": i, "label": l, "status": "pending", "detail": "", "seconds": None} for i, l in STAGES]
        self._t0: dict[str, float] = {}
        self.lock = threading.Lock()

    def set(self, stage: str, status: str, detail: str = ""):
        with self.lock:
            for s in self.stages:
                if s["id"] == stage:
                    now = time.time()
                    if status == "running":
                        self._t0[stage] = now
                    if status in ("done", "failed", "skipped") and stage in self._t0:
                        s["seconds"] = round(now - self._t0[stage], 2)
                    s["status"], s["detail"] = status, detail

    def snapshot(self) -> dict:
        with self.lock:
            return {"job_id": self.id, "status": self.status, "stages": [dict(s) for s in self.stages],
                    "error": self.error, "result": self.result}


class AnalysisService:
    def __init__(self, cfg: Config, predictor: Predictor, history=None, searcher=None, llm=None, fetcher=None):
        self.cfg, self.predictor, self.history = cfg, predictor, history
        self.searcher = searcher or GroqSearchClient(cfg.groq_api_key, cfg.groq_search_model, cfg.groq_api_base)
        self.llm = llm or GroqClient(cfg.groq_api_key, cfg.groq_model, cfg.groq_api_base)
        self.fetcher = fetcher or SafeFetcher(cfg.http_timeout, cfg.max_page_bytes, cfg.user_agent, cfg.respect_robots)
        self.jobs: dict[str, Job] = {}
        self._pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="job")
        self._lock = threading.Lock()

    # --- jobs ---------------------------------------------------------------
    def submit(self, mode, headline, text, save_history=False) -> Job:
        job = Job(mode)
        with self._lock:
            cutoff = time.time() - self.cfg.job_ttl_seconds
            for k in [k for k, j in self.jobs.items() if j.created < cutoff]:
                del self.jobs[k]
            self.jobs[job.id] = job
        self._pool.submit(self._run_safe, job, mode, headline, text, save_history)
        return job

    def run_now(self, mode, headline, text, save_history=False) -> Job:
        """Synchronous variant (used by `wait: true` requests and tests)."""
        job = Job(mode)
        with self._lock:
            self.jobs[job.id] = job
        self._run_safe(job, mode, headline, text, save_history)
        return job

    def get(self, job_id: str) -> Job | None:
        return self.jobs.get(job_id)

    def _run_safe(self, job, mode, headline, text, save_history):
        try:
            job.result = self.run(job, mode, headline, text)
            job.status = "done"
            if save_history and self.history:
                self.history.save(job.result)
        except Exception as exc:  # last-resort guard; details stay server-side
            log.exception("analysis job %s crashed", job.id)
            job.status, job.error = "error", f"Unexpected server error ({type(exc).__name__})."

    # --- pipeline -------------------------------------------------------------
    def run(self, job: Job, mode: str, headline: str, text: str) -> dict:
        t0 = time.time()
        log.info("job %s start mode=%s headline_len=%d text_len=%d", job.id, mode, len(headline), len(text))
        # Approach A (ML) runs in parallel with Approach B (retrieval)
        with ThreadPoolExecutor(max_workers=2) as ex:
            ml_f = ex.submit(self._ml, job, mode, headline, text)
            ret_f = ex.submit(self._retrieve, job, headline, text)
            ml = ml_f.result()
            retrieval = ret_f.result()

        # Approach C: verification, only after both finished
        job.set("evaluate", "running", "")
        verification = self._verify(job, retrieval)

        job.set("report", "running", "")
        claims_out = self._merge_claims(retrieval["claims"], verification)
        result = {
            "id": job.id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "mode": mode,
            "input": {"headline": headline, "text_preview": text[:300]},
            "ml": ml,
            "claims": claims_out,
            "evidence": retrieval["evidence"],
            "verification": verification,
            "diagnostics": retrieval["diagnostics"] + verification.pop("diagnostics", []),
            "quality_legend": QUALITY_LEGEND,
            "timings": {"total_seconds": round(time.time() - t0, 2)},
        }
        job.set("report", "done", "")
        log.info("job %s done in %.1fs verdict=%s", job.id, time.time() - t0, verification.get("verdict"))
        return result

    def _ml(self, job, mode, headline, text) -> dict:
        job.set("ml", "running", "")
        try:
            res = self.predictor.predict(mode, headline, text)
            job.set("ml", "done", "")
            return {"available": True, "result": res}
        except (ModelUnavailable, ValueError) as exc:
            job.set("ml", "failed", "Unavailable")
            log.warning("ML unavailable: %s", exc)
            return {"available": False, "error": MSG_ML_DOWN, "diagnostic": str(exc)}

    def _retrieve(self, job, headline, text) -> dict:
        out = {"claims": [], "evidence": [], "diagnostics": [], "search_error": None, "notes": []}
        job.set("prepare", "running", "")
        claims, warn = extract_claims(self.llm, headline, text, self.cfg.max_claims)
        out["claims"] = claims
        if warn:
            out["diagnostics"].append(warn)
        job.set("prepare", "done" if claims else "failed", f"{len(claims)} claim(s)")
        if not claims:
            job.set("search", "skipped", "")
            out["search_error"] = "no_claims"
            return out

        job.set("search", "running", "")
        try:
            results, errs = ev.search_all(self.searcher, claims, self.cfg.results_per_query, self.cfg.queries_per_claim)
            out["diagnostics"] += [f"search issue: {e}" for e in errs]
            chosen = ev.rank_results(results, claims, self.cfg.max_pages_to_fetch)
            job.set("search", "done", f"{len(results)} result(s)")
        except SearchError as exc:
            out["search_error"] = exc.kind
            out["diagnostics"].append(f"web search failed: {exc}")
            log.warning("web search failed: %s", exc)
            job.set("search", "failed", "")
            return out

        if chosen:
            job.set("evaluate", "running", "")
            evidence, notes = ev.build_evidence(chosen, claims, self.fetcher)
            out["evidence"], out["diagnostics"] = evidence, out["diagnostics"] + notes
        return out

    def _verify(self, job, retrieval) -> dict:
        base = {"claims": [], "limitations": [], "diagnostics": []}

        def unavailable(reason, message):
            job.set("evaluate", "failed", "")
            return {**base, "available": False, "status": "unavailable", "reason": reason, "message": message,
                    "verdict": None, "verdict_label": None, "summary": None}

        if retrieval["search_error"]:
            return unavailable("search_failed", MSG_NO_SEARCH)
        if not self.llm.configured:
            return unavailable("llm_not_configured", MSG_NO_VERIFIER)
        if not retrieval["evidence"]:
            job.set("evaluate", "done", "")
            return {**base, "available": True, "status": "ok", "verdict": "insufficient",
                    "verdict_label": VERDICT_LABELS["insufficient"], "summary": MSG_NO_EVIDENCE,
                    "limitations": ["No relevant web evidence was found for these claims."], "reason": "no_evidence"}
        try:
            v, guard_notes = verify(self.llm, retrieval["claims"], retrieval["evidence"])
        except LLMError as exc:
            log.warning("verifier failed: %s", exc)
            out = unavailable("verifier_failed", MSG_VERIFIER_FAILED)
            out["diagnostics"] = [f"verifier failed: {exc}"]
            return out
        limits = list(v.limitations)
        if all(not e["retrieval"]["page_fetched"] for e in retrieval["evidence"]):
            limits.append("Some sources could only be read in part, so this relies on short excerpts.")
        job.set("evaluate", "done", "")
        return {**base, "available": True, "status": "ok", "verdict": v.overall_verdict,
                "verdict_label": VERDICT_LABELS[v.overall_verdict], "summary": v.summary,
                "claims": [c.model_dump() for c in v.claims], "limitations": list(dict.fromkeys(limits)),
                "diagnostics": guard_notes}

    @staticmethod
    def _merge_claims(claims, verification) -> list[dict]:
        by_id = {c["claim_id"]: c for c in verification.get("claims", [])}
        out = []
        for c in claims:
            r = by_id.get(c["id"])
            out.append({"id": c["id"], "text": c["text"], "queries": c["queries"], "extracted_by": c["source"],
                        "verdict": r["verdict"] if r else None,
                        "verdict_label": VERDICT_LABELS[r["verdict"]] if r else None,
                        "explanation": r["explanation"] if r else None,
                        "correction": r.get("correction") if r else None,
                        "assessments": r["assessments"] if r else []})
        return out