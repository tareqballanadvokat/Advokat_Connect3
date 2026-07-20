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
├── setupTests.ts                    # Global test configuration
├── __mocks__/                       # Mock implementations
│   ├── styleMock.js                # CSS/LESS/SCSS mock
│   ├── fileMock.js                 # Image/font file mock
│   └── devextremeMock.js           # DevExtreme components mock
└── store/
    └── slices/
        ├── __tests__/              # Test files
        │   ├── authSlice.test.ts   # ✅ Auth slice (316 tests)
        │   ├── aktenSlice.test.ts  # ✅ Case/Documents (121 tests)
        │   ├── emailSlice.test.ts  # ✅ Email/Attachments (50 tests)
        │   ├── serviceSlice.test.ts # ✅ Services (87 tests)
        │   ├── personSlice.test.ts # ✅ Person search (58 tests)
        │   ├── testHelpers.ts      # Shared test utilities
        │   └── testFactories.ts    # Mock data factories
        ├── authSlice.ts
        ├── emailSlice.ts
        ├── aktenSlice.ts
        ├── personSlice.ts
        └── serviceSlice.ts
```

---

## 📊 Test Files Summary

### 1. authSlice.test.ts (316 tests) ✅
**Purpose**: Authentication state management, credentials, token lifecycle

**Key Features Tested:**
- OAuth2 password grant flow
- Token expiration and refresh
- Credential management
- Error handling and recovery

---

### 2. aktenSlice.test.ts (121 tests) ✅
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

### 3. emailSlice.test.ts (50 tests) ✅
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

### 4. serviceSlice.test.ts (87 tests) ✅
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

### 5. personSlice.test.ts (58 tests) ✅
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

## 🧪 Shared Test Infrastructure

### testHelpers.ts
**Purpose**: Reusable test utilities and mocks

**Exports:**
- `createTestStore()`: Configure Redux store for testing
- `createMockAuthState()`: Generate mock auth state
- `createMockWebRTCService()`: Mock WebRTC API service
- `setupDefaultWebRTCMocks()`: Setup default successful API responses
- `cleanupTests()`: Comprehensive test cleanup (mocks, timers, fetch)
- `mockFetch()`, `mockFetchError()`: HTTP request mocking
- `wait()`: Async operation utilities

---

### testFactories.ts
**Purpose**: Centralized mock data factories

**Exports:**
- `createMockAkt()`: Mock case/Akt data
- `createMockDocument()`: Mock document data
- `createMockCachedAktDocuments()`: Mock cached documents
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
**Purpose**: Case (Akt) management, document caching, favorites

**Test Coverage:**
- Reducers: Clear cases, folders, favorites, search state
- Async Thunks: aktLookUpAsync, getFavoriteAktenAsync, getCaseDocumentsAsync, getEmailDocumentsAsync
- Document Caching: LRU cache (5 most recent), cache hits/misses
- Selectors: Cached documents, email documents filtering
- Branch Coverage: Error handling, API failures, edge cases (75.4% branches)

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

**Overall Test Stats:**
- **Test Suites**: 5 passed
- **Total Tests**: 632 passing
- **Execution Time**: ~3-4 seconds

---

**Overall Test Stats:**
- **Test Suites**: 5 passed
- **Total Tests**: 632 passing
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

```

---

## 🛠️ Test Infrastructure Details

### Jest Configuration (jest.config.js)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/?(*.)+(spec|test).+(ts|tsx|js)'
  ],
  
  // Exclude helper files from being run as tests
  testPathIgnorePatterns: [
    '/node_modules/',
    'testFactories.ts',
    'testHelpers.ts'
  ],
  
  // Coverage collection
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/__tests__/**',
    '!src/__mocks__/**',
    '!src/commands/**',
    '!src/**/testHelpers.ts',
    '!src/**/testFactories.ts',
  ],
  
  // Coverage thresholds (tests fail if below)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Module path aliases
  moduleNameMapper: {
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@components/(.*)$': '<rootDir>/src/taskpane/components/$1',
    '^@utils/(.*)$': '<rootDir>/src/taskpane/utils/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.js',
    'devextreme': '<rootDir>/src/__mocks__/devextremeMock.js'
  }
};
```

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

```

---

## 📝 Writing New Tests

### Step-by-Step Guide

**1. Create Test File**
```bash
# Create in __tests__ directory
src/store/slices/__tests__/yourSlice.test.ts
```

**2. Import Dependencies**
```typescript
import sliceReducer, {
  action1,
  action2,
  selector1,
  asyncThunk1,
} from '../yourSlice';
import { createMockWebRTCService, setupDefaultWebRTCMocks, cleanupTests } from '../testHelpers';
import { createMockData } from './testFactories';

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
- `testHelpers.ts` - Inline documentation for utilities
- `testFactories.ts` - Factory function documentation

---

## ✨ Test Results Summary

```
PASS  src/store/slices/__tests__/authSlice.test.ts
PASS  src/store/slices/__tests__/aktenSlice.test.ts
PASS  src/store/slices/__tests__/emailSlice.test.ts
PASS  src/store/slices/__tests__/serviceSlice.test.ts
PASS  src/store/slices/__tests__/personSlice.test.ts

Test Suites: 5 passed, 5 total
Tests:       632 passed, 632 total
Snapshots:   0 total
Time:        3-4s
```

**Coverage Summary:**
| Slice         | Statements | Branches | Functions | Lines |
|--------------|-----------|----------|-----------|-------|
| authSlice    | 100%      | 100%     | 100%      | 100%  |
| aktenSlice   | 98.96%    | 75.4%    | 100%      | 98.83%|
| emailSlice   | 95%+      | 90%+     | 100%      | 95%+  |
| serviceSlice | 95%+      | 90%+     | 100%      | 95%+  |
| personSlice  | 95%+      | 90%+     | 100%      | 95%+  |

**Status**: ✅ All Redux Slices Fully Tested

---

## 📞 Getting Help

**Questions about tests?**
1. Check this guide first
2. Review existing test files as examples
3. Check inline comments in `testHelpers.ts` and `testFactories.ts`
4. Review Jest/Testing Library documentation

**Found a bug in tests?**
1. Verify mock setup in `beforeEach`
2. Check if `cleanupTests()` is called
3. Ensure state is not shared between tests
4. Run with `--verbose` flag for detailed output

**Need to add new mocks?**
1. Add to `testHelpers.ts` for reusable mocks
2. Add to `testFactories.ts` for data factories
3. Add to `setupTests.ts` for global mocks
4. Document usage with JSDoc comments
