/**
 * Test Helpers and Utilities
 * Reusable functions for testing Redux slices and components
 * 
 * ## WebRTC Service Mocking
 * 
 * All slice tests that interact with the WebRTC API should use the shared mock:
 * 
 * ```typescript
 * import { createMockWebRTCService, setupDefaultWebRTCMocks } from '../testHelpers';
 * 
 * // Create the mock service once
 * const mockWebRTCService = createMockWebRTCService();
 * 
 * // Mock the connection manager
 * jest.mock('../../../taskpane/services/WebRTCConnectionManager', () => ({
 *   getWebRTCConnectionManager: jest.fn(() => ({
 *     getWebRTCApiService: jest.fn(() => mockWebRTCService),
 *   })),
 * }));
 * 
 * // In beforeEach, reset to default implementations
 * beforeEach(() => {
 *   jest.clearAllMocks();
 *   setupDefaultWebRTCMocks(mockWebRTCService);
 *   
 *   // Override specific methods as needed for your tests
 *   mockWebRTCService.getFavoriteAkten.mockResolvedValue({ statusCode: 200, body: '[...]' });
 * });
 * ```
 */

import { configureStore } from '@reduxjs/toolkit';
import emailReducer from './emailSlice';
import serviceReducer from './serviceSlice';
import aktenReducer from './aktenSlice';
import personReducer from './personSlice';
import authReducer from './authSlice';

/**
 * Create a mock Redux store for testing
 * @param preloadedState - Optional initial state
 * @returns Configured test store
 */
export function createTestStore(preloadedState?: any) {
  const reducers = {
    email: emailReducer,
    service: serviceReducer,
    akten: aktenReducer,
    person: personReducer,
    auth: authReducer,
  };
  
  return configureStore({
    reducer: reducers as any,
    preloadedState,
  });
}

/**
 * Helper to create a mock authenticated state
 */
export function createMockAuthState(overrides = {}) {
  return {
    credentials: {
      grant_type: 'password' as const,
      client_id: 'TestClientId',
      client_secret: 'TestClientId',
      username: 'testuser',
      password: 'testpass',
    },
    token: 'mock-access-token',
    tokenType: 'Bearer',
    expiresAt: Date.now() + 3600000, // 1 hour from now
    refreshToken: 'mock-refresh-token',
    refreshTokenExpiresAt: Date.now() + 7200000, // 2 hours from now
    isAuthenticated: true,
    isAuthenticating: false,
    error: null,
    ...overrides,
  };
}

/**
 * Wait for a specific amount of time (for async tests)
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Mock fetch for API testing
 */
export function mockFetch(response: any, status = 200) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
      text: async () => JSON.stringify(response),
    } as Response)
  );
}

/**
 * Mock fetch that rejects (for error testing)
 */
export function mockFetchError(error: Error) {
  global.fetch = jest.fn(() => Promise.reject(error));
}

/**
 * Standard cleanup for all tests
 * Use in afterEach(() => { cleanupTests(); })
 */
export function cleanupTests() {
  jest.clearAllMocks();
  jest.clearAllTimers();
  if (global.fetch && 'mockClear' in global.fetch) {
    (global.fetch as jest.Mock).mockClear();
  }
}

/**
 * Create a mock WebRTC API Service with all common methods
 * Can be customized per test file by overriding specific methods
 */
export function createMockWebRTCService() {
  return {
    // Akten methods
    getFavoriteAkten: jest.fn(),
    aktLookUp: jest.fn(),
    addAktToFavorite: jest.fn(),
    removeAktFromFavorite: jest.fn(),
    
    // Document methods
    GetDocuments: jest.fn(),
    saveDokument: jest.fn(),
    getAvailableFolders: jest.fn(),
    getDocumentWithContent: jest.fn(),
    downloadDocument: jest.fn(),
    
    // Service methods
    loadServices: jest.fn(),
    saveLeistung: jest.fn(),
    
    // Person methods
    getFavoritePersons: jest.fn(),
    personLookUp: jest.fn(),
    addPersonToFavorites: jest.fn(),
    removePersonFromFavorites: jest.fn(),
    
    // Auth methods
    authenticate: jest.fn(),
    refreshToken: jest.fn(),
    
    // Connection status
    isReady: jest.fn(),
  };
}

/**
 * Setup default mock implementations for WebRTC service
 * Call this in beforeEach to reset mocks with default successful responses
 */
export function setupDefaultWebRTCMocks(mockService: ReturnType<typeof createMockWebRTCService>) {
  // Akten defaults
  mockService.getFavoriteAkten.mockResolvedValue({ statusCode: 200, body: '[]' });
  mockService.aktLookUp.mockResolvedValue({ statusCode: 200, body: '[]' });
  mockService.addAktToFavorite.mockResolvedValue({ statusCode: 200 });
  mockService.removeAktFromFavorite.mockResolvedValue({ statusCode: 200 });
  
  // Document defaults
  mockService.GetDocuments.mockResolvedValue({ statusCode: 200, body: '[]' });
  mockService.saveDokument.mockResolvedValue({ statusCode: 200, body: 'Success' });
  mockService.getAvailableFolders.mockResolvedValue({ statusCode: 200, body: '[]' });
  mockService.getDocumentWithContent.mockResolvedValue({ statusCode: 200, body: '{}' });
  
  // Service defaults
  mockService.loadServices.mockResolvedValue({ statusCode: 200, body: '[]' });
  mockService.saveLeistung.mockResolvedValue({ statusCode: 200, body: 'Success' });
  
  // Person defaults
  mockService.getFavoritePersons.mockResolvedValue({ statusCode: 200, body: '[]' });
  mockService.personLookUp.mockResolvedValue({ statusCode: 200, body: '[]' });
  mockService.addPersonToFavorites.mockResolvedValue({ statusCode: 200 });
  mockService.removePersonFromFavorites.mockResolvedValue({ statusCode: 200 });
  
  // Auth defaults
  mockService.authenticate.mockResolvedValue({
    access_token: 'mock-token',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'mock-refresh-token',
  });
  mockService.refreshToken.mockResolvedValue({
    access_token: 'mock-new-token',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'mock-new-refresh-token',
  });
  
  // Connection status
  mockService.isReady.mockReturnValue(true);
}

/**
 * Create the WebRTC Connection Manager mock factory
 * Use this to mock the entire connection manager module
 * 
 * Example usage:
 * ```typescript
 * const mockWebRTCService = createMockWebRTCService();
 * jest.mock('../../../taskpane/services/WebRTCConnectionManager', () => 
 *   createWebRTCConnectionManagerMock(mockWebRTCService)
 * );
 * ```
 */
export function createWebRTCConnectionManagerMock(mockService: ReturnType<typeof createMockWebRTCService>) {
  return {
    getWebRTCConnectionManager: jest.fn(() => ({
      getWebRTCApiService: jest.fn(() => mockService),
    })),
  };
}
