# Unit Testing Guide - Redux Slices

## Testing Infrastructure Setup Complete

### Installed Dependencies & Libraries

#### Core Testing Framework
- **Jest** (v29.x): JavaScript testing framework - test runner, assertions, mocking
- **ts-jest** (v29.x): TypeScript preprocessor for Jest - enables TypeScript test files
- **@types/jest**: TypeScript type definitions for Jest APIs

#### React Testing Utilities
- **@testing-library/react** (v14.x): React component testing utilities
- **@testing-library/jest-dom** (v6.x): Custom Jest matchers for DOM assertions
- **jest-environment-jsdom** (v29.x): Browser-like DOM environment for tests

#### State Management Testing
- **@reduxjs/toolkit**: Built-in testing utilities for Redux slices
- **redux-mock-store**: Mock Redux store for testing async actions (optional)

---

## 📁 Test Structure

```
src/
├── setupTests.ts                       # Global test configuration
├── __mocks__/                          # Mock implementations
│   ├── styleMock.js                   # CSS/LESS/SCSS mock
│   ├── fileMock.js                    # Image/font file mock
│   └── devextremeMock.js              # DevExtreme components mock
├── __tests__/
│   └── unit/
│       └── slices/                     # Test files (all 9 slices)
│           ├── authSlice.test.ts      # ✅ Auth (63 tests)
│           ├── aktenSlice.test.ts     # ✅ Case/Documents (125 tests)
│           ├── emailSlice.test.ts     # ✅ Email/Attachments (46 tests)
│           ├── serviceSlice.test.ts   # ✅ Services (62 tests)
│           ├── personSlice.test.ts    # ✅ Person search (63 tests)
│           ├── connectionSlice.test.ts # ✅ SIP/WebRTC connection state (64 tests)
│           ├── pairingSlice.test.ts   # ✅ Device pairing (23 tests)
│           ├── loggingSlice.test.ts   # ✅ Logging (22 tests)
│           ├── languageSlice.test.ts  # ✅ Language (8 tests)
│           ├── testSetup.ts           # Shared test utilities (store factory, mocks, cleanup)
│           └── mockFactories.ts       # Mock data factories
└── store/
    └── slices/
        ├── authSlice.ts
        ├── emailSlice.ts
        ├── aktenSlice.ts
        ├── personSlice.ts
        ├── serviceSlice.ts
        ├── connectionSlice.ts
        ├── pairingSlice.ts
        ├── loggingSlice.ts
        └── languageSlice.ts
```

---

## 📊 Test Files Summary

### 1. authSlice.test.ts (63 tests) ✅
**Purpose**: Authentication state management, credentials, token lifecycle

**Key Features Tested:**
- OAuth2 password grant flow
- Token expiration and refresh
- Credential management
- Error handling and recovery

---

### 2. aktenSlice.test.ts (125 tests) ✅
**Purpose**: Case (Akt) management, document caching, favorites

**Test Coverage:**
- Reducers: Clear cases, folders, favorites, search state
- Async Thunks: aktLookUpAsync, getFavoriteAktenAsync, getCaseDocumentsAsync, getEmailDocumentsAsync
- Document Caching: LRU cache (5 most recent), cache hits/misses
- Selectors: Cached documents, email documents filtering
- Branch Coverage: Error handling, API failures, edge cases (75.4% branches)

**Key Features Tested:**
- Case lookup and search
- Favorite case management
- Document caching with LRU eviction
- Email context document loading
- Folder management
- WebRTC API integration

---

### 3. emailSlice.test.ts (46 tests) ✅
**Purpose**: Email and attachment transfer to Advokat system

**Test Coverage:**
- Reducers: Attachment selection state management
- Async Thunks: saveDokumentAsync (save emails/attachments)
- Error Handling: Network failures, API errors
- Attachment Management: Selection, validation, state updates

**Key Features Tested:**
- Email/attachment selection
- Document saving to Advokat
- Error state management
- WebRTC chunked uploads

---

### 4. serviceSlice.test.ts (62 tests) ✅
**Purpose**: Legal service (Leistung) selection and time tracking

**Test Coverage:**
- Reducers: Service selection, time/text/sb fields
- Async Thunks: loadServicesAsync, saveLeistungAsync
- State Management: Service data, error handling
- Data Validation: Service saving, field updates

**Key Features Tested:**
- Service catalog loading
- Time entry management
- Service saving to Advokat
- Form field state management

---

### 5. personSlice.test.ts (63 tests) ✅
**Purpose**: Person/contact search and favorites

**Test Coverage:**
- Reducers: Search state, favorites management
- Async Thunks: personLookUpAsync, getFavoritePersonsAsync, add/remove favorites
- Search: Person lookup, filtering
- Favorites: Add, remove, cache management

**Key Features Tested:**
- Person search functionality
- Favorite person management
- Contact information handling
- Company vs. individual person handling

---

### 6. connectionSlice.test.ts (64 tests) ✅
**Purpose**: SIP/WebRTC connection state — registration, call state, ICE candidate type

**Key Features Tested:**
- SIP client state transitions (registering, connected, failed, disconnected)
- Reconnect scheduling
- Idle state tracking

---

### 7. pairingSlice.test.ts (23 tests) ✅
**Purpose**: Device pairing status and OTP flow

**Key Features Tested:**
- Pairing status transitions (unpaired → pairing → paired)
- Pairing error handling

---

### 8. loggingSlice.test.ts (22 tests) ✅
**Purpose**: In-app logging state

---

### 9. languageSlice.test.ts (8 tests) ✅
**Purpose**: UI language selection

---

## 🧪 Shared Test Infrastructure

### testSetup.ts
**Purpose**: Reusable test utilities and mocks

**Exports:**
- `createTestStore()`: Configure Redux store for testing
- `createMockAuthState()`: Generate mock auth state
- `createMockWebRTCService()`: Mock WebRTC API service
- `createWebRTCConnectionManagerMock()`: Mock WebRTC connection manager
- `setupDefaultWebRTCMocks()`: Setup default successful API responses
- `cleanupTests()`: Comprehensive test cleanup (mocks, timers, fetch)
- `mockFetch()`, `mockFetchError()`: HTTP request mocking
- `wait()`: Async operation utilities

---

### mockFactories.ts
**Purpose**: Centralized mock data factories

**Exports:**
- `createMockAkt()`: Mock case/Akt data
- `createMockDocument()`: Mock document data
- `createMockFolderOption()`: Mock folder options
- `createMockAttachment()`: Mock email attachments
- `createMockDokumentPostData()`: Mock document POST data
- `createMockService()`: Mock legal service data
- `createMockLeistungPostData()`: Mock service POST data
- `createMockPersonLookUp()`: Mock person search result
- `createMockPersonResponse()`: Mock person details

**Benefits:**
- Consistent test data across all test files
- DRY principle - no duplicate mock creation
- Easy customization with override parameters
- Type-safe mock generation

---

## 🚀 Running Tests

### Available Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with detailed output
npm run test:verbose

# Run only unit tests (__tests__ directory)
npm run test:unit

# Run specific test file
npm test -- authSlice

# Run tests matching a pattern
npm test -- --testNamePattern="authentication"
```

### Watch Mode (Interactive Testing)
```bash
npm run test:watch

# Interactive menu:
# › Press f to run only failed tests
# › Press o to only run tests related to changed files
# › Press p to filter by filename regex pattern
# › Press t to filter by test name regex pattern
# › Press q to quit watch mode
```

---

## 📊 Code Coverage

### Viewing Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# Open HTML report in browser
Start-Process "coverage/lcov-report/index.html"
```

### Coverage Reports Available
- **HTML Report**: `coverage/lcov-report/index.html` - Interactive, color-coded
- **LCOV**: `coverage/lcov.info` - For CI/CD tools
- **Clover XML**: `coverage/clover.xml` - For build systems
- **JSON**: `coverage/coverage-final.json` - Programmatic access

### Understanding Coverage Metrics

**4 Key Metrics:**
- **Statements**: % of code statements executed (98%+)
- **Branches**: % of if/else paths tested (75%+)
- **Functions**: % of functions called (100%)
- **Lines**: % of lines executed (98%+)

**Color Coding in HTML Report:**
- 🟢 **Green** (80-100%): Well covered
- 🟡 **Yellow** (50-79%): Partially covered
- 🔴 **Red** (<50%): Poorly covered

### Current Coverage Thresholds
```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  }
}
```

### Current Coverage Status (Redux Slices)
- **authSlice.ts**: 100% all metrics ✅
- **aktenSlice.ts**: 98.96% statements, 75.4% branches ✅
- **emailSlice.ts**: 95%+ all metrics ✅
- **serviceSlice.ts**: 95%+ all metrics ✅
- **personSlice.ts**: 95%+ all metrics ✅
- **connectionSlice.ts**: 90%+ all metrics ✅
- **pairingSlice.ts**: 90%+ all metrics ✅
- **loggingSlice.ts**: 90%+ all metrics ✅
- **languageSlice.ts**: 90%+ all metrics ✅

**Overall Test Stats:**
- **Test Suites**: 9 passed
- **Total Tests**: 476 passing
- **Execution Time**: ~3-4 seconds

---

## 📝 Test Patterns & Examples

### Pattern 1: Reducer Tests (Synchronous State Changes)

```typescript
describe('Reducer', () => {
  it('should update state correctly', () => {
    const actual = sliceReducer(initialState, actionName(payload));
    
    expect(actual.field).toBe(expectedValue);
    expect(actual.error).toBeNull();
  });
});
```

### Pattern 2: Async Thunk Tests (API Calls)

```typescript
describe('asyncThunkName', () => {
  it('should handle pending state', () => {
    const action = { type: asyncThunkName.pending.type };
    const actual = sliceReducer(initialState, action);
    
    expect(actual.loading).toBe(true);
    expect(actual.error).toBeNull();
  });
  
  it('should handle fulfilled state', () => {
    const payload = mockData;
    const action = { type: asyncThunkName.fulfilled.type, payload };
    const actual = sliceReducer(initialState, action);
    
    expect(actual.loading).toBe(false);
    expect(actual.data).toEqual(payload);
  });
  
  it('should handle rejected state', () => {
    const action = {
      type: asyncThunkName.rejected.type,
      error: { message: 'Error message' }
    };
    const actual = sliceReducer(initialState, action);
    
    expect(actual.loading).toBe(false);
    expect(actual.error).toBe('Error message');
  });
});
```

### Pattern 3: Selector Tests

```typescript
describe('Selectors', () => {
  it('selectorName should return correct data', () => {
    const mockState = { sliceName: { field: 'value' } };
    const result = selectorName(mockState);
    
    expect(result).toBe('value');
  });
});
```

### Pattern 4: Integration Tests (Full Workflows)

```typescript
it('should handle complete workflow', async () => {
  const store = createTestStore();
  
  // Step 1: Dispatch action
  await store.dispatch(asyncAction(params) as any);
  
  // Step 2: Verify state
  const state = store.getState().sliceName;
  expect(state.data).toBeDefined();
  expect(state.loading).toBe(false);
});
```

### Pattern 5: Branch Coverage (Error Paths)

```typescript
it('should handle error without custom message', async () => {
  mockWebRTCService.method.mockResolvedValue({ statusCode: 500, body: '' });
  
  const store = createTestStore();
  await store.dispatch(thunkAsync(params) as any);
  
  const state = store.getState().sliceName;
  expect(state.error).toBe('Default error message');
});
```

---

## 🛠️ Test Infrastructure Details

### Jest Configuration (jest.config.js)

See the project root `jest.config.js` for the current, authoritative configuration
(path aliases, `testPathIgnorePatterns` for helper files, coverage thresholds, etc.).
Test files live under `src/__tests__/{unit,integration}/`.

### Global Test Setup (setupTests.ts)

```typescript
// Mocks Office.js
global.Office = {
  context: { mailbox: { item: {} } },
  onReady: jest.fn()
};

// Mocks WebRTC/WebSocket
global.WebSocket = jest.fn();
global.RTCPeerConnection = jest.fn();

// Mocks window.matchMedia (for theme detection)
window.matchMedia = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  addListener: jest.fn(),
  removeListener: jest.fn()
}));
```

### Mock Files Structure

```
src/__mocks__/
├── styleMock.js          # Returns {} for CSS imports
├── fileMock.js           # Returns 'test-file-stub' for assets
└── devextremeMock.js     # Returns mock components for DevExtreme
```

---

## 📝 Writing New Tests

### Step-by-Step Guide

**1. Create Test File**
```bash
# Create in src/__tests__/unit/slices/
src/__tests__/unit/slices/yourSlice.test.ts
```

**2. Import Dependencies**
```typescript
import sliceReducer, {
  action1,
  action2,
  selector1,
  asyncThunk1,
} from '@slices/yourSlice';
import { createMockWebRTCService, setupDefaultWebRTCMocks, cleanupTests } from './testSetup';
import { createMockData } from './mockFactories';

const mockWebRTCService = createMockWebRTCService();

jest.mock('../../../taskpane/services/WebRTCConnectionManager', () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => mockWebRTCService),
  })),
}));
```

**3. Setup Test Suite**
```typescript
describe('yourSlice', () => {
  beforeEach(() => {
    cleanupTests();
    setupDefaultWebRTCMocks(mockWebRTCService);
  });

  const initialState = {
    // Define initial state
  };

  describe('Reducer', () => {
    it('should return the initial state', () => {
      expect(sliceReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });
  });
});
```

**4. Write Tests**
- Test all reducer actions
- Test all selectors
- Test async thunk pending/fulfilled/rejected states
- Test error cases and edge cases

**5. Run Tests**
```bash
npm test -- yourSlice
```

---

## 🎯 Best Practices

### 1. Test Isolation
```typescript
// ✅ Good - Each test uses fresh state
it('test 1', () => {
  const state = sliceReducer(initialState, action());
});

it('test 2', () => {
  const state = sliceReducer(initialState, action());
});

// ❌ Bad - Tests depend on shared state
let state = initialState;
it('test 1', () => { state = sliceReducer(state, action()); });
it('test 2', () => { state = sliceReducer(state, action()); });
```

### 2. Descriptive Test Names
```typescript
// ✅ Good - Clear intent
it('should set loading to true when fetch starts', () => {})
it('should clear error on successful data load', () => {})

// ❌ Bad - Unclear
it('test loading', () => {})
it('works', () => {})
```

### 3. Test One Behavior Per Test
```typescript
// ✅ Good - Single responsibility
it('should set isLoading to true', () => {
  const state = sliceReducer(initialState, fetchData.pending);
  expect(state.isLoading).toBe(true);
});

// ❌ Bad - Tests multiple things
it('should handle everything', () => {
  // Tests loading, data, error, and side effects
});
```

### 4. Use Test Factories
```typescript
// ✅ Good - Reusable, consistent
const mockAkt = createMockAkt({ id: 1, aKurz: 'TEST' });

// ❌ Bad - Inline objects, duplicated across tests
const mockAkt = {
  id: 1,
  aKurz: 'TEST',
  causa: 'Test',
  // ... 10 more fields
};
```

### 5. Cleanup After Tests
```typescript
// ✅ Good - Uses shared cleanup
beforeEach(() => {
  cleanupTests(); // Clears mocks, timers, fetch
});

// ❌ Bad - Manual cleanup, incomplete
beforeEach(() => {
  jest.clearAllMocks();
  // Forgot to clear timers and fetch
});
```

---

```

---

## 📈 Future Testing Plans

### Next Steps (Integration & E2E Tests)

**1. Integration Tests**
- Test actual async thunk execution with mocked WebRTC
- Test Redux store integration with multiple slices
- Test component integration with Redux state
- Coverage target: API response parsing, data flow

**2. Component Tests**
- React component rendering
- User interactions (clicks, inputs)
- Props and state management
- DevExtreme component integration

**3. End-to-End Tests**
- Full user workflows
- Office Add-in lifecycle
- WebRTC connection flows
- Real Office.js integration

### Files Excluded from Unit Tests
These require integration/E2E testing:
- `src/commands/**` - Office command handlers
- `src/taskpane/components/**` - React components (UI tests needed)
- `src/taskpane/services/WebRTCConnectionManager.ts` - Integration tests needed
- `src/taskpane/utils/chunkingUtils.ts` - Integration tests for large file handling

---

## 🐛 Troubleshooting

### Common Issues & Solutions

**Issue**: `Cannot find module '@store/slices/...'`
```bash
# Solution: Check moduleNameMapper in jest.config.js
# Verify path aliases match tsconfig.json
```

**Issue**: `TypeError: Cannot read property 'getWebRTCApiService' of undefined`
```bash
# Solution: Mock WebRTCConnectionManager in test file
jest.mock('../../../taskpane/services/WebRTCConnectionManager', () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => mockWebRTCService),
  })),
}));
```

**Issue**: Tests pass locally but fail in CI/CD
```bash
# Solution: Add --no-cache flag
npm test -- --no-cache
```

**Issue**: `SyntaxError: Unexpected token 'export'`
```bash
# Solution: Add transform in jest.config.js
transform: {
  '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react' } }]
}
```

**Issue**: Coverage threshold not met
```bash
# Solution: Run coverage report to identify gaps
npm run test:coverage
Start-Process "coverage/lcov-report/index.html"
# Look for red/yellow highlighted areas
```

---

## 📚 Resources & References

### Official Documentation
- [Jest Documentation](https://jestjs.io/) - Test framework
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/) - TypeScript support
- [Testing Library](https://testing-library.com/) - React testing utilities
- [Redux Testing](https://redux.js.org/usage/writing-tests) - Redux Toolkit patterns
- [Redux Toolkit](https://redux-toolkit.js.org/usage/usage-guide#testing) - Official testing guide

### Best Practices
- [Kent C. Dodds - Testing](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Martin Fowler - Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html)
- [AAA Pattern](https://automationpanda.com/2020/07/07/arrange-act-assert-a-pattern-for-writing-good-tests/) - Arrange, Act, Assert

### Project-Specific
- `WEBRTC_ERROR_HANDLING_TESTS.md` - WebRTC error testing guide
- `testSetup.ts` - Inline documentation for utilities
- `mockFactories.ts` - Factory function documentation

---

## ✨ Test Results Summary

```
PASS  src/__tests__/unit/slices/authSlice.test.ts
PASS  src/__tests__/unit/slices/aktenSlice.test.ts
PASS  src/__tests__/unit/slices/emailSlice.test.ts
PASS  src/__tests__/unit/slices/serviceSlice.test.ts
PASS  src/__tests__/unit/slices/personSlice.test.ts
PASS  src/__tests__/unit/slices/connectionSlice.test.ts
PASS  src/__tests__/unit/slices/pairingSlice.test.ts
PASS  src/__tests__/unit/slices/loggingSlice.test.ts
PASS  src/__tests__/unit/slices/languageSlice.test.ts

Test Suites: 9 passed, 9 total
Tests:       476 passed, 476 total
Snapshots:   0 total
Time:        3-4s
```

**Coverage Summary:**
| Slice          | Statements | Branches | Functions | Lines |
|----------------|-----------|----------|-----------|-------|
| authSlice      | 100%      | 100%     | 100%      | 100%  |
| aktenSlice     | 98.96%    | 75.4%    | 100%      | 98.83%|
| emailSlice     | 95%+      | 90%+     | 100%      | 95%+  |
| serviceSlice   | 95%+      | 90%+     | 100%      | 95%+  |
| personSlice    | 95%+      | 90%+     | 100%      | 95%+  |
| connectionSlice| 90%+      | 85%+     | 100%      | 90%+  |
| pairingSlice   | 90%+      | 85%+     | 100%      | 90%+  |
| loggingSlice   | 90%+      | 85%+     | 100%      | 90%+  |
| languageSlice  | 90%+      | 85%+     | 100%      | 90%+  |

**Status**: ✅ All Redux Slices Fully Tested

---

## 📞 Getting Help

**Questions about tests?**
1. Check this guide first
2. Review existing test files as examples
3. Check inline comments in `testSetup.ts` and `mockFactories.ts`
4. Review Jest/Testing Library documentation

**Found a bug in tests?**
1. Verify mock setup in `beforeEach`
2. Check if `cleanupTests()` is called
3. Ensure state is not shared between tests
4. Run with `--verbose` flag for detailed output

**Need to add new mocks?**
1. Add to `testSetup.ts` for reusable mocks
2. Add to `mockFactories.ts` for data factories
3. Add to `setupTests.ts` for global mocks
4. Document usage with JSDoc comments
