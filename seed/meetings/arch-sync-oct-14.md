# Architecture Sync — Oct 14, 2024
Attendees: Priya Nair (Staff Eng), Alex Chen (Sr Eng), Sam Rodriguez (DevOps), CTO

## Agenda
1. Webhook Retry Architecture & Failure Modes
2. PostgreSQL 15 Major Version Upgrade Planning
3. Ownership Handover for Priya's Core Modules

## Decisions

### 1. Webhook Retry Strategy
- Agreed: Use exponential backoff with jitter (not fixed intervals) to avoid thundering herd.
- Dead-letter queue (DLQ) will use AWS SQS with 72-hour retention.
- Alert threshold: 3 consecutive retry failures -> PagerDuty P2 alert.
- Alex Chen takes over implementation and testing for PR #47.

### 2. PostgreSQL 15 Upgrade Planning
- Decision: Defer upgrade rollout to Q1 2025.
- Priya Nair assigned to write comprehensive runbook before departure date.
  *(STATUS: NOT COMPLETED before Priya's final week)*
- Sam Rodriguez to pick up operational responsibility once runbook is outlined.

### 3. Critical Contacts & Ownership
- Auth Service: Alex Chen (Primary)
- Payment Processor: Alex Chen (Incoming Primary), Sam Rodriguez (Secondary)
- Nightly Reports & Ops: Sam Rodriguez (Primary)

