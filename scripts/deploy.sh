#!/bin/bash
set -e

PROJECT_ID=${GCP_PROJECT_ID:-relay-ai-demo}
REGION=${GCP_REGION:-us-central1}
SERVICE_NAME="relay-api"

echo "Deploying RELAY AI to Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

cd api

echo "Building and pushing API image..."
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --project=$PROJECT_ID

echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME \
  --platform managed \
  --region $REGION \
  --project=$PROJECT_ID \
  --set-env-vars "DATABASE_URL=$DATABASE_URL,GITHUB_TOKEN=$GITHUB_TOKEN,GEMINI_API_KEY=$GEMINI_API_KEY" \
  --memory 2Gi \
  --timeout 3600 \
  --max-instances 10

echo "Deployment complete!"
echo "Service URL: https://$SERVICE_NAME-*.a.run.app"
