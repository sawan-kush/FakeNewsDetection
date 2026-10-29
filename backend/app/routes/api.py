"""REST API. See README for request/response examples."""
from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from app.ml.predictor import ModelUnavailable
from app.services import ValidationError, validate_payload

bp = Blueprint("api", __name__, url_prefix="/api")


def _svc():
    return current_app.extensions["truthlens"]


def _err(message: str, status: int, **extra):
    return jsonify({"error": message, **extra}), status


@bp.get("/health")
def health():
    s = _svc()
    cfg = s.cfg
    modes = s.predictor.available_modes()
    smoke = None
    try:
        smoke = bool(s.predictor.metrics().get("smoke_test"))
    except ModelUnavailable:
        pass
    return jsonify({
        "status": "ok",
        "model": {"available_modes": modes, "trained": len(modes) == 3, "smoke_test": smoke},
        "services": {"search_and_verification": s.llm.configured and s.searcher.configured,
                     "search": s.searcher.configured, "verification": s.llm.configured},
        "history_enabled": s.history is not None,
        "limits": {"headline_max": cfg.headline_max, "headline_min": cfg.headline_min,
                   "article_max": cfg.article_max, "article_min": cfg.article_min},
    })


@bp.post("/analyze")
def analyze():
    s = _svc()
    data = request.get_json(silent=True)
    try:
        mode, headline, text = validate_payload(s.cfg, data)
    except ValidationError as exc:
        return _err(str(exc), 400)
    save = bool(data.get("save_history")) and s.history is not None
    if data.get("wait"):
        job = s.run_now(mode, headline, text, save)
        snap = job.snapshot()
        if snap["status"] == "error":
            return _err(snap["error"] or "Analysis failed.", 500)
        return jsonify(snap["result"])
    job = s.submit(mode, headline, text, save)
    return jsonify({"job_id": job.id, "status": "running", "stages": job.snapshot()["stages"]}), 202


@bp.get("/analyze/<job_id>")
def analyze_status(job_id: str):
    job = _svc().get(job_id)
    if not job:
        return _err("Unknown or expired job.", 404)
    return jsonify(job.snapshot())


@bp.get("/model/metrics")
def model_metrics():
    try:
        return jsonify(_svc().predictor.metrics())
    except ModelUnavailable as exc:
        return _err(str(exc), 404, trained=False)


@bp.get("/history")
def history_list():
    h = _svc().history
    if h is None:
        return _err("History is disabled.", 404)
    return jsonify({"items": h.list(request.args.get("limit", 100, type=int))})


@bp.get("/history/<item_id>")
def history_get(item_id: str):
    h = _svc().history
    item = h.get(item_id) if h else None
    return jsonify(item) if item else _err("Not found.", 404)


@bp.delete("/history/<item_id>")
def history_delete(item_id: str):
    h = _svc().history
    if h is None or not h.delete(item_id):
        return _err("Not found.", 404)
    return jsonify({"deleted": item_id})


@bp.delete("/history")
def history_clear():
    h = _svc().history
    if h is None:
        return _err("History is disabled.", 404)
    return jsonify({"deleted": h.clear()})