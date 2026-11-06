#!/bin/bash

# Setup development environment

echo "Setting up RELAY AI development environment..."

# Create .env file
cat > .env << EOF
GITHUB_TOKEN=${GITHUB_TOKEN:-your_github_token}
GEMINI_API_KEY=${GEMINI_API_KEY:-your_gemini_key}
OPENAI_API_KEY=${OPENAI_API_KEY:-your_openai_key}
DATABASE_URL=postgresql://relay:relay@localhost:5432/relay
REPLAY_MODE=false
EOF

echo "✓ Created .env file"

# Install dependencies
echo "Installing Python dependencies..."
cd api
pip install -r requirements.txt > /dev/null
cd ..

echo "✓ Python dependencies installed"

# Install Node dependencies
echo "Installing Node dependencies..."
cd web
npm install > /dev/null 2>&1
cd ..

echo "✓ Node dependencies installed"

echo ""
echo "Setup complete! Run: docker-compose up"
