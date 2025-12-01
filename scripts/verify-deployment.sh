#!/bin/bash

# ============================================================
# Production Deployment Verification Script
# ============================================================
# Usage: ./scripts/verify-deployment.sh [URL]
# Example: ./scripts/verify-deployment.sh https://personupplysning-mcp.onrender.com
#
# Tests:
# 1. Health check endpoint
# 2. MCP endpoint availability
# 3. Response time benchmarks
# 4. Error handling
# ============================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default URL
URL="${1:-https://personupplysning-mcp.onrender.com}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Personupplysning MCP - Deployment Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Target: ${URL}"
echo "Time: $(date)"
echo ""

# Track results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNED=0

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((TESTS_WARNED++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# ============================================================
# Test 1: Health Check Endpoint
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Health Check Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

HEALTH_URL="${URL}/health"

# Make request and capture response
HEALTH_START=$(date +%s%3N)
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}\n%{time_total}" "${HEALTH_URL}" 2>/dev/null || echo "ERROR")
HEALTH_END=$(date +%s%3N)

if [ "$HEALTH_RESPONSE" = "ERROR" ]; then
    fail "Health check request failed (connection error)"
else
    # Parse response
    HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n -2)
    HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | tail -n 2 | head -n 1)
    HEALTH_TIME=$(echo "$HEALTH_RESPONSE" | tail -n 1)
    HEALTH_TIME_MS=$(echo "$HEALTH_TIME * 1000" | bc | cut -d. -f1)

    # Check HTTP status
    if [ "$HEALTH_STATUS" = "200" ]; then
        pass "HTTP Status: 200 OK"
    else
        fail "HTTP Status: ${HEALTH_STATUS} (expected 200)"
    fi

    # Check response time
    if [ "$HEALTH_TIME_MS" -lt 500 ]; then
        pass "Response time: ${HEALTH_TIME_MS}ms (< 500ms)"
    elif [ "$HEALTH_TIME_MS" -lt 2000 ]; then
        warn "Response time: ${HEALTH_TIME_MS}ms (acceptable but slow)"
    else
        fail "Response time: ${HEALTH_TIME_MS}ms (> 2000ms)"
    fi

    # Parse JSON and check fields
    if command -v jq &> /dev/null; then
        # Check for "healthy" status
        STATUS=$(echo "$HEALTH_BODY" | jq -r '.status' 2>/dev/null || echo "")
        if [ "$STATUS" = "healthy" ]; then
            pass "Server status: healthy"
        else
            fail "Server status: ${STATUS:-unknown} (expected 'healthy')"
        fi

        # Check server name
        SERVER=$(echo "$HEALTH_BODY" | jq -r '.server' 2>/dev/null || echo "")
        if [ "$SERVER" = "personupplysning-mcp" ]; then
            pass "Server name: ${SERVER}"
        else
            warn "Server name: ${SERVER} (unexpected)"
        fi

        # Check environment variables
        info "Checking environment configuration..."
        SUPABASE_URL=$(echo "$HEALTH_BODY" | jq -r '.environment.SUPABASE_URL' 2>/dev/null || echo "")
        SUPABASE_KEY=$(echo "$HEALTH_BODY" | jq -r '.environment.SUPABASE_SERVICE_ROLE_KEY' 2>/dev/null || echo "")
        BV_CLIENT_ID=$(echo "$HEALTH_BODY" | jq -r '.environment.BOLAGSVERKET_CLIENT_ID' 2>/dev/null || echo "")
        BV_CLIENT_SECRET=$(echo "$HEALTH_BODY" | jq -r '.environment.BOLAGSVERKET_CLIENT_SECRET' 2>/dev/null || echo "")

        if [ "$SUPABASE_URL" = "configured" ]; then
            pass "  SUPABASE_URL: configured"
        else
            fail "  SUPABASE_URL: ${SUPABASE_URL}"
        fi

        if [ "$SUPABASE_KEY" = "configured" ]; then
            pass "  SUPABASE_SERVICE_ROLE_KEY: configured"
        else
            fail "  SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_KEY}"
        fi

        if [ "$BV_CLIENT_ID" = "configured" ]; then
            pass "  BOLAGSVERKET_CLIENT_ID: configured"
        else
            fail "  BOLAGSVERKET_CLIENT_ID: ${BV_CLIENT_ID}"
        fi

        if [ "$BV_CLIENT_SECRET" = "configured" ]; then
            pass "  BOLAGSVERKET_CLIENT_SECRET: configured"
        else
            fail "  BOLAGSVERKET_CLIENT_SECRET: ${BV_CLIENT_SECRET}"
        fi
    else
        warn "jq not installed - skipping JSON validation"
        info "Response body: ${HEALTH_BODY}"
    fi
fi

echo ""

# ============================================================
# Test 2: MCP Endpoint
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: MCP Endpoint (SSE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

MCP_URL="${URL}/mcp"

# Test MCP endpoint (should return SSE headers)
MCP_RESPONSE=$(curl -s -I -X GET "${MCP_URL}" 2>/dev/null || echo "ERROR")

if [ "$MCP_RESPONSE" = "ERROR" ]; then
    fail "MCP endpoint request failed"
else
    # Check for SSE headers
    if echo "$MCP_RESPONSE" | grep -q "text/event-stream"; then
        pass "Content-Type: text/event-stream (SSE enabled)"
    else
        fail "Content-Type missing or incorrect"
        info "Headers: $(echo "$MCP_RESPONSE" | grep -i content-type)"
    fi

    if echo "$MCP_RESPONSE" | grep -q "Cache-Control.*no-cache"; then
        pass "Cache-Control: no-cache (correct for SSE)"
    else
        warn "Cache-Control header missing or incorrect"
    fi

    # Check HTTP status
    MCP_STATUS=$(echo "$MCP_RESPONSE" | grep "HTTP" | awk '{print $2}')
    if [ "$MCP_STATUS" = "200" ]; then
        pass "HTTP Status: 200 OK"
    else
        fail "HTTP Status: ${MCP_STATUS} (expected 200)"
    fi
fi

echo ""

# ============================================================
# Test 3: Error Handling
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Error Handling"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 404 handling
NOT_FOUND_URL="${URL}/invalid-path-12345"
NOT_FOUND_RESPONSE=$(curl -s -w "\n%{http_code}" "${NOT_FOUND_URL}" 2>/dev/null || echo "ERROR")

if [ "$NOT_FOUND_RESPONSE" = "ERROR" ]; then
    fail "404 test failed (connection error)"
else
    NOT_FOUND_STATUS=$(echo "$NOT_FOUND_RESPONSE" | tail -n 1)
    if [ "$NOT_FOUND_STATUS" = "404" ]; then
        pass "404 handling: Returns 404 for invalid paths"
    else
        warn "404 handling: Returns ${NOT_FOUND_STATUS} (expected 404)"
    fi

    # Check if response is JSON
    NOT_FOUND_BODY=$(echo "$NOT_FOUND_RESPONSE" | head -n -1)
    if echo "$NOT_FOUND_BODY" | jq . &>/dev/null; then
        pass "404 response: Valid JSON"
        if command -v jq &> /dev/null; then
            ERROR_MSG=$(echo "$NOT_FOUND_BODY" | jq -r '.error' 2>/dev/null || echo "")
            if [ "$ERROR_MSG" = "Not found" ]; then
                pass "404 error message: '${ERROR_MSG}'"
            else
                info "404 error message: '${ERROR_MSG}'"
            fi
        fi
    else
        warn "404 response: Not valid JSON"
    fi
fi

echo ""

# ============================================================
# Test 4: Performance Benchmarks
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: Performance Benchmarks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

info "Running 5 consecutive health check requests..."

TOTAL_TIME=0
MIN_TIME=999999
MAX_TIME=0

for i in {1..5}; do
    BENCH_RESPONSE=$(curl -s -w "%{time_total}" -o /dev/null "${HEALTH_URL}" 2>/dev/null || echo "0")
    BENCH_TIME_MS=$(echo "$BENCH_RESPONSE * 1000" | bc | cut -d. -f1)

    echo "  Request $i: ${BENCH_TIME_MS}ms"

    TOTAL_TIME=$((TOTAL_TIME + BENCH_TIME_MS))

    if [ "$BENCH_TIME_MS" -lt "$MIN_TIME" ]; then
        MIN_TIME=$BENCH_TIME_MS
    fi

    if [ "$BENCH_TIME_MS" -gt "$MAX_TIME" ]; then
        MAX_TIME=$BENCH_TIME_MS
    fi

    sleep 0.5  # Small delay between requests
done

AVG_TIME=$((TOTAL_TIME / 5))

echo ""
pass "Average response time: ${AVG_TIME}ms"
info "Min: ${MIN_TIME}ms, Max: ${MAX_TIME}ms"

if [ "$AVG_TIME" -lt 500 ]; then
    pass "Performance: Excellent (< 500ms)"
elif [ "$AVG_TIME" -lt 1000 ]; then
    pass "Performance: Good (< 1s)"
elif [ "$AVG_TIME" -lt 2000 ]; then
    warn "Performance: Acceptable (< 2s)"
else
    fail "Performance: Poor (> 2s) - investigate"
fi

echo ""

# ============================================================
# Test 5: Security Headers (Optional)
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: Security Headers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

HEADERS_RESPONSE=$(curl -s -I "${HEALTH_URL}" 2>/dev/null || echo "ERROR")

if [ "$HEADERS_RESPONSE" != "ERROR" ]; then
    # Check for HTTPS redirect (Render provides this automatically)
    if echo "$HEADERS_RESPONSE" | grep -q "Strict-Transport-Security"; then
        pass "HSTS header present (HTTPS enforced)"
    else
        warn "HSTS header missing (HTTPS may not be enforced)"
    fi

    # Check for content-type
    if echo "$HEADERS_RESPONSE" | grep -q "application/json"; then
        pass "Content-Type: application/json"
    else
        info "Content-Type: $(echo "$HEADERS_RESPONSE" | grep -i content-type)"
    fi
else
    warn "Could not fetch headers for security check"
fi

echo ""

# ============================================================
# Summary
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + TESTS_WARNED))

echo -e "${GREEN}Passed:${NC}  ${TESTS_PASSED}/${TOTAL_TESTS}"
echo -e "${YELLOW}Warned:${NC}  ${TESTS_WARNED}/${TOTAL_TESTS}"
echo -e "${RED}Failed:${NC}  ${TESTS_FAILED}/${TOTAL_TESTS}"
echo ""

if [ $TESTS_FAILED -eq 0 ] && [ $TESTS_WARNED -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✓ All tests passed! Deployment verified successfully.${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure monitoring alerts"
    echo "2. Set up external uptime monitoring"
    echo "3. Review docs/OPERATIONS-RUNBOOK.md"
    echo ""
    exit 0
elif [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}⚠ Tests passed with warnings.${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Review warnings and consider optimizations."
    echo ""
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}✗ Deployment verification failed!${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Action required:"
    echo "1. Check Render logs for errors"
    echo "2. Verify environment variables in Render dashboard"
    echo "3. Review docs/DEPLOYMENT-GUIDE.md troubleshooting section"
    echo "4. Contact support if issues persist"
    echo ""
    exit 1
fi
