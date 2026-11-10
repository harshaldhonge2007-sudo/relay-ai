# RELAY AI — Verification & Testing Guide

This guide details all automated tests, manual verification steps, and security validation procedures.

---

## 1. Automated Test Suites (pytest & vitest)

### Backend Pytest Suite (75+ passing tests)
Run all backend tests:
```bash
cd api
pytest -v
```

Verified test suites:
1. `tests/test_acl.py` (36 tests):
   - Server-derived roles from signed HMAC-SHA256 bearer tokens.
   - Rejection of forged, expired, or tampered tokens.
   - Direct access to restricted artifact IDs returns **404 Not Found** (never 403) to prevent existence leakage.
   - Aggregate-only opaque withheld notices.
   - Withheld placeholders for claims depending on restricted evidence.
   - Role coverage across timeline, findings, uncertainty, decisions, and export endpoints.
2. `tests/test_workflow.py` (7 tests):
   - Numbered immutable version snapshots on every edit, approval, rejection, and release.
   - Release gating: release blocked (HTTP 400) when unreviewed claims remain.
   - Permanent exclusion of rejected claims from released snapshots.
   - Side-by-side diff computation between arbitrary versions.
   - Successor receipt acknowledgement bound to exact released version number.
3. `tests/test_verifier.py` (7 tests):
   - Deterministic lexical and entity overlap verification.
   - Extraction and matching of numbers, tickets, env identifiers, code paths, and proper nouns.
   - Downgrade of unsupported sentences to `INFERRED` or `UNKNOWN` with diagnostic reasons.
   - Deliberately unsupported sentence detection.
   - Computed document-level grounding score with method explicitly stated.
4. `tests/test_identity.py` (4 tests):
   - Cross-source fuzzy handle matching (difflib SequenceMatcher).
   - Case-insensitive identity normalization.
   - Disparate handle rejection across threshold boundaries.
5. `tests/test_detectors.py` (10 tests):
   - In-flight work detection (open PRs, unmerged branches).
   - Contradiction detector (Jira Done vs Slack revert).
   - Hidden dependency detector (undocumented cron env vars).
   - Knowledge decay and risk formula calculation.
6. `tests/test_precision_recall.py` (7 tests):
   - Detector precision and recall against ground truth findings.
   - Required evidence citation and quoted text spans.
7. `tests/test_security.py` (4 tests):
   - Prompt injection resistance in Slack messages and Jira tickets.
   - Schema enforcement constraining LLM outputs.
8. `tests/test_parity.py` (new):
   - Every shared route exists in both mock_server and app/main.py.
   - Lead-only actions return 403 for successor and contractor in mock_server.
   - Forged X-Relay-Role header does not grant elevated access.
   - Forged or wrong-secret token does not grant lead access.
   - Contractor completeness response contains no restricted key names.
   - Contractor uncertainty response has no missing_evidence items.
   - Contractor fix-missing call returns 403.

### Frontend Vitest Suite (4 passing tests)
Run frontend component tests:
```bash
cd web
npm test
```
- Evidence drawer: opens with citations, closes on button click or Escape key.
- Role switcher: renders demo roles and updates context without direct role assertion.
- Review controls: approve, reject, edit actions render and trigger callbacks.

---

## 2. Frontend Type Safety & Production Build

Ensure zero TypeScript errors and a clean production build:

```bash
cd web
npx tsc --noEmit
npm run build
```

Expected output:
```
vite v5.4.x building for production...
✓ 49 modules transformed.
dist/index.html                   0.74 kB │ gzip:  0.41 kB
dist/assets/index-....css         28.82 kB │ gzip:  5.90 kB
dist/assets/index-....js         280.05 kB │ gzip: 76.80 kB
✓ built in ~540ms
```

---

## 3. End-to-End Workflow Verification

Launch the demo environment:
```bash
./start_demo.sh --reset
```

### Manual Verification Checklist:
- [ ] **Role Switcher & Demo Auth**: Change role from `Engineering Lead` to `Contractor`. Observe that internal items in `Work Timeline` are withheld, and simulation score drops from 71% to 36%.
- [ ] **Direct ID Access 404**: In browser, attempt to access an internal artifact ID as Contractor -> verify HTTP 404 Not Found is returned (existence not revealed).
- [ ] **Evidence Drawer**: Click any provenance badge (e.g. `VERIFIED`, `STATED`) on any claim -> drawer slides out with cited snippet highlighted. Press `Escape` key -> drawer closes smoothly.
- [ ] **Claim Review & Version History**:
  - Click `Approve` on Claim 1 -> creates v2.
  - Click `Reject` on Claim 2 with reason -> creates v3.
  - Click `Version History` -> inspect immutable snapshots.
  - Click `Compare Diff` -> side-by-side view shows added, modified, and removed claims.
- [ ] **Release Gating**: Attempt to release while claims remain pending -> blocked with explicit warning banner. Review all claims -> release succeeds and creates immutable release snapshot.
- [ ] **Grounding Verifier**: In `Handover Doc`, inspect the Grounding Score badge -> verify score and stated method `[deterministic lexical and entity overlap (offline)]`.
- [ ] **Role-Aware Simulation & Fix Loop**: In `Completeness`:
  - Observe score formula: `weighted sum of found facts / total required facts`.
  - Click `Fix Missing Facts →` -> 2 targeted follow-up questions generated with demo-suggested answers.
  - Review and confirm answers via checkboxes -> click `Submit Confirmed Answers & Re-Score →` -> score recomputed dynamically to 96%.
- [ ] **Successor Receipt Acknowledgement**:
  - Switch role to `Successor (Alex Chen)` -> banner displays acknowledged version binding.
- [ ] **Error Boundary & Reduced Motion**: Verify error boundaries catch corrupted state gracefully and that `prefers-reduced-motion` suppresses transitions.

---

## 4. Known Limitations

- **Demo Authentication (not production auth)**: Uses HMAC-SHA256 tokens. The signing secret is loaded from `RELAY_TOKEN_SECRET` env-var; if unset a random per-process secret is generated (tokens won't survive restarts). Not intended for production multi-tenant identity providers.
- **Fixture Sources**: Slack and Jira datasets are realistic synthetic fixtures for offline stability.
- **Regex Redaction**: Redaction is pattern-based; non-standard or custom-formatted secret strings may not be caught.
- **Simulation Scope**: The onboarding simulation checks required-fact coverage (tested for the demo scope). It does not execute commands or build the repository.
- **Two Distinct Risk Scores**: Knowledge Concentration Risk (`Criticality × L × (1-B) × (1-0.6D)`) and Handover Readiness Score (`weighted_sum(found_facts) / total_weight`) are separate computations. The 71% figure is the Handover Readiness Score, not the Knowledge Concentration Risk.

---

## 5. Failure Cases

Manual verification should confirm the system handles these failure modes correctly:

| Failure | Expected Behaviour |
|---------|-------------------|
| **Empty source file** | Import rejected with schema error; no partial data accepted. |
| **Malformed JSON upload** | HTTP 422 with field-level error (file name + line); server does not crash. |
| **Restricted claim for contractor** | Handover claim text replaced with `"Withheld: requires [level] access"`; evidence IDs cleared to `["[withheld]"]`. |
| **LLM offline / no API key** | Deterministic extraction fallback used; all output labeled `"generated offline (deterministic)"`. |
| **Conflicting sources** | Contradiction surfaced in `/uncertainty` with both artifact IDs and `resolution_status`; never silently merged. |
| **Expired token** | Server returns 401 (or defaults to successor role with no elevated access). Lead-only endpoints return 403. |
| **Unauthorised direct access** | `GET /artifacts/{restricted_id}` returns HTTP **404 Not Found** (never 403) for roles without access — prevents existence leakage. |
| **Fix-missing triggered by contractor** | HTTP 403 returned; contractor must not see question text or missing fact keys. |

---

## 6. Disclosure

- **AI Assistance**: Built with assistance from Google Gemini and Anthropic Claude for pair programming, refactoring, and verification suite expansion.
- **Timing**: All security enhancements, verifiers, workflow gating, and test suites were implemented during the hackathon window.


