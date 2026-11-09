# Sprint Retro — Oct 11, 2024
Attendees: Priya Nair, Alex Chen, Sam Rodriguez

## What Went Well
- Webhook retry queue merged ahead of schedule (SL-456).
- Alex successfully onboarded to Auth Service codebase and completed first PR review.
- Daily reconciliation job running stably without timeout spikes.

## What Didn't Go Well
- Database migration rollback on Oct 14 caused 45-minute ops scramble due to NULL currency values in payments table.
- JWT timeout root cause still not resolved in production: users timing out after 15 minutes instead of 2 hours.
- Lack of written documentation for PostgreSQL 15 upgrade procedure.

## Action Items
- Priya: document two-phase migration strategy (pre-backfill USD before adding NOT NULL) in PR description.
- Sam: investigate Cloudflare TTL override for `/auth/refresh`.
- Alex: take primary reviewer role on PR #47 (Webhook retry exponential backoff).
- Priya: draft PG15 upgrade runbook before departure.
