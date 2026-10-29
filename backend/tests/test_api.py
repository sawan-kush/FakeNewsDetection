import pytest

from app.retrieval.brave import SearchError
from app.verification.llm import LLMError
from tests.conftest import CLAIMS_JSON, VERDICT_JSON, FakeBrave, FakeLLM

H = "Chandrayaan-3 landed on the Moon in 2024."
BODY = "Chandrayaan-3 landed on the Moon in 2024, officials said on Monday. " * 2


def post(client, **kw):
    return client.post("/api/analyze", json={"wait": True, **kw})


@pytest.mark.parametrize("payload", [
    {"mode": "headline", "headline": H},
    {"mode": "article", "text": BODY},
    {"mode": "both", "headline": H, "text": BODY}])
def test_all_input_modes_full_pipeline(client_factory, payload):
    c, _ = client_factory()
    r = post(c, **payload)
    assert r.status_code == 200
    d = r.get_json()
    assert d["mode"] == payload["mode"] and d["ml"]["available"] and d["ml"]["result"]["mode"] == payload["mode"]
    v = d["verification"]
    assert v["status"] == "ok" and v["verdict"] == "contradicted" and v["verdict_label"] == "Contradicted by evidence"
    assert d["claims"][0]["correction"] and d["claims"][0]["assessments"][0]["evidence_id"] == "E1"
    assert d["evidence"][0]["domain"] == "isro.gov.in" and "2023" in d["evidence"][0]["passages"][0]["text"]
    assert d["quality_legend"]["official"]


@pytest.mark.parametrize("payload,fragment", [
    ({}, "mode"), ({"mode": "x"}, "mode"), ({"mode": "headline"}, "required"), ({"mode": "headline", "headline": "short"}, "short"),
    ({"mode": "article", "text": "tiny"}, "short"), ({"mode": "both", "headline": H}, "required"),
    ({"mode": "headline", "headline": "x" * 400}, "long"), ({"mode": "article", "text": "x " * 11000}, "long"),
    ({"mode": "headline", "headline": 123}, "string")])
def test_validation_errors(client_factory, payload, fragment):
    c, _ = client_factory()
    r = post(c, **payload)
    assert r.status_code == 400 and fragment in r.get_json()["error"]


def test_non_json_body(client_factory):
    c, _ = client_factory()
    assert c.post("/api/analyze", data="nope", content_type="text/plain").status_code == 400


def test_search_failure_keeps_ml_and_marks_verification_unavailable(client_factory):
    c, _ = client_factory(brave=FakeBrave(error=SearchError("rate_limited")), llm=FakeLLM([CLAIMS_JSON]))
    d = post(c, mode="headline", headline=H).get_json()
    assert d["ml"]["available"]
    assert d["verification"]["status"] == "unavailable" and d["verification"]["reason"] == "search_failed"
    assert d["verification"]["verdict"] is None and any("rate limit" in w for w in d["warnings"])


def test_missing_api_keys(client_factory):
    class NoBrave(FakeBrave):
        configured = False
        def search(self, q, count=6): raise SearchError("missing_key", "no key")
    class NoLLM(FakeLLM):
        def chat_json(self, *a, **k): raise LLMError("missing_key")
    c, _ = client_factory(brave=NoBrave(), llm=NoLLM(configured=False))
    d = post(c, mode="headline", headline=H).get_json()
    assert d["ml"]["available"] and d["verification"]["status"] == "unavailable"
    assert any("heuristic" in w or "GROQ" in w for w in d["warnings"])
    h = c.get("/api/health").get_json()
    assert h["services"] == {"brave_configured": False, "groq_configured": False, "groq_model": None}


def test_llm_not_configured_still_returns_unverified_evidence(client_factory):
    c, _ = client_factory(llm=FakeLLM(configured=False))
    d = post(c, mode="headline", headline=H).get_json()
    assert d["verification"]["reason"] == "llm_not_configured" and d["evidence"]


def test_invalid_verifier_output_reported(client_factory):
    c, _ = client_factory(llm=FakeLLM([CLAIMS_JSON, {"bad": 1}, {"bad": 2}]))
    d = post(c, mode="headline", headline=H).get_json()
    assert d["verification"]["reason"] == "verifier_failed" and "validation" in d["verification"]["message"]


def test_no_evidence_is_insufficient_not_false(client_factory):
    c, _ = client_factory(brave=FakeBrave(results=[]), llm=FakeLLM([CLAIMS_JSON]))
    d = post(c, mode="headline", headline=H).get_json()
    assert d["verification"]["verdict"] == "insufficient" and "does not" in d["verification"]["summary"]


def test_ml_unavailable_does_not_break_verification(client_factory, tmp_path):
    c, _ = client_factory(artifact_dir=tmp_path / "missing")
    d = post(c, mode="headline", headline=H).get_json()
    assert d["ml"]["available"] is False and "prepare_data" in d["ml"]["error"]
    assert d["verification"]["verdict"] == "contradicted"


def test_ml_label_never_changes_factual_verdict(client_factory):
    """Same evidence -> same verdict regardless of what the classifier says."""
    c, svc = client_factory()
    svc.predictor.predict = lambda *a, **k: {"label": "real", "probability": .99, "probabilities": {"fake": .01, "real": .99},
                                             "model_name": "x", "mode": "headline", "probabilities_calibrated": True,
                                             "smoke_test_model": False, "disclaimer": "d"}
    d = post(c, mode="headline", headline=H).get_json()
    assert d["ml"]["result"]["label"] == "real" and d["verification"]["verdict"] == "contradicted"


def test_async_job_flow_and_stages(client_factory):
    import time
    c, _ = client_factory()
    r = c.post("/api/analyze", json={"mode": "headline", "headline": H})
    assert r.status_code == 202
    jid = r.get_json()["job_id"]
    for _ in range(100):
        s = c.get(f"/api/analyze/{jid}").get_json()
        if s["status"] != "running":
            break
        time.sleep(0.05)
    assert s["status"] == "done" and all(st["status"] == "done" for st in s["stages"])
    assert s["result"]["verification"]["verdict"] == "contradicted"
    assert c.get("/api/analyze/doesnotexist").status_code == 404


def test_history_operations(client_factory):
    c, _ = client_factory()
    saved = post(c, mode="headline", headline=H, save_history=True).get_json()
    post(c, mode="headline", headline=H, save_history=False)
    items = c.get("/api/history").get_json()["items"]
    assert len(items) == 1 and items[0]["verdict"] == "contradicted" and items[0]["mode"] == "headline"
    full = c.get(f"/api/history/{saved['id']}").get_json()
    assert full["evidence"][0]["url"].startswith("https://")
    assert c.delete(f"/api/history/{saved['id']}").status_code == 200
    assert c.delete(f"/api/history/{saved['id']}").status_code == 404
    post(c, mode="headline", headline=H, save_history=True)
    assert c.delete("/api/history").get_json()["deleted"] == 1
    assert c.get("/api/history").get_json()["items"] == []


def test_health_and_metrics(client_factory, tmp_path):
    c, _ = client_factory()
    h = c.get("/api/health").get_json()
    assert h["status"] == "ok" and h["model"]["trained"] and h["model"]["smoke_test"] is True
    assert c.get("/api/model/metrics").get_json()["modes"]["both"]["selected_model"]
    c2, _ = client_factory(artifact_dir=tmp_path / "none")
    r = c2.get("/api/model/metrics")
    assert r.status_code == 404 and r.get_json()["trained"] is False
    assert c2.get("/api/health").get_json()["model"]["trained"] is False
