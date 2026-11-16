# RELAY AI — Production Engineering Roadmap

**Document Version:** 1.0.0-round3  
**Date:** November 15, 2026  
**Git Commit SHA:** `a75bcc9`  

This roadmap outlines the concrete, phased engineering milestones required to transition RELAY AI from an evaluated autonomous prototype into an enterprise-ready knowledge continuity platform.

---

## Phase 1: Enterprise Identity & Live Cloud Connectors (Q1 2025)

### 1.1 Enterprise Single Sign-On (SSO / OIDC)
- **OIDC & SAML 2.0 Integration**: Replace demo token issuance (`/auth/demo-login`) with standards-compliant enterprise identity providers (Okta, Google Workspace, Microsoft Entra ID).
- **Automated Role Mapping**: Map IdP security groups and directory attributes directly to RELAY roles (`engineering_lead`, `successor`, `contractor`).
- **SCIM 2.0 Provisioning**: Automated provisioning and de-provisioning triggered directly by HRIS offboarding workflows (Workday, BambooHR, Rippling).

### 1.2 Production Read-Only Connectors
- **Live Slack Connector**: Approved Slack App utilizing granular, read-only scopes (`channels:history`, `groups:history`). Support explicit channel allowlists and permanent exclusion of 1:1 direct messages.
- **Live Jira Cloud / Atlassian Connector**: OAuth 2.0 3LO connector ingesting sprint boards, issue statuses, custom transition histories, and linked PR references.
- **Webhook Subscriptions**: Real-time webhook ingestion for GitHub pull request events, Jira status transitions, and Slack discussion resolution.

---

## Phase 2: Security Hardening, Encryption & Compliance (Q2 2025)

### 2.1 Encryption at Rest & Key Management
- **Envelope Encryption**: Implement envelope encryption (AES-256-GCM) for all stored artifact bodies, embeddings, and chat transcripts.
- **Customer-Managed Encryption Keys (CMEK)**: Support dedicated per-tenant key management through AWS KMS, GCP Cloud KMS, or HashiCorp Vault.

### 2.2 Retention Policies & Leaver Privacy
- **Configurable Retention Windows**: Enable administrators to establish automated data expiration periods (e.g. 30, 90, or 180 days post-departure).
- **Right to Be Forgotten**: Implement GDPR and CCPA compliant purge workflows enabling leavers to permanently scrub personal identifiers from raw evidence stores while preserving verified architectural decisions.

### 2.3 Tamper-Evident Audit Export
- **Cryptographic Audit Chains**: Anchor audit log entries (`db["audit_log"]`) into a tamper-evident Merkle hash chain.
- **SIEM Streaming**: Real-time audit log streaming to enterprise monitoring systems (Splunk, Datadog, AWS CloudWatch, Elastic).

---

## Phase 3: Multi-Tenancy & High-Availability Scaling (Q3 2025)

### 3.1 Multi-Tenant Data Isolation
- **Row-Level Security (RLS)**: Enforce strict PostgreSQL Row-Level Security policies ensuring total cryptographic and database-level isolation between organizations.
- **Per-Tenant Rate Limiting**: Isolate connector rate limits and LLM inference quotas using Redis Token Bucket limiters.

### 3.2 Asynchronous Ingestion & Distributed Worker Pools
- **Distributed Ingestion Workers**: Transition from in-process FastAPI `BackgroundTasks` to Celery / Temporal workflow orchestration.
- **Incremental Graph Synchronization**: Implement git commit graph diffing to update knowledge loss scores incrementally with sub-second latency.

---

## Phase 4: Scaled Evaluation & Execution Sandboxing (Q4 2025)

### 4.1 Ephemeral Container Execution Sandboxes
- **Dynamic Build Verification**: Upgrade the Onboarding Completeness Test from static required-fact checking to dynamic container execution using ephemeral microVMs (Firecracker / Fly Machines).
- **Automated Task Execution**: Validate that an incoming successor or autonomous agent can execute `docker compose up` and pass test suites solely using credentials and runbooks documented in the handover pack.

### 4.2 Large-Scale Empirical Benchmark
- **Cross-Organization Benchmark**: Expand backtesting from public open-source repositories to participating enterprise engineering teams.
- **Empirical Continuity Lift**: Measure 90-day time-to-first-commit and incident MTTR differences between teams utilizing RELAY AI handovers versus traditional wiki documents.
