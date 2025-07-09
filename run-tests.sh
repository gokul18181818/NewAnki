#!/bin/bash

# StudyBuddy E2E Test Execution Script
# This script runs the comprehensive Playwright testing suite

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEV_SERVER_PORT=5173
BASE_URL="http://localhost:${DEV_SERVER_PORT}"
TEST_USER_EMAIL="gokul2003@hotmail.com"

echo -e "${BLUE}🚀 StudyBuddy Comprehensive E2E Testing Suite${NC}"
echo "=============================================="

# Check if required tools are installed
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Install Playwright browsers if needed
if [ ! -d "$HOME/.cache/ms-playwright" ] && [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo -e "${YELLOW}🌐 Installing Playwright browsers...${NC}"
    npx playwright install
fi

# Function to check if dev server is running
check_dev_server() {
    echo -e "${YELLOW}🔍 Checking if development server is running...${NC}"
    if curl -s "$BASE_URL" > /dev/null; then
        echo -e "${GREEN}✅ Development server is running on $BASE_URL${NC}"
        return 0
    else
        echo -e "${RED}❌ Development server is not running on $BASE_URL${NC}"
        return 1
    fi
}

# Start dev server if not running
start_dev_server() {
    echo -e "${YELLOW}🚀 Starting development server...${NC}"
    npm run dev &
    DEV_SERVER_PID=$!
    
    # Wait for server to start
    echo -e "${YELLOW}⏳ Waiting for server to start...${NC}"
    for i in {1..30}; do
        if curl -s "$BASE_URL" > /dev/null; then
            echo -e "${GREEN}✅ Development server started successfully${NC}"
            return 0
        fi
        echo "Attempt $i/30..."
        sleep 2
    done
    
    echo -e "${RED}❌ Failed to start development server${NC}"
    kill $DEV_SERVER_PID 2>/dev/null || true
    exit 1
}

# Check if dev server is running, start if not
if ! check_dev_server; then
    start_dev_server
fi

# Function to run test suite
run_test_suite() {
    local suite_name=$1
    local test_file=$2
    local description=$3
    
    echo ""
    echo -e "${BLUE}🧪 Running $suite_name Tests${NC}"
    echo "Description: $description"
    echo "File: $test_file"
    echo "----------------------------------------"
    
    if npx playwright test "$test_file" --reporter=line; then
        echo -e "${GREEN}✅ $suite_name tests passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $suite_name tests failed${NC}"
        return 1
    fi
}

# Test execution based on arguments
case "${1:-all}" in
    "all")
        echo -e "${BLUE}🎯 Running complete test suite${NC}"
        echo ""
        
        # Track results
        PASSED_SUITES=0
        TOTAL_SUITES=10
        FAILED_SUITES=""
        
        # High Priority Tests
        echo -e "${YELLOW}🔥 HIGH PRIORITY TESTS${NC}"
        if run_test_suite "Authentication" "auth.spec.ts" "User login, session management, and security"; then
            ((PASSED_SUITES++))
        else
            FAILED_SUITES="$FAILED_SUITES Authentication"
        fi
        
        if run_test_suite "Anki Import" "anki-import.spec.ts" "Deck importing, file processing, and metadata validation"; then
            ((PASSED_SUITES++))
        else
            FAILED_SUITES="$FAILED_SUITES Anki-Import"
        fi
        
        if run_test_suite "Study Session" "study-session.spec.ts" "Core study functionality and card interactions"; then
            ((PASSED_SUITES++))
        else
            FAILED_SUITES="$FAILED_SUITES Study-Session"
        fi
        
        # Medium Priority Tests
        echo -e "${YELLOW}🔶 MEDIUM PRIORITY TESTS${NC}"
        if run_test_suite "Anti-Burnout" "anti-burnout.spec.ts" "Fatigue detection and break recommendations"; then
            ((PASSED_SUITES++))
        else
            FAILED_SUITES="$FAILED_SUITES Anti-Burnout"
        fi
        
        if run_test_suite "Adaptive Personalization" "adaptive-personalization.spec.ts" "AI-powered learning personalization"; then
            ((PASSED_SUITES++))
        else
            FAILED_SUITES="$FAILED_SUITES Adaptive-Personalization"
        fi
        
        if run_test_suite "Dynamic Content" "user-dynamic-content.spec.ts" "Personalized UI and recommendations"; then
            ((PASSED_SUITES++))
        else
            FAILED_SUITES="$FAILED_SUITES Dynamic-Content"
        fi
        
        if run_test_suite "Database Integration" "database-integration.spec.ts" "Data persistence and synchronization"; then
            ((PASSED_SUITES++))
        else
            FAILED_SUITES="$FAILED_SUITES Database-Integration"
        fi
        
        # Low Priority Tests
        echo -e "${YELLOW}🔸 LOW PRIORITY TESTS${NC}"
        if run_test_suite "Error Handling" "error-handling.spec.ts" "Edge cases and error recovery"; then
            ((PASSED_SUITES++))
        else
            FAILED_SUITES="$FAILED_SUITES Error-Handling"
        fi
        
        if run_test_suite "Performance" "performance.spec.ts" "Load testing and performance benchmarks"; then
            ((PASSED_SUITES++))
        else
            FAILED_SUITES="$FAILED_SUITES Performance"
        fi
        
        # Summary
        echo ""
        echo "=============================================="
        echo -e "${BLUE}📊 TEST EXECUTION SUMMARY${NC}"
        echo "=============================================="
        echo -e "Total Test Suites: $TOTAL_SUITES"
        echo -e "Passed: ${GREEN}$PASSED_SUITES${NC}"
        echo -e "Failed: ${RED}$((TOTAL_SUITES - PASSED_SUITES))${NC}"
        echo -e "Success Rate: $((PASSED_SUITES * 100 / TOTAL_SUITES))%"
        
        if [ -n "$FAILED_SUITES" ]; then
            echo -e "${RED}Failed Suites:$FAILED_SUITES${NC}"
        fi
        
        if [ $PASSED_SUITES -eq $TOTAL_SUITES ]; then
            echo -e "${GREEN}🎉 ALL TESTS PASSED! StudyBuddy is ready for production.${NC}"
        else
            echo -e "${YELLOW}⚠️  Some tests failed. Please check the results above.${NC}"
        fi
        ;;
        
    "auth")
        run_test_suite "Authentication" "auth.spec.ts" "User login and session management"
        ;;
        
    "import")
        run_test_suite "Anki Import" "anki-import.spec.ts" "Deck importing and processing"
        ;;
        
    "study")
        run_test_suite "Study Session" "study-session.spec.ts" "Core study functionality"
        ;;
        
    "burnout")
        run_test_suite "Anti-Burnout" "anti-burnout.spec.ts" "Fatigue detection"
        ;;
        
    "adaptive")
        run_test_suite "Adaptive Personalization" "adaptive-personalization.spec.ts" "AI personalization"
        ;;
        
    "content")
        run_test_suite "Dynamic Content" "user-dynamic-content.spec.ts" "Personalized content"
        ;;
        
    "database")
        run_test_suite "Database Integration" "database-integration.spec.ts" "Data persistence"
        ;;
        
    "errors")
        run_test_suite "Error Handling" "error-handling.spec.ts" "Edge cases and errors"
        ;;
        
    "performance")
        run_test_suite "Performance" "performance.spec.ts" "Load and performance testing"
        ;;
        
    "critical")
        echo -e "${BLUE}🔥 Running Critical Path Tests Only${NC}"
        run_test_suite "Authentication" "auth.spec.ts" "User login and session management"
        run_test_suite "Study Session" "study-session.spec.ts" "Core study functionality"
        ;;
        
    "help")
        echo "Usage: $0 [test-suite]"
        echo ""
        echo "Available test suites:"
        echo "  all         - Run complete test suite (default)"
        echo "  auth        - Authentication tests"
        echo "  import      - Anki import tests"
        echo "  study       - Study session tests"
        echo "  burnout     - Anti-burnout tests"
        echo "  adaptive    - Adaptive personalization tests"
        echo "  content     - Dynamic content tests"
        echo "  database    - Database integration tests"
        echo "  errors      - Error handling tests"
        echo "  performance - Performance tests"
        echo "  critical    - Critical path tests only"
        echo "  help        - Show this help"
        echo ""
        echo "Examples:"
        echo "  $0                    # Run all tests"
        echo "  $0 auth              # Run authentication tests only"
        echo "  $0 critical          # Run critical path tests only"
        ;;
        
    *)
        echo -e "${RED}❌ Unknown test suite: $1${NC}"
        echo "Use '$0 help' to see available options"
        exit 1
        ;;
esac

# Generate test report
echo ""
echo -e "${BLUE}📊 Generating test report...${NC}"
npx playwright show-report --host=0.0.0.0 &
REPORT_PID=$!

echo -e "${GREEN}✅ Test report available at: http://localhost:9323${NC}"
echo -e "${YELLOW}💡 Tip: Use 'npm run test:report' to view the report later${NC}"

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🧹 Cleaning up...${NC}"
    
    # Kill report server
    if [ ! -z "$REPORT_PID" ]; then
        kill $REPORT_PID 2>/dev/null || true
    fi
    
    # Kill dev server if we started it
    if [ ! -z "$DEV_SERVER_PID" ]; then
        echo -e "${YELLOW}🛑 Stopping development server...${NC}"
        kill $DEV_SERVER_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
}

# Set up cleanup on script exit
trap cleanup EXIT

# Keep script running to show report
echo ""
echo -e "${BLUE}🎯 Test execution completed!${NC}"
echo -e "${YELLOW}Press Ctrl+C to exit and stop the report server${NC}"
wait $REPORT_PID 2>/dev/null || true