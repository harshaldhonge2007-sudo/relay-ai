# Production Credentials (CONFIDENTIAL)
# Access restricted to Engineering Lead & DevOps

STRIPE_API_KEY=sk_live_[REDACTED_STRIPE_LIVE_KEY]
AWS_ACCESS_KEY_ID=[REDACTED_AWS_ACCESS_KEY]
AWS_SECRET_ACCESS_KEY=[REDACTED_AWS_SECRET_KEY]
JWT_SECRET=[REDACTED_JWT_SECRET]
SMTP_RELAY_HOST=smtp.sendgrid.net
REPORT_BUCKET_NAME=shopledger-reports-prod
DATABASE_URL=postgresql://shopledger_prod:[REDACTED_PASSWORD]@prod-db.internal:5432/shopledger

# Notes:
# Notion runbook link: https://notion.so/shopledger/pg15-upgrade-rough-draft-98412
# Stripe key rotation due immediately upon Priya Nair departure.
