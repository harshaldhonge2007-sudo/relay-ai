# RELAY AI — 3-Minute Hackathon Demo Script

> **Scenario**: Priya Nair, Staff Engineer and primary owner of the ShopLedger Payment Processor, is leaving the company.  
> **Judges' Brief**: Prevent Critical Knowledge From Leaving With People.  
> **URL**: http://localhost:5173 (Run `./start_demo.sh --reset`)

---

## 0:00 – 0:30: The Hook & The Problem (Cases & Knowledge Radar)
- **Screen**: Start on `/` (Cases Overview), click into `ShopLedger – Priya Nair Departure` -> `Knowledge Radar`.
- **Narration**:
  > "When a key engineer leaves, handover documents are usually an afterthought—written in haste, full of undocumented assumptions, and missing critical dependencies.
  > Here is Priya Nair, our staff engineer. Using our time-decayed authorship model, RELAY AI immediately detects that Priya holds a **92% knowledge concentration** over the Payment Processor and 88% over Auth Service. If she leaves tomorrow, those components have zero backup."
- **Action**: Hover over the Knowledge Radar breakdown bars (`edits`, `reviews`, `discussion`). Show the criticality weight.

---

## 0:30 – 1:15: Reconstruct & The "Wow" Contradiction (Work Timeline & Findings)
- **Screen**: Click `Work Timeline` then `Findings`.
- **Narration**:
  > "Instead of just asking Priya for a brain-dump, RELAY AI ingests her GitHub commits, Jira tickets, Slack channels, and architecture sync notes. It then runs deterministic cross-source detection.
  > Look at Finding #1: Jira ticket SL-234 is marked 'Done' for fixing JWT timeouts. But RELAY AI cross-references production Slack logs from the same evening showing users were still getting logged out after 15 minutes!
  > It didn't hallucinate that—it caught the discrepancy between ticket status and production reality."
- **Action**: Expand Finding #1. Click **"View Source"** on the evidence item. The **Evidence Drawer** slides in from the right, showing the raw Slack message with the exact snippet highlighted.

---

## 1:15 – 1:55: Permission-Awareness & Role Isolation (Header Demo Control)
- **Screen**: Stay on the screen, switch header dropdown from `Engineering Lead` to `Successor (Alex Chen)`.
- **Narration**:
  > "Now, one of the biggest risks in offboarding is accidental data leakage. An incoming engineer or contractor shouldn't see confidential severance discussions or live rotation keys just because they appeared in a connected tool.
  > Notice what happens when I switch to the **Successor** role. On the Work Timeline, restricted artifacts like the private finance Slack channel and AWS key rotation tickets are immediately withheld.
  > On the backend, direct ID access returns an HTTP 403 Forbidden. The client receives an opaque notice—it doesn't even leak the title or date of the withheld item."
- **Action**: Click `Work Timeline`. Show the notice: `🔒 3 item(s) withheld due to access restrictions`. Switch role to `Contractor` to show internal Slack messages disappearing. Switch back to `Engineering Lead`.

---

## 1:55 – 2:30: The Closed-Loop Breakthrough (Completeness Test)
- **Screen**: Click `Completeness`.
- **Narration**:
  > "How do we know if a handover document is actually good enough for day one? We don't guess—we test it.
  > RELAY AI runs a blind onboarding simulation: an autonomous agent attempts to build, configure, and run the service using only the handover doc.
  > Currently, the score is **71%**. Why? Two required facts are missing: the PostgreSQL 15 upgrade runbook and the JWT timeout root cause.
  > Watch this: I click **'Fix Missing Facts'**. RELAY AI generates targeted interview questions directly addressing the gaps, feeds them into the leaver's interview queue, incorporates the answers, and regenerates the handover."
- **Action**: Click `Fix Missing Facts`. Show the 2 targeted questions. Click `Resolve & Re-Score Handover`.
- **Punchline**: The score smoothly recalculates from **71% → 96%**! Active blockers drop to zero. Show the success banner.

---

## 2:30 – 3:00: Governance, Claim Review & Acknowledgement (Handover Doc)
- **Screen**: Click `Handover Doc`.
- **Narration**:
  > "Finally, the synthesized handover document. Notice three things:
  > First, **provenance badges** on every claim: VERIFIED, STATED, or INFERRED. Clicking any badge opens the underlying source in the evidence drawer.
  > Second, **human-in-the-loop governance**: As Engineering Lead, I can approve, reject with a mandatory reason, or edit any claim inline. All changes are tracked in an immutable audit history.
  > Third, once released, the incoming engineer reviews the document and formally submits a cryptographically timestamped **Receipt Acknowledgement**.
  > RELAY AI turns chaotic offboarding into a traceable, actionable, permission-aware transition."
- **Action**: Click `Approve` on Claim 1. Click `Reject` on Claim 2 and type a reason. Click `Release to Successor`. Switch role to `Successor` and click `Acknowledge Receipt`.

