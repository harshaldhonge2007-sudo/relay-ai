#!/bin/bash

# RELAY AI - 4 Minute Demo Script
# This script runs through the key features in a fixed order

set -e

API_URL=${API_URL:-http://localhost:8000}
GITHUB_REPO="https://github.com/shopledger/shopledger"

echo "================================"
echo "RELAY AI - Demo (4 minutes)"
echo "================================"
echo ""

# 1. Create case (30 sec)
echo "[1/6] Creating case for ShopLedger..."
CASE_RESPONSE=$(curl -s -X POST $API_URL/cases \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ShopLedger - Priya Departure",
    "repo_url": "'$GITHUB_REPO'",
    "source_modes": {
      "github": "live",
      "slack": "fixture",
      "jira": "fixture",
      "docs": "fixture"
    }
  }')

CASE_ID=$(echo $CASE_RESPONSE | jq -r '.id')
echo "✓ Case created: $CASE_ID"
echo ""

# 2. Start ingestion (45 sec)
echo "[2/6] Ingesting GitHub, Slack, Jira, docs..."
curl -s -X POST $API_URL/cases/$CASE_ID/ingest > /dev/null
sleep 10
echo "✓ Ingestion started (background task)"
echo ""

# 3. Show findings (30 sec)
echo "[3/6] Findings detected:"
curl -s $API_URL/cases/$CASE_ID/findings | jq '.[] | {title: .title, kind: .kind, confidence: .confidence}'
echo ""

# 4. Show risk assessment (30 sec)
echo "[4/6] Risk assessment by component:"
curl -s $API_URL/cases/$CASE_ID/risk | jq '.[] | {component: .component_name, risk: .risk, criticality: .criticality}'
echo ""

# 5. Generate questions (30 sec)
echo "[5/6] Generating interview questions..."
curl -s -X POST $API_URL/cases/$CASE_ID/questions > /dev/null
sleep 5
curl -s $API_URL/cases/$CASE_ID/questions | jq '.[] | {text: .text, priority: .priority}'
echo ""

# 6. Completeness test (30 sec)
echo "[6/6] Running completeness test..."
TEST_RESPONSE=$(curl -s -X POST $API_URL/cases/$CASE_ID/sim/run)
SCORE=$(echo $TEST_RESPONSE | jq '.score')
echo "✓ Completeness score: $SCORE (out of 1.0)"
echo "✓ Found facts: $(echo $TEST_RESPONSE | jq '.found_fact_ids | length')"
echo "✓ Missing facts: $(echo $TEST_RESPONSE | jq '.missing_fact_ids | length')"
echo ""

echo "================================"
echo "Demo complete!"
echo "Open: http://localhost:5173"
echo "================================"
