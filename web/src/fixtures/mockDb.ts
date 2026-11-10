export const MOCK_DB: any = {
  "cases": [
    {
      "id": "case-001",
      "name": "ShopLedger \u2013 Priya Nair Departure",
      "repo_url": "https://github.com/shopledger/api",
      "leaver_person_id": "person-001",
      "status": "interviewing",
      "source_modes": {
        "github": "live",
        "slack": "fixture",
        "jira": "fixture",
        "docs": "fixture",
        "meetings": "fixture"
      },
      "created_at": "2024-10-15T10:00:00Z",
      "updated_at": "2026-11-10T15:13:46.775266+00:00"
    }
  ],
  "people": {
    "person-001": {
      "id": "person-001",
      "display_name": "Priya Nair",
      "identities": [
        {
          "source": "github",
          "id": "priya-nair",
          "handle": "priya-nair",
          "email": "priya@shopledger.io"
        },
        {
          "source": "slack",
          "id": "U12345",
          "handle": "priya",
          "email": "priya@shopledger.io"
        },
        {
          "source": "jira",
          "id": "jira_priya",
          "handle": "Priya Nair",
          "email": "priya@shopledger.io"
        }
      ],
      "is_leaver": true,
      "created_at": "2024-10-15T10:00:00Z"
    },
    "person-002": {
      "id": "person-002",
      "display_name": "Alex Chen",
      "identities": [
        {
          "source": "github",
          "id": "alexc",
          "handle": "alexc",
          "email": "alex@shopledger.io"
        },
        {
          "source": "slack",
          "id": "U67890",
          "handle": "alex",
          "email": "alex@shopledger.io"
        }
      ],
      "is_leaver": false,
      "created_at": "2024-10-15T10:00:00Z"
    },
    "person-003": {
      "id": "person-003",
      "display_name": "Sam Rodriguez",
      "identities": [
        {
          "source": "github",
          "id": "samr",
          "handle": "samr",
          "email": "sam@shopledger.io"
        },
        {
          "source": "slack",
          "id": "U11111",
          "handle": "sam",
          "email": "sam@shopledger.io"
        }
      ],
      "is_leaver": false,
      "created_at": "2024-10-15T10:00:00Z"
    }
  },
  "components": [
    {
      "id": "comp-001",
      "case_id": "case-001",
      "name": "Auth Service",
      "path_globs": "[\"src/auth/**\", \"src/middleware/auth*\"]",
      "criticality": 0.95
    },
    {
      "id": "comp-002",
      "case_id": "case-001",
      "name": "Payment Processor",
      "path_globs": "[\"src/payments/**\", \"db/migrations/**\"]",
      "criticality": 0.9
    },
    {
      "id": "comp-003",
      "case_id": "case-001",
      "name": "Reporting Module",
      "path_globs": "[\"src/reports/**\", \"scripts/nightly*\"]",
      "criticality": 0.65
    }
  ],
  "knowledge_scores": [
    {
      "id": "ks-001",
      "component_id": "comp-001",
      "person_id": "person-001",
      "score": 0.88,
      "breakdown": {
        "edits": 0.45,
        "reviews": 0.25,
        "discussion": 0.18
      }
    },
    {
      "id": "ks-002",
      "component_id": "comp-001",
      "person_id": "person-002",
      "score": 0.42,
      "breakdown": {
        "edits": 0.2,
        "reviews": 0.18,
        "discussion": 0.04
      }
    },
    {
      "id": "ks-003",
      "component_id": "comp-001",
      "person_id": "person-003",
      "score": 0.15,
      "breakdown": {
        "edits": 0.05,
        "reviews": 0.08,
        "discussion": 0.02
      }
    },
    {
      "id": "ks-004",
      "component_id": "comp-002",
      "person_id": "person-001",
      "score": 0.92,
      "breakdown": {
        "edits": 0.6,
        "reviews": 0.2,
        "discussion": 0.12
      }
    },
    {
      "id": "ks-005",
      "component_id": "comp-002",
      "person_id": "person-002",
      "score": 0.28,
      "breakdown": {
        "edits": 0.15,
        "reviews": 0.1,
        "discussion": 0.03
      }
    },
    {
      "id": "ks-006",
      "component_id": "comp-002",
      "person_id": "person-003",
      "score": 0.1,
      "breakdown": {
        "edits": 0.03,
        "reviews": 0.06,
        "discussion": 0.01
      }
    },
    {
      "id": "ks-007",
      "component_id": "comp-003",
      "person_id": "person-001",
      "score": 0.78,
      "breakdown": {
        "edits": 0.5,
        "reviews": 0.15,
        "discussion": 0.13
      }
    },
    {
      "id": "ks-008",
      "component_id": "comp-003",
      "person_id": "person-002",
      "score": 0.12,
      "breakdown": {
        "edits": 0.05,
        "reviews": 0.05,
        "discussion": 0.02
      }
    }
  ],
  "artifacts": [
    {
      "id": "art-001",
      "case_id": "case-001",
      "source": "github",
      "source_mode": "live",
      "type": "pull_request",
      "external_id": "PR #47",
      "author_id": "person-001",
      "occurred_at": "2024-10-16T09:00:00Z",
      "url": "https://github.com/shopledger/api/pull/47",
      "title": "WIP: Webhook retry logic with exponential backoff (SL-456)",
      "body": "## Summary\nIn-progress implementation of exponential backoff retry for payment webhook delivery.\n\n## Status\n- [x] Retry queue implementation\n- [x] Backoff calculator\n- [ ] Integration tests\n- [ ] Dead-letter queue handling\n\nAssigned to Priya Nair. Currently blocking payment gateway resilience.",
      "raw": {
        "number": 47,
        "state": "open",
        "draft": true
      },
      "acl": {
        "visibility": "public",
        "allowed_roles": [
          "engineering_lead",
          "successor",
          "contractor"
        ]
      },
      "created_at": "2024-10-16T09:00:00Z"
    },
    {
      "id": "art-002",
      "case_id": "case-001",
      "source": "slack",
      "source_mode": "fixture",
      "type": "slack_message",
      "external_id": "msg_004",
      "author_id": "person-001",
      "occurred_at": "2024-10-14T19:00:00Z",
      "url": "https://slack.com/archives/C_ENG/p1728604800",
      "title": "Slack: Migration reverted in #engineering",
      "body": "Had to revert the database migration from October 14. It was causing foreign key constraint violations in the payments table. Created a new branch with a fixed version that backfills currency_code before adding NOT NULL.",
      "raw": {
        "channel": "C_ENG"
      },
      "acl": {
        "visibility": "internal",
        "allowed_roles": [
          "engineering_lead",
          "successor"
        ]
      },
      "created_at": "2024-10-14T19:00:00Z"
    },
    {
      "id": "art-003",
      "case_id": "case-001",
      "source": "jira",
      "source_mode": "fixture",
      "type": "jira_ticket",
      "external_id": "SL-234",
      "author_id": "person-001",
      "occurred_at": "2024-10-08T15:30:00Z",
      "url": "https://jira.shopledger.io/browse/SL-234",
      "title": "Fix JWT token expiry configuration [Status: Done]",
      "body": "Issue: Users experiencing premature timeouts after 15 minutes instead of 2 hours.\nResolution: Updated auth service config to 7200s.\nResolved Date: 2024-10-08T15:30:00Z",
      "raw": {
        "key": "SL-234",
        "status": "Done"
      },
      "acl": {
        "visibility": "public",
        "allowed_roles": [
          "engineering_lead",
          "successor",
          "contractor"
        ]
      },
      "created_at": "2024-10-08T15:30:00Z"
    },
    {
      "id": "art-004",
      "case_id": "case-001",
      "source": "slack",
      "source_mode": "fixture",
      "type": "slack_message",
      "external_id": "msg_001",
      "author_id": "person-001",
      "occurred_at": "2024-10-08T18:00:00Z",
      "url": "https://slack.com/archives/C_ENG/p1728345600",
      "title": "Slack: JWT token expiry issue still occurring in prod",
      "body": "The JWT token expiry issue is still happening in production. Users are getting logged out after 15 minutes instead of the configured 2 hours. Looks like downstream gateway cache is overriding the header.",
      "raw": {
        "channel": "C_ENG"
      },
      "acl": {
        "visibility": "internal",
        "allowed_roles": [
          "engineering_lead",
          "successor"
        ]
      },
      "created_at": "2024-10-08T18:00:00Z"
    },
    {
      "id": "art-005",
      "case_id": "case-001",
      "source": "slack",
      "source_mode": "fixture",
      "type": "slack_message",
      "external_id": "msg_007",
      "author_id": "person-001",
      "occurred_at": "2024-10-15T07:00:00Z",
      "url": "https://slack.com/archives/C_OPS/p1729036800",
      "title": "Slack: Cron setup note in #ops",
      "body": "Reminder: the nightly report generation job runs via cron at 2 AM UTC. It depends on REPORT_BUCKET_NAME and SMTP_RELAY_HOST environment variables.",
      "raw": {
        "channel": "C_OPS"
      },
      "acl": {
        "visibility": "internal",
        "allowed_roles": [
          "engineering_lead",
          "successor"
        ]
      },
      "created_at": "2024-10-15T07:00:00Z"
    },
    {
      "id": "art-006",
      "case_id": "case-001",
      "source": "github",
      "source_mode": "live",
      "type": "commit",
      "external_id": "c3d4e5f",
      "author_id": "person-001",
      "occurred_at": "2024-10-14T18:30:00Z",
      "url": "https://github.com/shopledger/api/commit/c3d4e5f",
      "title": "Revert: Add currency_code column to payments table",
      "body": "Revert 'Add currency_code column to payments table'\n\nForeign key constraint violations on existing rows. Fixed version pending on feature/currency-fix branch.",
      "raw": {
        "sha": "c3d4e5f",
        "files": [
          "db/migrations/20241014_add_currency_code.sql"
        ]
      },
      "acl": {
        "visibility": "public",
        "allowed_roles": [
          "engineering_lead",
          "successor",
          "contractor"
        ]
      },
      "created_at": "2024-10-14T18:30:00Z"
    },
    {
      "id": "art-007",
      "case_id": "case-001",
      "source": "docs",
      "source_mode": "fixture",
      "type": "document",
      "external_id": "README.md",
      "author_id": null,
      "occurred_at": "2024-09-01T00:00:00Z",
      "url": "https://github.com/shopledger/api/blob/main/README.md",
      "title": "README.md",
      "body": "# ShopLedger API\n\nPayment processing backend.\n\n## Environment Variables\n- DATABASE_URL\n- JWT_SECRET\n- STRIPE_API_KEY\n*(Note: Missing REPORT_BUCKET_NAME and SMTP_RELAY_HOST)*",
      "raw": {
        "path": "README.md"
      },
      "acl": {
        "visibility": "public",
        "allowed_roles": [
          "engineering_lead",
          "successor",
          "contractor"
        ]
      },
      "created_at": "2024-09-01T00:00:00Z"
    },
    {
      "id": "art-008",
      "case_id": "case-001",
      "source": "slack",
      "source_mode": "fixture",
      "type": "slack_message",
      "external_id": "msg_fin_001",
      "author_id": "person-001",
      "occurred_at": "2024-10-10T14:00:00Z",
      "url": "https://slack.com/archives/C_FINANCE/p1728565200",
      "title": "Slack: Severance discussion in #finance-private",
      "body": "Re: Priya's severance package \u2014 the accelerated vesting clause applies given the company-initiated departure. HR has confirmed the Q4 payout schedule.",
      "raw": {
        "channel": "C_FINANCE_PRIVATE"
      },
      "acl": {
        "visibility": "confidential",
        "allowed_roles": [
          "engineering_lead"
        ]
      },
      "created_at": "2024-10-10T14:00:00Z"
    },
    {
      "id": "art-009",
      "case_id": "case-001",
      "source": "jira",
      "source_mode": "fixture",
      "type": "jira_ticket",
      "external_id": "PAY-SEC-001",
      "author_id": "person-001",
      "occurred_at": "2024-10-12T11:00:00Z",
      "url": "https://jira.shopledger.io/browse/PAY-SEC-001",
      "title": "PAY-SEC-001: Payment credential rotation (Restricted)",
      "body": "Rotate Stripe live keys after Priya's departure. Steps:\n1. Generate new sk_live key in Stripe dashboard\n2. Update AWS Secrets Manager /prod/shopledger/stripe_key\n3. Trigger canary deployment to verify\n4. Revoke old key after 48h\nOwner: DevOps team",
      "raw": {
        "key": "PAY-SEC-001",
        "status": "Open",
        "project": "PAY-SEC"
      },
      "acl": {
        "visibility": "restricted",
        "allowed_roles": [
          "engineering_lead"
        ]
      },
      "created_at": "2024-10-12T11:00:00Z"
    },
    {
      "id": "art-010",
      "case_id": "case-001",
      "source": "docs",
      "source_mode": "fixture",
      "type": "document",
      "external_id": "ENV_KEYS.md",
      "author_id": "person-001",
      "occurred_at": "2024-10-01T00:00:00Z",
      "url": "https://github.com/shopledger/api/blob/main/ENV_KEYS.md",
      "title": "ENV_KEYS.md (Confidential)",
      "body": "# Production Credentials\n\nSTRIPE_API_KEY=sk_live_[REDACTED]\nAWS_SECRET_ACCESS_KEY=[REDACTED]\nJWT_SECRET=[REDACTED]\nSMTP_RELAY_HOST=smtp.sendgrid.net\nREPORT_BUCKET_NAME=shopledger-reports-prod\nDATABASE_URL=[REDACTED]\n\n# Rotation due: 2024-11-01",
      "raw": {
        "path": "ENV_KEYS.md"
      },
      "acl": {
        "visibility": "confidential",
        "allowed_roles": [
          "engineering_lead"
        ]
      },
      "created_at": "2024-10-01T00:00:00Z"
    },
    {
      "id": "art-011",
      "case_id": "case-001",
      "source": "meetings",
      "source_mode": "fixture",
      "type": "document",
      "external_id": "sprint-retro-oct-2024.md",
      "author_id": "person-001",
      "occurred_at": "2024-10-11T14:00:00Z",
      "url": null,
      "title": "Sprint Retro \u2013 Oct 11, 2024",
      "body": "## What Went Well\n- Webhook retry queue merged ahead of schedule\n- Alex successfully onboarded to Auth Service codebase\n\n## What Didn't Go Well\n- Database migration rollback caused 45-minute ops scramble\n- JWT timeout root cause still not fully confirmed (gateway vs. config)\n\n## Action Items\n- Priya: document two-phase migration strategy in PR description\n- Sam: investigate Cloudflare TTL override for /auth/refresh\n- Alex: take primary reviewer role on PR #47",
      "raw": {
        "path": "seed/meetings/sprint-retro-oct-2024.md"
      },
      "acl": {
        "visibility": "internal",
        "allowed_roles": [
          "engineering_lead",
          "successor"
        ]
      },
      "created_at": "2024-10-11T14:00:00Z"
    },
    {
      "id": "art-012",
      "case_id": "case-001",
      "source": "meetings",
      "source_mode": "fixture",
      "type": "document",
      "external_id": "arch-sync-oct-14.md",
      "author_id": "person-001",
      "occurred_at": "2024-10-14T10:00:00Z",
      "url": null,
      "title": "Architecture Sync \u2013 Oct 14, 2024",
      "body": "## Attendees: Priya, Alex, Sam, CTO\n\n## Decision: Webhook Retry Strategy\n- Agreed on exponential backoff with jitter (not fixed intervals)\n- Dead-letter queue will use SQS with 72h retention\n- Alert threshold: 3 consecutive failures -> PagerDuty P2\n\n## Decision: PostgreSQL 15 Upgrade\n- Timeline: Q1 2025\n- Priya to draft runbook before departure (STATUS: NOT COMPLETED)\n- Sam to pick up ownership\n\n## Open Questions\n- Who owns the nightly SMTP relay configuration going forward?",
      "raw": {
        "path": "seed/meetings/arch-sync-oct-14.md"
      },
      "acl": {
        "visibility": "internal",
        "allowed_roles": [
          "engineering_lead",
          "successor"
        ]
      },
      "created_at": "2024-10-14T10:00:00Z"
    },
    {
      "id": "art-013",
      "case_id": "case-001",
      "source": "docs",
      "source_mode": "live",
      "type": "document",
      "external_id": "ARCHITECTURE.md",
      "author_id": "person-001",
      "occurred_at": "2024-10-15T12:00:00Z",
      "url": "https://github.com/shopledger/api/blob/main/docs/ARCHITECTURE.md",
      "title": "Architecture & Subsystem Ownership",
      "body": "Payment Processor Subsystem Handover. Priya was primary owner (92% knowledge share) of Payment Processor. Primary contact during handover: Alex Chen. Critical services: Stripe Webhook Ingestion, Daily Settlement Reconciliation, and Multi-Currency Ledger.",
      "raw": {
        "path": "docs/ARCHITECTURE.md"
      },
      "acl": {
        "visibility": "internal",
        "allowed_roles": [
          "engineering_lead",
          "successor",
          "contractor"
        ]
      },
      "created_at": "2024-10-15T12:00:00Z"
    }
  ],
  "findings": [
    {
      "id": "find-001",
      "case_id": "case-001",
      "kind": "contradiction",
      "severity": 0.92,
      "confidence": 0.95,
      "title": "SL-234 marked Done on Jira, but JWT timeout still broken in prod",
      "summary": "Jira ticket SL-234 shows status Done, but Slack messages on the same date confirm users are still being logged out after 15 minutes. Downstream API gateway is likely overriding the TTL headers.",
      "evidence": [
        {
          "artifact_id": "art-003",
          "span": "Jira SL-234 status: Done",
          "role": "ticket"
        },
        {
          "artifact_id": "art-004",
          "span": "Slack: users getting logged out after 15 min",
          "role": "contradiction"
        }
      ],
      "status": "open",
      "created_at": "2024-10-16T11:00:00Z",
      "updated_at": "2024-10-16T11:00:00Z"
    },
    {
      "id": "find-002",
      "case_id": "case-001",
      "kind": "contradiction",
      "severity": 0.88,
      "confidence": 0.9,
      "title": "SL-287 marked Done, but migration was reverted same day",
      "summary": "Payments table currency migration was marked completed in Jira but was reverted on GitHub after throwing FK constraint errors on production data. Fixed branch unmerged.",
      "evidence": [
        {
          "artifact_id": "art-002",
          "span": "Slack: Had to revert the database migration",
          "role": "revert"
        },
        {
          "artifact_id": "art-006",
          "span": "Commit c3d4e5f: Revert migration",
          "role": "commit"
        }
      ],
      "status": "open",
      "created_at": "2024-10-16T11:05:00Z",
      "updated_at": "2024-10-16T11:05:00Z"
    },
    {
      "id": "find-003",
      "case_id": "case-001",
      "kind": "inflight",
      "severity": 0.82,
      "confidence": 1.0,
      "title": "PR #47: Webhook retry logic unmerged and missing test suite",
      "summary": "Exponential backoff logic is implemented in draft PR #47, but dead-letter queue and integration tests are unfinished. Sole author is Priya.",
      "evidence": [
        {
          "artifact_id": "art-001",
          "span": "PR #47 draft state, missing tests",
          "role": "open_pr"
        }
      ],
      "status": "open",
      "created_at": "2024-10-16T11:10:00Z",
      "updated_at": "2024-10-16T11:10:00Z"
    },
    {
      "id": "find-004",
      "case_id": "case-001",
      "kind": "hidden_dependency",
      "severity": 0.78,
      "confidence": 0.95,
      "title": "Nightly report cron job depends on undocumented env vars",
      "summary": "Cron job scheduled at 02:00 UTC requires REPORT_BUCKET_NAME and SMTP_RELAY_HOST. Neither appears in README.md or Docker Compose. Silently fails if missing.",
      "evidence": [
        {
          "artifact_id": "art-005",
          "span": "Slack: depends on REPORT_BUCKET_NAME and SMTP_RELAY_HOST",
          "role": "source"
        },
        {
          "artifact_id": "art-007",
          "span": "README.md does not list these vars",
          "role": "docs"
        }
      ],
      "status": "open",
      "created_at": "2024-10-16T11:15:00Z",
      "updated_at": "2024-10-16T11:15:00Z"
    },
    {
      "id": "find-005",
      "case_id": "case-001",
      "kind": "undocumented_decision",
      "severity": 0.65,
      "confidence": 0.85,
      "title": "Currency code backfill strategy only exists in Slack thread",
      "summary": "Priya planned a two-phase rollout to backfill default currency before applying the constraint, but this architecture decision was never added to docs or PR description.",
      "evidence": [
        {
          "artifact_id": "art-002",
          "span": "Slack: fixed version ready",
          "role": "chat"
        }
      ],
      "status": "open",
      "created_at": "2024-10-16T11:20:00Z",
      "updated_at": "2024-10-16T11:20:00Z"
    },
    {
      "id": "find-006",
      "case_id": "case-001",
      "kind": "undocumented_decision",
      "severity": 0.72,
      "confidence": 0.8,
      "title": "PostgreSQL 15 upgrade runbook not completed before departure",
      "summary": "Architecture sync notes confirm Priya was assigned to draft the PG15 upgrade runbook before leaving. Meeting notes show this was not completed. Sam Rodriguez picked up ownership without written procedures.",
      "evidence": [
        {
          "artifact_id": "art-012",
          "span": "Priya to draft runbook before departure (STATUS: NOT COMPLETED)",
          "role": "meeting_note"
        }
      ],
      "status": "open",
      "created_at": "2024-10-16T11:25:00Z",
      "updated_at": "2024-10-16T11:25:00Z"
    }
  ],
  "questions": [
    {
      "id": "q-001",
      "case_id": "case-001",
      "finding_id": "find-001",
      "text": "SL-234 is marked Done on Jira, but users are still timing out after 15 minutes. What downstream cache or gateway setting is overriding the 2-hour TTL?",
      "evidence": [
        {
          "artifact_id": "art-003"
        },
        {
          "artifact_id": "art-004"
        }
      ],
      "priority": 0.95,
      "status": "answered",
      "answer": "The Cloudflare Page Rule for /auth/* is enforcing a 15-minute TTL override. I didn't update it when I changed the backend config. The fix is to add a specific rule for /auth/refresh with TTL=0 (bypass). I've documented the Cloudflare dashboard path in the handover.",
      "answer_provenance": "stated",
      "created_at": "2024-10-16T11:30:00Z"
    },
    {
      "id": "q-002",
      "case_id": "case-001",
      "finding_id": "find-002",
      "text": "The currency_code migration was reverted after throwing FK errors. Where is the fixed branch, and what are the exact steps to backfill existing rows before running the migration?",
      "evidence": [
        {
          "artifact_id": "art-002"
        },
        {
          "artifact_id": "art-006"
        }
      ],
      "priority": 0.9,
      "status": "answered",
      "answer": "The fixed branch is feature/currency-fix. Run: UPDATE payments SET currency_code = 'USD' WHERE currency_code IS NULL; first, then apply the migration. The script is in db/scripts/backfill_currency.sql.",
      "answer_provenance": "stated",
      "created_at": "2024-10-16T11:30:00Z"
    },
    {
      "id": "q-003",
      "case_id": "case-001",
      "finding_id": "find-003",
      "text": "PR #47 implements webhook retry logic with exponential backoff. What remains to be done before merging, and how should dead-lettered events be alerted?",
      "evidence": [
        {
          "artifact_id": "art-001"
        }
      ],
      "priority": 0.85,
      "status": "answered",
      "answer": "Three things remain: (1) integration test suite for the retry queue, (2) SQS dead-letter queue configuration with 72h retention, (3) PagerDuty alert at 3 consecutive failures (P2 severity). The SQS ARN is in AWS SSM at /prod/shopledger/sqs/webhook-dlq.",
      "answer_provenance": "stated",
      "created_at": "2024-10-16T11:30:00Z"
    },
    {
      "id": "q-004",
      "case_id": "case-001",
      "finding_id": "find-004",
      "text": "The 2 AM reporting cron requires REPORT_BUCKET_NAME and SMTP_RELAY_HOST. Where are the production credentials stored, and who owns the SMTP relay access?",
      "evidence": [
        {
          "artifact_id": "art-005"
        }
      ],
      "priority": 0.8,
      "status": "answered",
      "answer": "REPORT_BUCKET_NAME=shopledger-reports-prod, SMTP_RELAY_HOST=smtp.sendgrid.net. Both are in AWS Secrets Manager under /prod/shopledger/reports. SendGrid account access is owned by Sam Rodriguez (ops@shopledger.io).",
      "answer_provenance": "stated",
      "created_at": "2024-10-16T11:30:00Z"
    },
    {
      "id": "q-005",
      "case_id": "case-001",
      "finding_id": "find-005",
      "text": "Are there any other scheduled jobs or private keys on your local machine that haven't been transferred to 1Password or AWS Secrets Manager?",
      "evidence": [],
      "priority": 0.7,
      "status": "unanswered",
      "answer": null,
      "answer_provenance": null,
      "created_at": "2024-10-16T11:30:00Z"
    }
  ],
  "handover": [
    {
      "id": "ho-001",
      "case_id": "case-001",
      "section": "In-Flight Work",
      "text": "**Payment Webhook Retry Logic (SL-456 / PR #47)**\nPR #47 contains the exponential backoff queue. Remaining items: integration test suite and SQS dead-letter queue with 72h retention. PagerDuty P2 alert at 3 consecutive failures. Ready for Alex Chen to take over review and complete deployment. SQS ARN in AWS SSM at /prod/shopledger/sqs/webhook-dlq.",
      "evidence_ids": [
        "art-001",
        "art-012",
        "q-003"
      ],
      "provenance": "inferred",
      "confidence": 0.95,
      "status": "draft",
      "claim_status": "pending",
      "history": [],
      "rejection_reason": null,
      "original_text": null,
      "created_at": "2024-10-16T12:00:00Z"
    },
    {
      "id": "ho-002",
      "case_id": "case-001",
      "section": "Pending Deployments",
      "text": "**Currency Code Schema Migration (SL-287)**\nThe original migration failed due to existing rows lacking currency defaults. Fixed migration branch `feature/currency-fix` contains a pre-migration script: `UPDATE payments SET currency_code = 'USD' WHERE currency_code IS NULL;` before adding `NOT NULL` constraint. Script path: db/scripts/backfill_currency.sql.",
      "evidence_ids": [
        "art-002",
        "art-006",
        "q-002"
      ],
      "provenance": "stated",
      "confidence": 0.92,
      "status": "draft",
      "claim_status": "pending",
      "history": [],
      "rejection_reason": null,
      "original_text": null,
      "created_at": "2024-10-16T12:00:00Z"
    },
    {
      "id": "ho-003",
      "case_id": "case-001",
      "section": "Known Production Issues",
      "text": "**Premature JWT Session Timeouts (SL-234)**\nThough the backend token configuration was increased to 2 hours, Cloudflare reverse proxy edge rules enforce a 15-minute connection TTL. Fix: add a Cloudflare Page Rule for `/auth/refresh` with TTL=0 (bypass cache). Dashboard path: Cloudflare > shopledger.io > Rules > Page Rules.",
      "evidence_ids": [
        "art-003",
        "art-004",
        "q-001"
      ],
      "provenance": "verified",
      "confidence": 0.9,
      "status": "draft",
      "claim_status": "pending",
      "history": [],
      "rejection_reason": null,
      "original_text": null,
      "created_at": "2024-10-16T12:00:00Z"
    },
    {
      "id": "ho-004",
      "case_id": "case-001",
      "section": "Environment & Ops",
      "text": "**Nightly Cron Prerequisites**\nThe nightly accounting ledger report (runs 02:00 UTC) requires:\n- `REPORT_BUCKET_NAME=shopledger-reports-prod`\n- `SMTP_RELAY_HOST=smtp.sendgrid.net`\nCredentials stored in AWS Secrets Manager under `/prod/shopledger/reports`. SendGrid ownership: Sam Rodriguez (ops@shopledger.io).",
      "evidence_ids": [
        "art-005",
        "art-007",
        "q-004"
      ],
      "provenance": "stated",
      "confidence": 0.98,
      "status": "draft",
      "claim_status": "approved",
      "history": [
        {
          "actor": "Alex Chen (Engineering Lead)",
          "action": "approved",
          "timestamp": "2024-10-16T13:00:00Z",
          "note": null
        }
      ],
      "rejection_reason": null,
      "original_text": null,
      "created_at": "2024-10-16T12:00:00Z"
    },
    {
      "id": "ho-005",
      "case_id": "case-001",
      "section": "Architecture & Ownership",
      "text": "**Payment Processor Subsystem Handover**\nPriya was primary owner (92% knowledge share). Primary contact during handover: Alex Chen. Critical services: Stripe Webhook Ingestion, Daily Settlement Reconciliation, and Multi-Currency Ledger.",
      "evidence_ids": [
        "art-013",
        "art-011",
        "art-012"
      ],
      "provenance": "verified",
      "confidence": 0.96,
      "status": "draft",
      "claim_status": "pending",
      "history": [],
      "rejection_reason": null,
      "original_text": null,
      "created_at": "2024-10-16T12:00:00Z"
    }
  ],
  "completeness": {
    "task": "Simulated blind developer setup: Clone repo, run test suite, and trigger payment webhook worker",
    "score": 0.71,
    "mean": 0.69,
    "spread": 0.08,
    "runs": [
      0.65,
      0.71,
      0.72
    ],
    "phase": "initial",
    "required_facts": [
      {
        "kind": "env_var",
        "key": "DATABASE_URL",
        "source": "README.md",
        "status": "found",
        "weight": 0.12,
        "visibility": "public"
      },
      {
        "kind": "env_var",
        "key": "JWT_SECRET",
        "source": "README.md",
        "status": "found",
        "weight": 0.12,
        "visibility": "public"
      },
      {
        "kind": "env_var",
        "key": "STRIPE_API_KEY",
        "source": "README.md",
        "status": "found",
        "weight": 0.12,
        "visibility": "public"
      },
      {
        "kind": "env_var",
        "key": "REPORT_BUCKET_NAME",
        "source": "Handover Item #4 (Slack)",
        "status": "found",
        "weight": 0.1,
        "visibility": "internal"
      },
      {
        "kind": "env_var",
        "key": "SMTP_RELAY_HOST",
        "source": "Handover Item #4 (Slack)",
        "status": "found",
        "weight": 0.1,
        "visibility": "internal"
      },
      {
        "kind": "migration",
        "key": "currency_code_backfill",
        "source": "Handover Item #2 (Jira/Git)",
        "status": "found",
        "weight": 0.15,
        "visibility": "internal"
      },
      {
        "kind": "documentation",
        "key": "pg15_upgrade_runbook",
        "source": "Not documented",
        "status": "missing",
        "weight": 0.15,
        "visibility": "internal"
      },
      {
        "kind": "documentation",
        "key": "jwt_timeout_root_cause",
        "source": "Not documented",
        "status": "missing",
        "weight": 0.14,
        "visibility": "internal"
      }
    ],
    "blockers": [
      "PostgreSQL 15 upgrade runbook (SL-412) is missing from repository documentation.",
      "JWT timeout root cause (Cloudflare gateway) is not explicitly documented in handover."
    ],
    "grounding_score": 0.82
  },
  "admin": {
    "sources": [
      {
        "source": "GitHub",
        "status": "Connected & Synced (Simulated)",
        "last_synced": "12 minutes ago",
        "items": "12 commits, 2 PRs, 1 branch"
      },
      {
        "source": "Slack",
        "status": "Connected & Synced (Simulated)",
        "last_synced": "20 minutes ago",
        "items": "8 channels, 34 messages"
      },
      {
        "source": "Jira",
        "status": "Connected & Synced (Simulated)",
        "last_synced": "15 minutes ago",
        "items": "5 tickets, 12 comments"
      },
      {
        "source": "Docs",
        "status": "Indexed (Simulated)",
        "last_synced": "1 hour ago",
        "items": "README.md, API.md, ENV_KEYS.md, 14 markdown files"
      },
      {
        "source": "Meeting Notes",
        "status": "Indexed (Simulated)",
        "last_synced": "2 hours ago",
        "items": "2 meeting transcripts"
      }
    ],
    "identity_mappings": [
      {
        "name": "Priya Nair (Leaver)",
        "github": "priya-nair",
        "slack": "@priya (U12345)",
        "jira": "jira_priya",
        "confidence": "100% (Auto-Unified)"
      },
      {
        "name": "Alex Chen",
        "github": "alexc",
        "slack": "@alex (U67890)",
        "jira": "alex@shopledger.io",
        "confidence": "100% (Auto-Unified)"
      },
      {
        "name": "Sam Rodriguez",
        "github": "samr",
        "slack": "@sam (U11111)",
        "jira": "sam@shopledger.io",
        "confidence": "100% (Auto-Unified)"
      }
    ],
    "audit_log": [
      {
        "time": "Just now",
        "actor": "System",
        "action": "Calculated knowledge radar distribution across 3 components"
      },
      {
        "time": "2 hours ago",
        "actor": "System",
        "action": "Extracted 6 gap findings and generated interview questions"
      },
      {
        "time": "5 hours ago",
        "actor": "Priya Nair",
        "action": "Submitted clarification answer on currency_code migration"
      },
      {
        "time": "Yesterday",
        "actor": "Alex Chen (Engineering Lead)",
        "action": "Approved handover item ho-004: Nightly Cron Prerequisites"
      },
      {
        "time": "Yesterday",
        "actor": "Alex Chen (Engineering Lead)",
        "action": "Created case: ShopLedger \u2013 Priya Nair Departure"
      }
    ],
    "redactions": {
      "count": 4,
      "locations": [
        {
          "artifact_id": "art-010",
          "type": "stripe_key",
          "location": "ENV_KEYS.md:line 3"
        },
        {
          "artifact_id": "art-010",
          "type": "aws_secret",
          "location": "ENV_KEYS.md:line 4"
        },
        {
          "artifact_id": "art-010",
          "type": "jwt_secret",
          "location": "ENV_KEYS.md:line 5"
        },
        {
          "artifact_id": "art-010",
          "type": "database_url",
          "location": "ENV_KEYS.md:line 8"
        }
      ],
      "policy": "Secrets and credentials are automatically redacted before storage and display. Only masked values are stored."
    }
  },
  "uncertainty": {
    "missing_evidence": [
      {
        "key": "pg15_upgrade_runbook",
        "description": "PostgreSQL 15 upgrade runbook was assigned to Priya (Architecture Sync, Oct 14) but was never completed or committed.",
        "suggested_action": "Ask Priya directly in the interview, or assign Sam Rodriguez to draft from scratch."
      },
      {
        "key": "jwt_timeout_root_cause",
        "description": "Exact Cloudflare rule path not documented. The finding is confirmed but specific configuration steps are only inferred from Priya's interview answer.",
        "suggested_action": "Verify in Cloudflare dashboard: Rules > Page Rules for /auth/refresh. Document and add to handover."
      },
      {
        "key": "smtp_relay_owner_confirmed",
        "description": "Sam Rodriguez listed as SMTP relay owner, but this was stated by Priya \u2014 not confirmed by Sam.",
        "suggested_action": "Confirm with Sam Rodriguez directly."
      }
    ],
    "conflicts": [
      {
        "id": "conflict-001",
        "source_a": {
          "artifact_id": "art-003",
          "label": "Jira SL-234: Done (2024-10-08)",
          "span": "Resolution: Updated auth service config to 7200s."
        },
        "source_b": {
          "artifact_id": "art-004",
          "label": "Slack #engineering (2024-10-08)",
          "span": "The JWT token expiry issue is still happening in production. Users are getting logged out after 15 minutes."
        },
        "description": "Jira ticket SL-234 is marked 'Done' but Slack messages on the same day confirm the issue persisted in production.",
        "resolution_status": "partially_resolved",
        "resolution_note": "Priya's interview answer explains the discrepancy: backend was fixed but Cloudflare was not updated. INFERRED \u2014 not yet verified."
      },
      {
        "id": "conflict-002",
        "source_a": {
          "artifact_id": "art-002",
          "label": "Slack: migration reverted (2024-10-14)",
          "span": "Had to revert the database migration from October 14."
        },
        "source_b": {
          "artifact_id": "art-006",
          "label": "Commit c3d4e5f (2024-10-14)",
          "span": "Revert 'Add currency_code column to payments table'"
        },
        "description": "Both confirm the migration was reverted, but Jira SL-287 was marked Done. The fixed branch status is unverified.",
        "resolution_status": "open",
        "resolution_note": null
      }
    ],
    "unanswered_questions": [
      {
        "question_id": "q-005",
        "text": "Are there any other scheduled jobs or private keys on your local machine that haven't been transferred to 1Password or AWS Secrets Manager?"
      }
    ]
  },
  "decisions": [
    {
      "id": "dec-001",
      "title": "Exponential backoff with jitter for webhook retries",
      "summary": "Agreed in Architecture Sync (Oct 14): use exponential backoff with jitter instead of fixed intervals. Dead-letter queue uses SQS with 72h retention.",
      "rationale": "Fixed intervals cause thundering herd on webhook endpoint after outages. Jitter spreads load. SQS was chosen over Redis for durability and cost.",
      "evidence_ids": [
        "art-012",
        "art-001"
      ],
      "made_by": "Priya Nair, Alex Chen, CTO",
      "made_at": "2024-10-14T10:00:00Z",
      "provenance": "stated"
    },
    {
      "id": "dec-002",
      "title": "Two-phase migration strategy for currency_code column",
      "summary": "Backfill existing rows with USD default before applying NOT NULL constraint. Avoids FK violations on production data.",
      "rationale": "Direct ALTER TABLE fails because existing payments rows have NULL currency_code. The two-phase approach is safer for a live production table with 2M rows.",
      "evidence_ids": [
        "art-002",
        "art-006"
      ],
      "made_by": "Priya Nair",
      "made_at": "2024-10-14T19:00:00Z",
      "provenance": "stated"
    },
    {
      "id": "dec-003",
      "title": "PostgreSQL 15 upgrade deferred to Q1 2025",
      "summary": "PG15 upgrade timeline set to Q1 2025 with Sam Rodriguez as new owner. Runbook not completed before Priya's departure.",
      "rationale": "Insufficient runway to complete upgrade safely before departure date. Q1 gives team time to test on staging and prepare rollback procedures.",
      "evidence_ids": [
        "art-012"
      ],
      "made_by": "Priya Nair, CTO",
      "made_at": "2024-10-14T10:00:00Z",
      "provenance": "stated"
    }
  ],
  "contacts": [
    {
      "name": "Alex Chen",
      "role": "Engineering Lead / Handover Recipient",
      "email": "alex@shopledger.io",
      "slack": "@alex",
      "owns": [
        "Auth Service",
        "Payment Processor (incoming)"
      ]
    },
    {
      "name": "Sam Rodriguez",
      "role": "DevOps / Ops Owner",
      "email": "sam@shopledger.io",
      "slack": "@sam",
      "owns": [
        "Nightly Reports",
        "Infrastructure",
        "SMTP Relay"
      ]
    },
    {
      "name": "CTO (name withheld)",
      "role": "Executive Sponsor",
      "email": "cto@shopledger.io",
      "slack": "@cto",
      "owns": [
        "PG15 Upgrade Decision",
        "Q4 Roadmap"
      ]
    }
  ],
  "continuation": {
    "first_5_days": [
      {
        "day": 1,
        "task": "Clone repo, run test suite locally, verify payment webhook worker starts",
        "owner": "Alex Chen",
        "status": "pending"
      },
      {
        "day": 1,
        "task": "Review ENV_KEYS.md and rotate Stripe live key (PAY-SEC-001)",
        "owner": "DevOps (Sam)",
        "status": "pending"
      },
      {
        "day": 2,
        "task": "Review PR #47 and assign integration test ownership",
        "owner": "Alex Chen",
        "status": "pending"
      },
      {
        "day": 2,
        "task": "Run feature/currency-fix branch on staging with backfill script",
        "owner": "Alex Chen",
        "status": "pending"
      },
      {
        "day": 3,
        "task": "Verify Cloudflare Page Rule for /auth/refresh (JWT fix)",
        "owner": "Sam Rodriguez",
        "status": "pending"
      },
      {
        "day": 4,
        "task": "Confirm SMTP relay ownership with SendGrid account access",
        "owner": "Sam Rodriguez",
        "status": "pending"
      },
      {
        "day": 5,
        "task": "Draft PostgreSQL 15 upgrade runbook (taking over from Priya)",
        "owner": "Sam Rodriguez",
        "status": "pending"
      }
    ]
  },
  "current_version": 1,
  "released_version": null,
  "acknowledged": false,
  "acknowledged_version": null,
  "acknowledged_at": null,
  "acknowledged_by": null,
  "handover_versions": [
    {
      "version": 1,
      "author": "System (Autonomous Handover Engine)",
      "timestamp": "2024-10-16T12:00:00Z",
      "change_summary": "Initial synthesized handover pack (5 claims extracted)",
      "is_released": false,
      "items": [
        {
          "id": "ho-001",
          "case_id": "case-001",
          "section": "In-Flight Work",
          "text": "**Payment Webhook Retry Logic (SL-456 / PR #47)**\nPR #47 contains the exponential backoff queue. Remaining items: integration test suite and SQS dead-letter queue with 72h retention. PagerDuty P2 alert at 3 consecutive failures. Ready for Alex Chen to take over review and complete deployment. SQS ARN in AWS SSM at /prod/shopledger/sqs/webhook-dlq.",
          "evidence_ids": [
            "art-001",
            "art-012",
            "q-003"
          ],
          "provenance": "inferred",
          "confidence": 0.95,
          "status": "draft",
          "claim_status": "pending",
          "history": [],
          "rejection_reason": null,
          "original_text": null,
          "created_at": "2024-10-16T12:00:00Z"
        },
        {
          "id": "ho-002",
          "case_id": "case-001",
          "section": "Pending Deployments",
          "text": "**Currency Code Schema Migration (SL-287)**\nThe original migration failed due to existing rows lacking currency defaults. Fixed migration branch `feature/currency-fix` contains a pre-migration script: `UPDATE payments SET currency_code = 'USD' WHERE currency_code IS NULL;` before adding `NOT NULL` constraint. Script path: db/scripts/backfill_currency.sql.",
          "evidence_ids": [
            "art-002",
            "art-006",
            "q-002"
          ],
          "provenance": "stated",
          "confidence": 0.92,
          "status": "draft",
          "claim_status": "pending",
          "history": [],
          "rejection_reason": null,
          "original_text": null,
          "created_at": "2024-10-16T12:00:00Z"
        },
        {
          "id": "ho-003",
          "case_id": "case-001",
          "section": "Known Production Issues",
          "text": "**Premature JWT Session Timeouts (SL-234)**\nThough the backend token configuration was increased to 2 hours, Cloudflare reverse proxy edge rules enforce a 15-minute connection TTL. Fix: add a Cloudflare Page Rule for `/auth/refresh` with TTL=0 (bypass cache). Dashboard path: Cloudflare > shopledger.io > Rules > Page Rules.",
          "evidence_ids": [
            "art-003",
            "art-004",
            "q-001"
          ],
          "provenance": "verified",
          "confidence": 0.9,
          "status": "draft",
          "claim_status": "pending",
          "history": [],
          "rejection_reason": null,
          "original_text": null,
          "created_at": "2024-10-16T12:00:00Z"
        },
        {
          "id": "ho-004",
          "case_id": "case-001",
          "section": "Environment & Ops",
          "text": "**Nightly Cron Prerequisites**\nThe nightly accounting ledger report (runs 02:00 UTC) requires:\n- `REPORT_BUCKET_NAME=shopledger-reports-prod`\n- `SMTP_RELAY_HOST=smtp.sendgrid.net`\nCredentials stored in AWS Secrets Manager under `/prod/shopledger/reports`. SendGrid ownership: Sam Rodriguez (ops@shopledger.io).",
          "evidence_ids": [
            "art-005",
            "art-007",
            "q-004"
          ],
          "provenance": "stated",
          "confidence": 0.98,
          "status": "draft",
          "claim_status": "approved",
          "history": [
            {
              "actor": "Alex Chen (Engineering Lead)",
              "action": "approved",
              "timestamp": "2024-10-16T13:00:00Z",
              "note": null
            }
          ],
          "rejection_reason": null,
          "original_text": null,
          "created_at": "2024-10-16T12:00:00Z"
        },
        {
          "id": "ho-005",
          "case_id": "case-001",
          "section": "Architecture & Ownership",
          "text": "**Payment Processor Subsystem Handover**\nPriya was primary owner (92% knowledge share). Primary contact during handover: Alex Chen. Critical services: Stripe Webhook Ingestion, Daily Settlement Reconciliation, and Multi-Currency Ledger.",
          "evidence_ids": [
            "art-013",
            "art-011",
            "art-012"
          ],
          "provenance": "verified",
          "confidence": 0.96,
          "status": "draft",
          "claim_status": "pending",
          "history": [],
          "rejection_reason": null,
          "original_text": null,
          "created_at": "2024-10-16T12:00:00Z"
        }
      ]
    }
  ]
};
