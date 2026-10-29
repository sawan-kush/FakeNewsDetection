# TruthLens

Separate claims from evidence. TruthLens analyses a news **headline**, a **full article**, or **both** in two independent ways and keeps them apart:

| | What it does | What it can and cannot say |
|---|---|---|
| **ML prediction** | TF-IDF + a classical model (Naive Bayes / Logistic Regression / Linear SVM) trained on WELFake | Says whether the *wording resembles* articles labelled fake or real in that dataset. **Not a factual verdict.** |
| **Evidence verification** | Brave Search → page retrieval → passage extraction → Groq LLM compares claims with the evidence | Returns *Supported / Contradicted / Mixed / Insufficient evidence*, with sources. Lack of evidence is never reported as "false". |

The factual verdict is derived **only from retrieved evidence**; the ML label never feeds into it.

## Architecture

```
frontend/ (React + Vite + TS + Tailwind + Recharts)  ──/api──►  backend/ (Flask)
                                                               ├─ app/routes/api.py        REST endpoints
                                                               ├─ app/services.py          validation, jobs, orchestration
                                                               ├─ app/ml/                  cleaning, label mapping, predictor
                                                               ├─ app/retrieval/           claims, Brave, safe fetcher, evidence, source tiers
                                                               ├─ app/verification/        Groq client, verifier + schema + guards
                                                               ├─ app/history/             SQLite store
                                                               ├─ training/                download, prepare, train, label check
                                                               └─ tests/                   pytest (71 tests, external services mocked)
```

Runtime flow of `POST /api/analyze`: the ML classifier and the retrieval chain (claim extraction → search → rank → fetch → passages) run **in parallel**; when both finish the verifier compares claims with evidence; then the report is assembled. The UI polls a job endpoint, and every progress stage reflects the backend's actual state.

## Quick start

Requirements: Python 3.10+, Node 18+.

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # then add BRAVE_API_KEY and GROQ_API_KEY

# 2. Dataset + training (see next sections)
python -m training.download_dataset
python -m training.prepare_data
python -m training.train

# 3. Run the API (http://127.0.0.1:5000)
python run.py

# 4. Frontend, in a second terminal (http://localhost:5173)
cd frontend && npm install && npm run dev
```

The app starts even when the model or API keys are missing and tells you exactly what is unavailable.

## Dataset (WELFake)

WELFake (72,134 articles; Verma et al., 2021) lives on Kaggle and Zenodo, which need a browser or credentials, so it is **not bundled**.

```bash
python -m training.download_dataset            # checks backend/data/WELFake_Dataset.csv, prints instructions if missing
# options:
kaggle datasets download -d saurabhshahane/fake-news-classification -p backend/data --unzip
python -m training.download_dataset --url <direct csv/zip url>   # any mirror you trust
```

ISOT can be used instead: convert it to one CSV with `title,text,label` columns and pass it with `prepare_data --input`.

### ⚠ Verify the label direction

Internally **1 = fake, 0 = real**. WELFake's own documentation says `0 = fake, 1 = real`, but several independent analyses report the real data is the other way round. TruthLens does not guess silently:

```bash
python -m training.prepare_data --source-fake-value 1     # default: source value 1 means fake
python -m training.check_labels                           # prints the tokens most tied to each class
```

If the "real" tokens look sensational/partisan and the "fake" tokens look like wire-service copy, re-run `prepare_data` and `train` with `--source-fake-value 0`.

## Data preparation (`training/prepare_data.py`)

Normalises to `title, text, label` and reports counts before and after: missing/invalid labels, empty text, too-short records, **conflicting duplicates** (same content, different label → all copies dropped), exact duplicates, and duplicate article bodies under different headlines. It then makes a stratified 70/15/15 split **after** de-duplication and asserts no record appears in two splits. Outputs go to `data/processed/` with `cleaning_report.json`.

## Training (`training/train.py`)

For each input mode (headline, article, headline+article) it fits `TfidfVectorizer → classifier` for Multinomial Naive Bayes, Logistic Regression and Linear SVM. TF-IDF is fitted on the **training split only**. The Linear SVM is wrapped in `CalibratedClassifierCV` (sigmoid, 3-fold), so every reported probability is calibrated. Models are compared on **validation** macro-F1; test metrics are reported but never used for selection. Accuracy, precision, recall, macro-F1, Brier score and confusion matrices are written to `artifacts/metrics.json` together with the saved pipelines (`artifacts/<mode>.joblib`). Files are written only if all training succeeds. Training happens only when you run it, never per request.

Smoke test without the real dataset: `python -m training.make_smoke_data`, then `prepare_data --input data/smoke/smoke.csv --out-dir data/smoke/processed` and `train --data-dir data/smoke/processed --artifact-dir artifacts_smoke --smoke-test`. This **synthetic** data only proves the code runs; artifacts are flagged `smoke_test` and the UI shows warnings. Never use them as results.

## Configuration

| Variable | Purpose |
|---|---|
| `BRAVE_API_KEY` | Brave Search API token (web retrieval) |
| `GROQ_API_KEY`, `GROQ_MODEL` | Groq key and any supported chat model |
| `MAX_CLAIMS`, `RESULTS_PER_QUERY`, `MAX_PAGES_TO_FETCH`, `HTTP_TIMEOUT`, `RESPECT_ROBOTS` | Retrieval tuning |
| `TRUTHLENS_ARTIFACT_DIR`, `TRUTHLENS_HISTORY_DB` | Storage locations |
| `LOG_USER_TEXT` | Off by default; user text is not logged |

Keys live only in backend environment variables and are never sent to the browser.

## REST API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Model availability, which services are configured, input limits |
| `POST /api/analyze` | Body `{mode, headline, text, save_history, wait}`. `wait:true` returns the full result; otherwise `202 {job_id}` |
| `GET /api/analyze/<job_id>` | Job status, per-stage progress, and the result when done |
| `GET /api/model/metrics` | Saved training metrics (`404` until trained) |
| `GET /api/history`, `GET/DELETE /api/history/<id>`, `DELETE /api/history` | Saved analyses |

`mode` is `headline`, `article` or `both`. Limits: headline 10–300 chars, article 50–20,000 chars, request body ≤ 200 KB. Errors are JSON `{ "error": "..." }`.

## How evidence is handled

1. **Claims**: Groq extracts up to 3 checkable claims and search queries that keep names, dates and places verbatim (a heuristic fallback is used, with a visible warning, if the LLM fails).
2. **Search**: Brave results are de-duplicated by canonical URL and ranked by source tier, snippet relevance and search rank; each claim is guaranteed coverage.
3. **Reading**: pages are fetched with SSRF protections and `robots.txt` is honoured. Relevant passages are chosen by overlap with the claim. If a page can't be read, only search-API snippets are used and the source is marked "search snippet".
4. **Verification**: the LLM sees claims and evidence only (never the ML label), returns schema-validated JSON (one retry on invalid output), and cites evidence by id. **The LLM never writes quotations**: displayed passages are the retrieved text itself. Deterministic guards downgrade any verdict the cited evidence doesn't back and fix inconsistent overall verdicts.
5. Retrieved text is delimited as untrusted data and the system prompt forbids following instructions inside it.

### Source-quality labels

Coarse priors by publisher type, shown as badges; they are *not* a judgment on a page. Always read the passage.

| Label | Meaning |
|---|---|
| Official | Government, intergovernmental or public-agency site |
| Scientific | University, research institution, scientific publisher, space/health agency |
| News outlet | Established news organisation or wire service |
| Fact-checker | Dedicated fact-checking organisation |
| Reference | General/user-edited reference (orientation only) |
| Unrated | No information about this domain |

The domain lists are in `app/retrieval/sources.py` and are intentionally short; extend them for your region.

## Security and privacy

- API keys: backend env only. Requests validated (types, lengths, mode); body size capped.
- **SSRF**: only http/https on ports 80/443, no credentials in URLs, every hostname resolved and all addresses must be public (loopback, private, link-local incl. cloud metadata, reserved and multicast are refused), literal IPs checked directly, redirects re-validated hop by hop (max 3), size/time/content-type limits, best-effort peer-IP check after connect. A narrow DNS-rebinding window remains between check and connect; for hostile environments run the backend behind an egress proxy.
- User text isn't logged (job ids, mode and lengths only).
- History is local SQLite, **unencrypted and unauthenticated**. Anyone with access to the machine or the API port can read it. Don't expose the API publicly as-is: there is no authentication or rate limiting.

## Testing

```bash
cd backend && python -m pytest          # 71 tests: cleaning, labels, training/metrics, all input modes,
                                        # Brave parsing, SSRF, fetch errors, verifier schema/guards, API, history
cd frontend && npm test && npm run build
```

External services are mocked in unit tests. `python -m tests.e2e.mock_services` starts **dev-only canned stand-ins** for Brave and Groq (ports 5101/5102) for offline UI demos: set `BRAVE_API_BASE=http://127.0.0.1:5101/search` and `GROQ_API_BASE=http://127.0.0.1:5102/v1/chat/completions` with dummy keys. Their output is fake by design and labelled "MOCK".

## Known limitations

- A classifier trained on WELFake learns that dataset's style and source artefacts; it generalises poorly to modern or differently-styled text. Treat it as a weak signal.
- Evidence quality depends on what Brave returns and which pages are readable (paywalls, bot blocking, JavaScript-only pages). Passage selection is lexical, not semantic.
- The LLM can still misjudge; guards catch unsupported verdicts but not wrong reasoning over real passages. Source tiers are priors, not truth.
- Claims are extracted from the first ~6,000 characters of long articles; up to 3 claims are checked.
- Non-English text is not supported by the classifier (English TF-IDF/stop words).
- Jobs live in memory (lost on restart); history is single-user local storage.
