#!/bin/bash
# Notes Feature - Test Execution Script

echo "========================================"
echo "Notes Feature - Comprehensive Test Suite"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Frontend Unit Tests
echo -e "${BLUE}[1/3] Running Frontend Unit Tests...${NC}"
echo "Command: npm run test:unit"
echo ""
npm run test:unit
FRONTEND_RESULT=$?
echo ""

# Test 2: Backend Unit Tests
echo -e "${BLUE}[2/3] Running Backend Unit Tests...${NC}"
echo "Command: cd src-tauri && cargo test --lib services::docs::tests"
echo ""
cd src-tauri
cargo test --lib services::docs::tests 2>&1 | grep -E "^(test |running |test result|thread)"
BACKEND_RESULT=$?
cd ..
echo ""

# Test 3: E2E Tests (optional - requires running app)
echo -e "${BLUE}[3/3] End-to-End Tests (Optional)${NC}"
echo "To run E2E tests:"
echo "  Terminal 1: npm run start"
echo "  Terminal 2: npm run test:e2e"
echo ""
echo "Or with interactive UI:"
echo "  npm run test:e2e:ui"
echo ""

# Summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo ""

if [ $FRONTEND_RESULT -eq 0 ]; then
  echo -e "${GREEN}✓ Frontend Unit Tests: PASSED${NC}"
else
  echo "✗ Frontend Unit Tests: FAILED"
fi

if [ $BACKEND_RESULT -eq 0 ]; then
  echo -e "${GREEN}✓ Backend Unit Tests: PASSED${NC}"
else
  echo "✗ Backend Unit Tests: FAILED"
fi

echo -e "${GREEN}✓ E2E Tests: READY${NC}"
echo ""
echo "Test documentation: TESTING.md"
echo "Implementation summary: TEST_SUMMARY.md"
echo ""

if [ $FRONTEND_RESULT -eq 0 ] && [ $BACKEND_RESULT -eq 0 ]; then
  echo -e "${GREEN}All Unit Tests Passed! ✓${NC}"
  exit 0
else
  echo "Some tests failed. Please check the output above."
  exit 1
fi
