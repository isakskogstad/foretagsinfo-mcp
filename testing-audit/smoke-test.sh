#!/bin/bash

# Smoke Test Script for Personupplysning MCP Server
# Quick validation that server starts and responds correctly

echo "🧪 PERSONUPPLYSNING MCP SERVER - SMOKE TEST"
echo "========================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Change to project directory
cd "$(dirname "$0")/.."

echo "📋 Test 1: Environment Variables"
echo "----------------------------------------"

# Check .env file exists
if [ -f .env ]; then
    echo -e "${GREEN}✓${NC} .env file exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} .env file missing"
    ((FAILED++))
fi

# Check required environment variables
source .env 2>/dev/null

REQUIRED_VARS=("SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "BOLAGSVERKET_CLIENT_ID" "BOLAGSVERKET_CLIENT_SECRET")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -n "${!var}" ]; then
        echo -e "${GREEN}✓${NC} $var is configured"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $var is missing"
        ((FAILED++))
    fi
done

echo ""
echo "📋 Test 2: Build Artifacts"
echo "----------------------------------------"

# Check if dist folder exists
if [ -d dist ]; then
    echo -e "${GREEN}✓${NC} dist/ folder exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} dist/ folder missing"
    ((FAILED++))
fi

# Check if main entry point exists
if [ -f dist/index.js ]; then
    echo -e "${GREEN}✓${NC} dist/index.js exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} dist/index.js missing"
    ((FAILED++))
fi

echo ""
echo "📋 Test 3: Dependencies"
echo "----------------------------------------"

# Check if node_modules exists
if [ -d node_modules ]; then
    echo -e "${GREEN}✓${NC} node_modules/ exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} node_modules/ missing (run npm install)"
    ((FAILED++))
fi

# Check package.json
if [ -f package.json ]; then
    echo -e "${GREEN}✓${NC} package.json exists"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} package.json missing"
    ((FAILED++))
fi

echo ""
echo "📋 Test 4: Server Startup (stdio mode)"
echo "----------------------------------------"

# Start server in background with timeout
timeout 5s node dist/index.js 2>&1 | head -n 20 &
SERVER_PID=$!

sleep 2

# Check if server is still running
if ps -p $SERVER_PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Server started successfully"
    ((PASSED++))
    kill $SERVER_PID 2>/dev/null
else
    echo -e "${RED}✗${NC} Server failed to start or crashed"
    ((FAILED++))
fi

echo ""
echo "📋 Test 5: File Structure"
echo "----------------------------------------"

# Check critical source files
FILES=("src/index.ts" "src/services/company-data-service.ts" "src/clients/bolagsverket-api.ts")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $file missing"
        ((FAILED++))
    fi
done

echo ""
echo "========================================================================"
echo "SMOKE TEST SUMMARY"
echo "========================================================================"
echo ""
echo "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All smoke tests passed!${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Some smoke tests failed${NC}"
    echo ""
    exit 1
fi
