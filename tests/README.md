# StudyBuddy Comprehensive E2E Testing Suite

This directory contains a comprehensive Playwright testing suite for the StudyBuddy application, implementing all the test cases outlined in the testing strategy document.

## 📋 Test Coverage

### High Priority Tests (Critical Path)
- **Authentication & User Session Management** (`auth.spec.ts`)
- **Anki Deck Import & Processing** (`anki-import.spec.ts`) 
- **Study Session Core Functionality** (`study-session.spec.ts`)

### Medium Priority Tests (Core Features)
- **Anti-Burnout & Fatigue Detection** (`anti-burnout.spec.ts`)
- **Adaptive Personalization Engine** (`adaptive-personalization.spec.ts`)
- **User-Dynamic Content Implementation** (`user-dynamic-content.spec.ts`)
- **Database Integration & Persistence** (`database-integration.spec.ts`)

### Low Priority Tests (Edge Cases & Performance)
- **Error Handling & Edge Cases** (`error-handling.spec.ts`)
- **Performance & Load Testing** (`performance.spec.ts`)

## 🚀 Quick Start

### Prerequisites
1. Ensure the development server is running on `http://localhost:5173`
2. Have a test user account with email `gokul2003@hotmail.com`
3. Import the EEI test deck for consistent test data

### Running Tests

```bash
# Install dependencies (if not already done)
npm install

# Install Playwright browsers
npx playwright install

# Run all tests
npm run test:e2e

# Run specific test suite
npm run test:auth
npm run test:study
npm run test:import

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run tests with debug mode
npm run test:e2e:debug

# Generate test report
npm run test:report
```

## 📊 Test Structure

Each test file follows this structure:

```typescript
test.describe('Feature Name', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.login();
  });

  test('Test Case X.Y: Specific Test Name', async ({ page }) => {
    // Test implementation following the strategy document
  });
});
```

## 🛠 Test Utilities

### TestHelpers Class (`utils/testHelpers.ts`)
Provides common testing utilities:

- `login()` - Automated login process
- `studyCards(count)` - Study specified number of cards
- `simulateFatigue()` - Trigger fatigue detection
- `verifyNoNullReferenceErrors()` - Check for critical errors
- `waitForConsoleLog(pattern)` - Wait for specific console messages
- `verifyAdaptiveRecommendations()` - Check AI recommendations

### Test Data (`utils/testHelpers.ts`)
- `TEST_USER` - Test user credentials
- `TEST_DECK_DATA` - Expected deck structure and metadata

## 🎯 Key Test Scenarios

### Critical Error Prevention
- **Null Reference Fix**: Verifies the critical `Cannot read properties of null (reading 'getSessionOptimization')` error is resolved
- **Anti-Burnout Engine**: Ensures proper initialization and fallback handling
- **Session Persistence**: Validates state management across browser sessions

### Adaptive Personalization
- **Baseline Learning**: Tests response time baseline establishment
- **Profile Creation**: Validates user learning profile generation
- **Dynamic Recommendations**: Ensures personalized AI suggestions
- **Beginner vs Expert**: Tests profile adaptation scenarios

### User-Dynamic Content
- **Dashboard Personalization**: Verifies real data display vs static content
- **Settings Integration**: Tests AI suggestion integration
- **Cross-Page Consistency**: Ensures personalized content consistency

### Database Integration
- **Real-time Updates**: Validates immediate data synchronization
- **Cross-Session Persistence**: Tests data retention across sessions
- **Multi-Deck Segregation**: Ensures proper data isolation per deck

## 🔍 Expected Outcomes

### Success Criteria
- ✅ Zero null reference errors in study sessions
- ✅ 100% adaptive recommendation accuracy based on real user data
- ✅ Sub-3 second study session load times
- ✅ 95%+ test pass rate across all scenarios
- ✅ Proper data persistence across browser sessions
- ✅ Personalized content displays instead of static fallbacks

### Performance Benchmarks
- Study session initialization: <2 seconds
- Card transitions: <500ms
- Adaptive calculation updates: <1 second
- Database sync operations: <3 seconds
- Image loading: <2 seconds per card

## 🐛 Debugging Failed Tests

### Common Issues
1. **Test Data Missing**: Ensure EEI deck is imported
2. **Network Timeout**: Check if dev server is running
3. **Authentication Failure**: Verify test user credentials
4. **Race Conditions**: Add appropriate wait conditions

### Debug Commands
```bash
# Run with debug mode
npx playwright test --debug

# Run specific test with trace
npx playwright test auth.spec.ts --trace on

# View test report
npx playwright show-report
```

## 📈 Test Reports

Playwright generates comprehensive test reports including:
- Test execution results
- Screenshots on failure
- Video recordings of failed tests
- Network logs and console output
- Performance metrics

Access reports at: `playwright-report/index.html`

## 🔧 Configuration

### Browser Configuration
Tests run on multiple browsers:
- Chromium (Desktop)
- Firefox (Desktop)
- WebKit (Safari)
- Mobile Chrome
- Mobile Safari

### Environment Variables
Set these in your environment or `.env` file:
```
TEST_USER_EMAIL=gokul2003@hotmail.com
TEST_USER_PASSWORD=your-password
BASE_URL=http://localhost:5173
```

## 📝 Test Maintenance

### Adding New Tests
1. Create test file following naming convention: `feature-name.spec.ts`
2. Use TestHelpers for common operations
3. Follow the test case structure from strategy document
4. Add appropriate assertions and error handling

### Updating Test Data
- Update `TEST_DECK_DATA` in `testHelpers.ts` if deck structure changes
- Modify user credentials in `TEST_USER` as needed
- Adjust expected performance benchmarks based on infrastructure

## 🚨 CI/CD Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    npm ci
    npx playwright install --with-deps
    npm run build
    npm run test:e2e
```

## 📞 Support

For test-related issues:
1. Check the test logs in `test-results/`
2. Review the HTML report for detailed failure analysis
3. Use debug mode to step through failing tests
4. Check console logs for application errors

## 🎯 Future Enhancements

Planned additions:
- Visual regression testing
- API testing integration
- Cross-browser compatibility matrix
- Performance monitoring alerts
- Automated test data generation