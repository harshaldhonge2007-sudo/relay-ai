# RELAY AI — 5-Minute Evaluation Demo Script

> **Scenario:** Priya Nair, Staff Engineer and primary author of the ShopLedger Payment Processor, is leaving the company.  
> **Evaluation Track:** CodersInPune / Autonomous Systems  
> **Judges' Core Brief:** Prevent Critical Knowledge From Leaving With People.  
> **URL:** http://localhost:5173 (Run `./start_demo.sh --reset`)  
> **Total Time:** Exactly 5 Minutes (300 Seconds)  

---

## 0:00 – 0:45: The Problem & Knowledge Loss Radar
- **Screen:** Start on `/cases`, click into `ShopLedger – Priya Nair Departure` &rarr; `Knowledge Radar` (`/case/case-001/knowledge`).
- **Narration:**
  > "When a key engineer resigns, handover documentation is usually an afterthought—written from memory in their final two weeks, full of undocumented assumptions, and missing critical operational dependencies.
  > Here is Priya Nair, our departing staff engineer. Using our time-decayed authorship model (calibrated with a 180-day line-survival half-life), RELAY AI immediately detects that Priya holds a **92% knowledge concentration** over the Payment Processor and 88% over Auth Service.
  > If Priya walks out the door tomorrow, those mission-critical modules have zero backup."
- **Action:**
  - Hover over the Knowledge Radar breakdown bars (`edits`, `reviews`, `discussion`).
  - Point to the criticality and documentation weights.
  - Note the transparent disclaimer: this is a heuristic score for triage, not an actuarial prediction.

---

## 0:45 – 1:30: Reconstruction & The "Wow" Contradiction
- **Screen:** Click `Work Timeline` (`/case/case-001/timeline`) then `Findings` (`/case/case-001/findings`).
- **Narration:**
  > "Instead of expecting Priya to author a wiki from scratch, RELAY AI automatically ingests her GitHub commits, Jira tickets, Slack channels, and architecture notes, linking them into a chronological evidence graph.
  > It then runs deterministic cross-source detection.
  > Look at Finding #1: Jira ticket SL-234 is marked 'Done' for fixing JWT session timeouts. But RELAY AI cross-references production Slack logs from the exact same evening showing users were still getting logged out after 15 minutes!
  > It didn't hallucinate that finding—it caught the contradiction between ticket status and production reality."
- **Action:**
  - Expand Finding #1. Click **"View Source"** on the evidence link.
  - The **Evidence Drawer** slides in smoothly from the right, highlighting the exact Slack message snippet with timestamp and channel metadata.
  - Close the drawer via `Esc` or the close button (focus returns automatically to the trigger).

---

## 1:30 – 2:30: Live Permission Denial & Existence Privacy (Contractor gets 404)
- **Screen:** Stay on the screen, switch the Demo Role dropdown in the TopBar from `Engineering Lead` to `Contractor (Sam Rodriguez)`.
- **Narration:**
  > "One of the greatest operational hazards during employee transitions is accidental data leakage. An external contractor or incoming junior engineer must not see confidential severance terms, customer PII, or internal credentials just because they appeared in an unmonitored offboarding document.
  > Watch what happens when I switch to the **Contractor** role.
  > First, on the Work Timeline, restricted artifacts like the private finance Slack channel and AWS key rotation tickets are completely withheld. The UI shows an opaque notice: `🔒 3 item(s) withheld due to access restrictions`. It reveals zero titles, authors, or dates."
- **Live Denial Action:**
  - Open terminal or browser DevTools and execute an unauthorized direct ID lookup:
    ```bash
    curl -i http://localhost:8000/cases/case-001/artifacts/art-008 -H "Authorization: Bearer <contractor_token>"
    ```
  - Point directly to the HTTP response status code:
    ```http
    HTTP/1.1 404 Not Found
    {"detail": "Artifact art-008 not found"}
    ```
- **Punchline Narration:**
  > "Notice that response: **HTTP 404 Not Found**.
  > Why not 403 Forbidden? Because a 403 confirms the confidential document exists, allowing hostile attackers to probe and enumerate sensitive files. Returning 404 provides **true existence privacy**. Zero data leakage."
- **Action:** Switch role back to `Engineering Lead (Alex Chen)`.

---

## 2:30 – 3:30: The Closed-Loop Completeness Test (71% → 96% Lift)
- **Screen:** Click `Completeness` in the sidebar (`/case/case-001/completeness`).
- **Narration:**
  > "How do engineering leaders know if a handover pack is actually sufficient for day one? We don't guess—we test it.
  > RELAY AI runs a blind onboarding simulation: an autonomous agent attempts predefined onboarding tasks using only the generated handover pack.
  > Currently, the completeness score is **71%**. Why? Two required technical facts are missing: the PostgreSQL 15 upgrade runbook and the JWT timeout root cause.
  > Now watch our closed feedback loop: I click **'Fix Missing Facts'**. RELAY AI synthesizes targeted interview questions citing the exact missing facts, captures Priya's answers, incorporates them into the pack, and re-runs the simulation."
- **Action:**
  - Click **"Fix Missing Facts"**.
  - Show the 2 targeted questions generated for the leaver.
  - Click **"Resolve & Re-Score Handover"**.
- **Punchline Narration:**
  > "The score recalculates deterministically from **71% → 96%**! Active blockers drop to zero. Measurable continuity, not wishful thinking."

---

## 3:30 – 4:15: Live Failure Case Handled Honestly (LLM Timeout & Offline Fallback)
- **Screen:** Click `Handover` (`/case/case-001/handover`).
- **Narration:**
  > "Every production AI system encounters network latency, rate limits, or external provider outages. What happens when an external LLM fails or the network drops during handover verification?
  > Watch how RELAY AI handles failure defensively and transparently."
- **Action:**
  - Click the **"Verify Handover"** button with simulated provider timeout or offline mode active.
- **Observation:**
  - The system does not crash or return a 500 Internal Server Error.
  - The verifier gracefully defaults to the offline deterministic lexical and entity verifier.
  - The UI displays an explicit provenance badge:
    `Grounding: 82% (deterministic lexical and entity overlap (offline))`
- **Punchline Narration:**
  > "Notice the clear banner: zero hallucination, zero crashes, and zero claims upgraded without hard supporting evidence. When external models fail, RELAY AI fails safely and stays 100% operational offline."

---

## 4:15 – 5:00: Living Handover & Evidence Drift Detection (PR #47 Merge Webhook)
- **Screen:** Click `Project Intelligence` (`/case/case-001/intelligence`), then return to `Handover` (`/case/case-001/handover`).
- **Narration:**
  > "Finally, Round 3 solves the core flaw of static documents: in reality, work doesn't freeze when an engineer departs. Priya had an open draft PR #47 for payment webhook retries.
  > Watch what happens when a live GitHub webhook arrives after the handover has already been approved."
- **Action:**
  - Click **"⚡ Simulate Drift (SL-456)"** in the top action bar.
- **Observation:**
  1. Claim `ho-001` immediately renders the amber badge: `⟳ Evidence changed since approval`.
  2. The **Post-Approval Evidence Drift Detected** diff panel renders the unified git diff:
     ```diff
     - PR #47 State: open (in-flight draft)
     + PR #47 State: closed (merged into main by Alex Chen)
     ```
  3. **Strict Invariant**: Original approved text is **never auto-edited**!
  4. Lead clicks **"Re-Review Queue (1)"**. The modal opens, displaying the preserved original text, the evidence diff, and suggested wording.
  5. Lead clicks **"Amend & Bump to v2"**. The handover version increments from `v1` to `v2`.
  6. Switch role to `Successor (Jordan Taylor)`: An amber **"Update Available"** ribbon appears across the top with a one-click **"Compare v1 vs v2"** button!
- **Closing Statement:**
  > "RELAY AI: Evidence-grounded, permission-safe, and living knowledge continuity. Your project's knowledge shouldn't leave when your people do."
