"""TruthLens backend application factory."""
from __future__ import annotations

import logging

from flask import Flask, jsonify

from app.config import Config, get_config
from app.history.store import HistoryStore
from app.ml.predictor import Predictor
from app.routes.api import bp as api_bp
from app.services import AnalysisService


def create_app(cfg: Config | None = None, service: AnalysisService | None = None) -> Flask:
    cfg = cfg or get_config()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 200 * 1024  # request bodies above this get 413
    if service is None:
        history = HistoryStore(cfg.history_db)
        service = AnalysisService(cfg, Predictor(cfg.artifact_dir), history)
    app.extensions["truthlens"] = service
    app.register_blueprint(api_bp)

    @app.errorhandler(413)
    def too_large(_):
        return jsonify({"error": "Request body is too large."}), 413

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not found."}), 404

    @app.errorhandler(405)
    def bad_method(_):
        return jsonify({"error": "Method not allowed."}), 405

    @app.errorhandler(500)
    def server_error(_):
        return jsonify({"error": "Internal server error."}), 500

    return app
