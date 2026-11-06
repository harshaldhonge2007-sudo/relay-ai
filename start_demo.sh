#!/bin/bash
# ==============================================================================
# RELAY AI — Standalone Hackathon Demo Launcher
# Runs 100% locally on macOS without needing Docker Desktop or external databases!
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "=========================================================="
echo "🚀 Starting RELAY AI Hackathon Demo Environment"
echo "=========================================================="

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: python3 is not installed."
    exit 1
fi

# 2. Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Error: node is not installed."
    exit 1
fi

# Trap Ctrl+C to kill both background processes
cleanup() {
    echo ""
    echo "🛑 Shutting down RELAY AI servers..."
    kill "$API_PID" 2>/dev/null || true
    kill "$WEB_PID" 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Start Backend API
echo "Starting Backend API (FastAPI) on http://localhost:8000 ..."
cd "$DIR/api"
python3 -m uvicorn mock_server:app --host 127.0.0.1 --port 8000 &
API_PID=$!

# Give backend a moment to bind
sleep 1.5

# Start Frontend
echo "Starting Frontend Web UI (Vite + React) on http://localhost:5173 ..."
cd "$DIR/web"
npm run dev &
WEB_PID=$!

sleep 2

echo ""
echo "=========================================================="
echo "✅ RELAY AI IS RUNNING!"
echo "👉 Open: http://localhost:5173 in your browser"
echo "👉 API Docs: http://localhost:8000/docs"
echo "=========================================================="
echo "Press Ctrl+C to stop both servers."

# Try to automatically open browser on macOS
if command -v open &> /dev/null; then
    open "http://localhost:5173" || true
fi

wait

