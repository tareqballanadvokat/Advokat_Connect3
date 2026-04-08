# WebRTC Service Error Handling Tests

## Overview
Comprehensive WebRTC error handling tests for Redux slices that use WebRTC communication. These tests verify proper error handling for network failures, connection issues, and various HTTP error codes.

## Test Coverage

### emailSlice.ts
**Location:** `src/store/slices/__tests__/emailSlice.test.ts`

Tests for `saveDokumentAsync` thunk:
- Network timeout handling
- Connection refused errors
- 400 Bad Request
- 401 Unauthorized
- 500 Internal Server Error
- 503 Service Unavailable
- Null response body handling
- Successful save with 200 status

### aktenSlice.ts
**Location:** `src/store/slices/__tests__/aktenSlice.test.ts`

Tests organized by async thunk:

#### getFavoriteAktenAsync
- Network timeout handling
- Connection refused errors
- Null response body handling

#### getCaseDocumentsAsync
- Network timeout handling
- Connection refused errors
- 400 Bad Request with error message validation

#### getEmailDocumentsAsync
- Network timeout handling
- Connection refused errors

#### addAktToFavoriteAsync
- Network timeout handling
- Connection refused errors

#### removeAktFromFavoriteAsync
- Network timeout handling
- Connection refused errors

### serviceSlice.ts
**Location:** `src/store/slices/__tests__/serviceSlice.test.ts`

#### loadServicesAsync
- Network timeout handling
- Connection refused errors
- 400 Bad Request
- 401 Unauthorized
- 500 Internal Server Error
- Null response body handling

#### saveLeistungAsync
- Network timeout handling
- Connection refused errors
- 400 Bad Request with error message validation
- 500 Internal Server Error

### personSlice.ts
**Location:** `src/store/slices/__tests__/personSlice.test.ts`

#### personLookUpAsync
- Network timeout handling
- Connection refused errors
- 400 Bad Request
- 500 Internal Server Error
- Null response body handling

#### getFavoritePersonsAsync
- Network timeout handling
- Connection refused errors
- 401 Unauthorized
- Null response body handling

#### addPersonToFavoritesAsync
- Network timeout handling
- Connection refused errors
- 409 Conflict (Already Exists)
- Successful addition with 200 status

#### removePersonFromFavoritesAsync
- Network timeout handling
- Connection refused errors
- 404 Not Found
- Successful removal with 200 status

## Test Pattern Used

All WebRTC error handling tests follow this pattern:

```typescript
it('should handle network timeouts', async () => {
  // Mock the WebRTC service to reject with error
  mockWebRTCService.method.mockRejectedValue(new Error('Network timeout'));
  
  // Create mock dispatch and getState
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({ sliceName: initialState })); // Only if thunk needs state
  
  // Execute the thunk
  const result = await thunkAsync(params)(dispatch, getState, undefined);
  
  // Verify rejection
  expect(result.type).toBe('slice/thunk/rejected');
  
  // Use type narrowing to access error
  if (thunkAsync.rejected.match(result)) {
    expect(result.error.message).toBe('Network timeout');
  }
});
```

## Key Features

### Type-Safe Testing
- Uses Redux Toolkit's `.match()` methods for type narrowing
- Properly typed mock functions
- TypeScript compilation validation

### Comprehensive Error Coverage
- Network-level errors (timeout, connection refused)
- HTTP error codes (400, 401, 500, 503)
- Edge cases (null response body)
- Success cases for comparison

### Mock State Management
- Provides proper Redux state for thunks that use `getState()`
- Example: `getCaseDocumentsAsync` accesses cache via state



## Benefits

1. **Reliability:** Ensures WebRTC errors are properly handled and propagated
2. **User Experience:** Validates error messages are meaningful
3. **Regression Prevention:** Catches breaking changes to error handling
4. **Documentation:** Tests serve as examples of expected error behavior
5. **Debugging:** Makes it easier to identify issues in production

## Related Files

- `src/store/slices/__tests__/emailSlice.test.ts` - Email slice WebRTC error tests
- `src/store/slices/__tests__/aktenSlice.test.ts` - Akten slice WebRTC error tests
- `src/store/slices/__tests__/serviceSlice.test.ts` - Service slice WebRTC error tests
- `src/store/slices/__tests__/personSlice.test.ts` - Person slice WebRTC error tests
- `src/store/slices/testHelpers.ts` - Shared WebRTC mock utilities
- `TESTING_GUIDE.md` - Complete testing documentation

## Future Enhancements

- Tests for WebRTC connection recovery scenarios
- Tests for retry logic (if implemented)
- Tests for concurrent error scenarios
- Performance tests for large error payloads
- Integration tests combining multiple WebRTC operations
