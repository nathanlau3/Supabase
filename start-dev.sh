#!/bin/bash

# Start all services for chatgpt-your-files development
# This script starts:
# 1. Supabase local instance (database, auth, storage, edge functions)
# 2. Embedding service (ML model on M3 Mac)
# 3. Next.js development server

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting chatgpt-your-files development environment...${NC}\n"

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping services...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}

trap cleanup INT TERM

# 1. Start Supabase
echo -e "${GREEN}[1/3] Starting Supabase...${NC}"
if ! supabase status &>/dev/null; then
    supabase start
else
    echo "Supabase is already running"
fi

# 2. Start Embedding Service
echo -e "\n${GREEN}[2/3] Starting Embedding Service...${NC}"
cd "$(dirname "$0")/embedding-service"

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    echo "Installing dependencies..."
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

echo "Starting embedding service on http://localhost:8001"
uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
EMBEDDING_PID=$!

cd ..

# 3. Start Supabase Edge Functions
echo -e "\n${GREEN}[3/3] Starting Supabase Edge Functions...${NC}"
npx supabase functions serve &
FUNCTIONS_PID=$!

# Wait a moment for services to start
sleep 3

echo -e "\n${GREEN}✓ All services started!${NC}\n"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Services Running:${NC}"
echo "  • Supabase Studio:     http://127.0.0.1:54323"
echo "  • Supabase API:        http://127.0.0.1:54321"
echo "  • Edge Functions:      http://127.0.0.1:54321/functions/v1"
echo "  • Embedding Service:   http://localhost:8001"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}\n"

# Wait for background processes
wait
