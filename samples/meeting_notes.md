# Architecture Sync - Payment Gateway V2 Migration

**Date:** 2024-10-14  
**Attendees:** Priya Nair (Lead), Alex Chen, Sam Rodriguez  
**Component:** `services/payments`  

---

## 1. Context & Objectives
We are migrating from Stripe legacy checkout to Payment Intents API v2. This migration introduces idempotency headers across all webhook endpoints to avoid duplicate charges during network partitions.

## 2. Key Operational Runbook
- **How to Run Service Locally:**
  ```bash
  export DATABASE_URL="postgres://localhost:5432/payments_dev"
  export STRIPE_WEBHOOK_SECRET="whsec_sample_key_test_only"
  python -m services.payments.worker
  ```
- **Deployment Procedure:**
  1. Trigger GitHub Actions workflow `deploy-payments.yml` on `main`.
  2. Run database migration script: `alembic upgrade head`.
  3. Verify health probe at `https://payments.internal.net/healthz`.

## 3. Critical Dependencies
- Primary datastore: PostgreSQL 15 on AWS RDS (`payments-prod-db`).
- Cache & rate limiter: Redis Cluster 7.0 (`payments-redis.internal`).
- External APIs: Stripe API (`api.stripe.com/v1`), PagerDuty webhook service.

## 4. On-Call & Escalation
- Primary On-Call: Priya Nair (`@priya` on Slack, rotation team `#payments-oncall`).
- Secondary: Alex Chen (`@alex`).
- Escalation: PagerDuty Service ID `PD-PAY-991`.
