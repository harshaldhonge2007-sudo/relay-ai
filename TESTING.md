# RELAY AI — Verification & Testing Guide

This guide details all automated tests, manual verification steps, and security validation procedures.

---

## 1. Automated Security & ACL Test Suite

Run the dedicated test suite validating role-based access control, confidential item filtering, secret masking, and closed-loop simulation:

```bash
cd api
python3 -m pytest tests/test_acl.py -v
```

### Verified Test Cases:
1. `test_engineering_lead_can_see_all_artifacts`: Proves that `engineering_lead` has complete visibility including confidential files.
2. `test_successor_cannot_see_confidential_artifacts`: Proves that `successor` cannot receive confidential items and receives an opaque withheld notice.
3. `test_contractor_can_only_see_public_artifacts`: Proves that internal team channels are withheld from `contractor`.
4. `test_direct_artifact_access_forbidden_for_unauthorized_role`: Proves that unauthorized direct ID requests (`/artifacts/{id}`) return HTTP 403 Forbidden.
5. `test_secrets_redacted_in_artifact_bodies`: Proves that Stripe keys, AWS credentials, and DB URLs are masked as `[REDACTED]`.
6. `test_claim_level_review_permissions`: Proves that only `engineering_lead` can approve or reject claims with reasons.
7. `test_closed_loop_simulation_lifecycle`: Proves the full 71% → 96% score improvement lifecycle.

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
✓ 48 modules transformed.
dist/index.html                   0.74 kB │ gzip:  0.41 kB
dist/assets/index-....css         28.22 kB │ gzip:  5.77 kB
dist/assets/index-....js         261.10 kB │ gzip: 72.83 kB
✓ built in ~650ms
```

---

## 3. End-to-End Workflow Verification

Launch the demo environment:
```bash
./start_demo.sh --reset
```

### Manual Verification Checklist:
- [ ] **Role Switcher**: Change role from `Engineering Lead` to `Successor (Alex Chen)`. Check that `Work Timeline` displays the access restrictions notice (`🔒 3 item(s) withheld`).
- [ ] **Evidence Drawer**: Click any provenance badge (e.g. `VERIFIED`, `STATED`) or "Inspect in Drawer" on any claim/finding. Verify the drawer slides out with highlighted snippet citations.
- [ ] **Claim Review**: In `Handover Doc` as `Engineering Lead`:
  - Click `Approve` on Claim 1 -> badge changes to `APPROVED`.
  - Click `Reject` on Claim 2 -> enter reason -> badge changes to `REJECTED` with reason displayed.
  - Click `Edit` on Claim 3 -> modify text -> original text preserved in audit history.
- [ ] **Closed-Loop Fix**: In `Completeness`:
  - Observe initial score at **71%** with 2 missing facts.
  - Click `Fix Missing Facts →` -> 2 targeted follow-up questions generated.
  - Click `Resolve & Re-Score Handover →` -> score updates to **96%**, blockers clear, success banner appears.
- [ ] **Successor Receipt Acknowledgement**:
  - In `Handover Doc`, click `Release to Successor`.
  - Switch role to `Successor (Alex Chen)`.
  - Notice the receipt acknowledgement banner -> click `Acknowledge Receipt` -> status updates to `Receipt Acknowledged`.
- [ ] **Uncertainty & Gaps Screen**: Navigate to `/case/case-001/uncertainty` -> verify side-by-side contradiction card between Jira Done and Slack production rollback.
- [ ] **Decisions & Actions Screen**: Navigate to `/case/case-001/decisions` -> verify architectural decision log, First 5 Days continuation checklist, and domain contacts.
- [ ] **Admin & Security**: Navigate to `/case/case-001/admin` -> verify Automated Secrets Redaction panel showing 4 redacted keys with line references.
