/**
 * Unit Tests for authSlice
 * Tests all reducers, selectors, and state transitions
 */

import authReducer, {
  setCredentials,
  setPassword,
  setUsername,
  setGrantType,
  startAuthentication,
  authenticationSuccess,
  authenticationFailure,
  logout,
  clearError,
  validateToken,
  selectAuth,
  selectIsAuthenticated,
  selectAuthToken,
  selectAuthCredentials,
  selectIsAuthenticating,
  selectAuthError,
  selectIsTokenValid,
} from '../../../store/slices/authSlice';
import { IAuthState, IAuthResponse } from '../../../taskpane/components/interfaces/IAuth';

describe('authSlice', () => {
  // Clean up after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Initial state for tests
  const initialState: IAuthState = {
    credentials: {
      grant_type: 'password',
      client_id: 'TestClientId',
      client_secret: 'TestClientId',
      username: 'JCH',
      password: '',
    },
    token: null,
    tokenType: null,
    expiresAt: null,
    refreshToken: null,
    refreshTokenExpiresAt: null,
    isAuthenticated: false,
    isAuthenticating: false,
    error: null,
  };

  describe('Reducer', () => {
    it('should return the initial state', () => {
      expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
    });

    describe('setCredentials', () => {
      it('should update credentials with partial data', () => {
        const newCredentials = { username: 'NewUser', password: 'NewPass123' };
        const actual = authReducer(initialState, setCredentials(newCredentials));
        
        expect(actual.credentials.username).toBe('NewUser');
        expect(actual.credentials.password).toBe('NewPass123');
        expect(actual.credentials.client_id).toBe('TestClientId'); // Unchanged
        expect(actual.error).toBeNull();
      });

      it('should clear error when setting credentials', () => {
        const stateWithError = { ...initialState, error: 'Previous error' };
        const actual = authReducer(stateWithError, setCredentials({ username: 'TestUser' }));
        
        expect(actual.error).toBeNull();
      });
    });

    describe('setPassword', () => {
      it('should update password', () => {
        const actual = authReducer(initialState, setPassword('SecurePassword123'));
        
        expect(actual.credentials.password).toBe('SecurePassword123');
        expect(actual.error).toBeNull();
      });

      it('should clear error when setting password', () => {
        const stateWithError = { ...initialState, error: 'Invalid password' };
        const actual = authReducer(stateWithError, setPassword('NewPassword'));
        
        expect(actual.error).toBeNull();
      });
    });

    describe('setUsername', () => {
      it('should update username', () => {
        const actual = authReducer(initialState, setUsername('NewUsername'));
        
        expect(actual.credentials.username).toBe('NewUsername');
        expect(actual.error).toBeNull();
      });

      it('should clear error when setting username', () => {
        const stateWithError = { ...initialState, error: 'User not found' };
        const actual = authReducer(stateWithError, setUsername('ValidUser'));
        
        expect(actual.error).toBeNull();
      });
    });

    describe('setGrantType', () => {
      it('should update grant type to password', () => {
        const actual = authReducer(initialState, setGrantType('password'));
        
        expect(actual.credentials.grant_type).toBe('password');
        expect(actual.error).toBeNull();
      });

      it('should update grant type to client_credentials', () => {
        const actual = authReducer(initialState, setGrantType('client_credentials'));
        
        expect(actual.credentials.grant_type).toBe('client_credentials');
      });

      it('should update grant type to windows_auth', () => {
        const actual = authReducer(initialState, setGrantType('windows_auth'));
        
        expect(actual.credentials.grant_type).toBe('windows_auth');
      });

      it('should update grant type to refresh_token', () => {
        const actual = authReducer(initialState, setGrantType('refresh_token'));
        
        expect(actual.credentials.grant_type).toBe('refresh_token');
      });
    });

    describe('startAuthentication', () => {
      it('should set isAuthenticating to true and clear error', () => {
        const stateWithError = { ...initialState, error: 'Previous error' };
        const actual = authReducer(stateWithError, startAuthentication());
        
        expect(actual.isAuthenticating).toBe(true);
        expect(actual.error).toBeNull();
      });

      it('should not modify other state properties', () => {
        const actual = authReducer(initialState, startAuthentication());
        
        expect(actual.isAuthenticated).toBe(false);
        expect(actual.token).toBeNull();
      });
    });

    describe('authenticationSuccess', () => {
      it('should set authentication state correctly', () => {
        const authResponse: IAuthResponse = {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600, // 1 hour
          refresh_token: 'test-refresh-token',
          refresh_token_lifetime: 7200, // 2 hours
        };

        const beforeTime = Date.now();
        const actual = authReducer(initialState, authenticationSuccess(authResponse));
        const afterTime = Date.now();

        expect(actual.token).toBe('test-access-token');
        expect(actual.tokenType).toBe('Bearer');
        expect(actual.refreshToken).toBe('test-refresh-token');
        expect(actual.isAuthenticated).toBe(true);
        expect(actual.isAuthenticating).toBe(false);
        expect(actual.error).toBeNull();

        // Check expiration times are calculated correctly (with small tolerance)
        expect(actual.expiresAt).toBeGreaterThanOrEqual(beforeTime + 3600 * 1000);
        expect(actual.expiresAt).toBeLessThanOrEqual(afterTime + 3600 * 1000);
        expect(actual.refreshTokenExpiresAt).toBeGreaterThanOrEqual(beforeTime + 7200 * 1000);
        expect(actual.refreshTokenExpiresAt).toBeLessThanOrEqual(afterTime + 7200 * 1000);
      });

      it('should default token_type to Bearer if not provided', () => {
        const authResponse: IAuthResponse = {
          access_token: 'test-token',
          token_type: undefined,
          expires_in: 3600,
          refresh_token: 'refresh-token',
          refresh_token_lifetime: 7200,
        };

        const actual = authReducer(initialState, authenticationSuccess(authResponse));
        
        expect(actual.tokenType).toBe('Bearer');
      });

      it('should clear previous error on success', () => {
        const stateWithError = { ...initialState, error: 'Login failed', isAuthenticating: true };
        const authResponse: IAuthResponse = {
          access_token: 'token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'refresh',
          refresh_token_lifetime: 7200,
        };

        const actual = authReducer(stateWithError, authenticationSuccess(authResponse));
        
        expect(actual.error).toBeNull();
      });
    });

    describe('authenticationFailure', () => {
      it('should clear all auth data and set error', () => {
        const authenticatedState: IAuthState = {
          ...initialState,
          token: 'old-token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600000,
          refreshToken: 'old-refresh',
          refreshTokenExpiresAt: Date.now() + 7200000,
          isAuthenticated: true,
          isAuthenticating: true,
        };

        const actual = authReducer(authenticatedState, authenticationFailure('Invalid credentials'));
        
        expect(actual.token).toBeNull();
        expect(actual.tokenType).toBeNull();
        expect(actual.expiresAt).toBeNull();
        expect(actual.refreshToken).toBeNull();
        expect(actual.refreshTokenExpiresAt).toBeNull();
        expect(actual.isAuthenticated).toBe(false);
        expect(actual.isAuthenticating).toBe(false);
        expect(actual.error).toBe('Invalid credentials');
      });

      it('should preserve credentials on failure', () => {
        const actual = authReducer(initialState, authenticationFailure('Network error'));
        
        expect(actual.credentials.username).toBe('JCH');
        expect(actual.credentials.client_id).toBe('TestClientId');
      });
    });

    describe('logout', () => {
      it('should clear all authentication data', () => {
        const authenticatedState: IAuthState = {
          ...initialState,
          token: 'active-token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600000,
          refreshToken: 'active-refresh',
          refreshTokenExpiresAt: Date.now() + 7200000,
          isAuthenticated: true,
        };

        const actual = authReducer(authenticatedState, logout());
        
        expect(actual.token).toBeNull();
        expect(actual.tokenType).toBeNull();
        expect(actual.expiresAt).toBeNull();
        expect(actual.refreshToken).toBeNull();
        expect(actual.refreshTokenExpiresAt).toBeNull();
        expect(actual.isAuthenticated).toBe(false);
        expect(actual.isAuthenticating).toBe(false);
        expect(actual.error).toBeNull();
      });

      it('should preserve credentials after logout', () => {
        const actual = authReducer(initialState, logout());
        
        expect(actual.credentials).toEqual(initialState.credentials);
      });
    });

    describe('clearError', () => {
      it('should clear error message', () => {
        const stateWithError = { ...initialState, error: 'Some error occurred' };
        const actual = authReducer(stateWithError, clearError());
        
        expect(actual.error).toBeNull();
      });

      it('should not modify other state when clearing error', () => {
        const stateWithError = { 
          ...initialState, 
          error: 'Error',
          token: 'some-token',
          isAuthenticated: true,
        };
        const actual = authReducer(stateWithError, clearError());
        
        expect(actual.token).toBe('some-token');
        expect(actual.isAuthenticated).toBe(true);
        expect(actual.error).toBeNull();
      });
    });

    describe('validateToken', () => {
      it('should clear expired token', () => {
        const expiredState: IAuthState = {
          ...initialState,
          token: 'expired-token',
          tokenType: 'Bearer',
          expiresAt: Date.now() - 1000, // Expired 1 second ago
          isAuthenticated: true,
        };

        const actual = authReducer(expiredState, validateToken());
        
        expect(actual.token).toBeNull();
        expect(actual.tokenType).toBeNull();
        expect(actual.expiresAt).toBeNull();
        expect(actual.isAuthenticated).toBe(false);
        expect(actual.error).toBe('Token expired');
      });

      it('should not clear valid token', () => {
        const validState: IAuthState = {
          ...initialState,
          token: 'valid-token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600000, // Expires in 1 hour
          isAuthenticated: true,
        };

        const actual = authReducer(validState, validateToken());
        
        expect(actual.token).toBe('valid-token');
        expect(actual.tokenType).toBe('Bearer');
        expect(actual.isAuthenticated).toBe(true);
        expect(actual.error).toBeNull();
      });

      it('should handle state with no token', () => {
        const actual = authReducer(initialState, validateToken());
        
        expect(actual).toEqual(initialState);
      });
    });
  });

  describe('Selectors', () => {
    const mockRootState = {
      auth: {
        ...initialState,
        token: 'test-token',
        isAuthenticated: true,
        error: 'Test error',
      },
    };

    it('selectAuth should return auth state', () => {
      expect(selectAuth(mockRootState)).toEqual(mockRootState.auth);
    });

    it('selectIsAuthenticated should return authentication status', () => {
      expect(selectIsAuthenticated(mockRootState)).toBe(true);
      expect(selectIsAuthenticated({ auth: initialState })).toBe(false);
    });

    it('selectAuthToken should return token', () => {
      expect(selectAuthToken(mockRootState)).toBe('test-token');
      expect(selectAuthToken({ auth: initialState })).toBeNull();
    });

    it('selectAuthCredentials should return credentials', () => {
      expect(selectAuthCredentials(mockRootState)).toEqual(initialState.credentials);
    });

    it('selectIsAuthenticating should return authenticating status', () => {
      expect(selectIsAuthenticating(mockRootState)).toBe(false);
      expect(selectIsAuthenticating({ auth: { ...initialState, isAuthenticating: true } })).toBe(true);
    });

    it('selectAuthError should return error message', () => {
      expect(selectAuthError(mockRootState)).toBe('Test error');
      expect(selectAuthError({ auth: initialState })).toBeNull();
    });

    describe('selectIsTokenValid', () => {
      it('should return true for valid token', () => {
        const stateWithValidToken = {
          auth: {
            ...initialState,
            token: 'valid-token',
            expiresAt: Date.now() + 3600000, // Expires in future
          },
        };
        
        expect(selectIsTokenValid(stateWithValidToken)).toBe(true);
      });

      it('should return false for expired token', () => {
        const stateWithExpiredToken = {
          auth: {
            ...initialState,
            token: 'expired-token',
            expiresAt: Date.now() - 1000, // Expired in past
          },
        };
        
        expect(selectIsTokenValid(stateWithExpiredToken)).toBe(false);
      });

      it('should return false when no token exists', () => {
        expect(selectIsTokenValid({ auth: initialState })).toBe(false);
      });

      it('should return false when expiresAt is null', () => {
        const stateWithoutExpiry = {
          auth: {
            ...initialState,
            token: 'token-without-expiry',
            expiresAt: null,
          },
        };
        
        expect(selectIsTokenValid(stateWithoutExpiry)).toBe(false);
      });
    });
  });

  describe('State Transitions', () => {
    it('should handle complete authentication flow', () => {
      // Start with initial state
      let state = initialState;

      // User enters credentials
      state = authReducer(state, setUsername('testuser'));
      state = authReducer(state, setPassword('password123'));
      expect(state.credentials.username).toBe('testuser');
      expect(state.credentials.password).toBe('password123');

      // Start authentication
      state = authReducer(state, startAuthentication());
      expect(state.isAuthenticating).toBe(true);

      // Authentication succeeds
      const authResponse: IAuthResponse = {
        access_token: 'new-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'new-refresh',
        refresh_token_lifetime: 7200,
      };
      state = authReducer(state, authenticationSuccess(authResponse));
      expect(state.isAuthenticated).toBe(true);
      expect(state.isAuthenticating).toBe(false);
      expect(state.token).toBe('new-token');

      // User logs out
      state = authReducer(state, logout());
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.credentials.username).toBe('testuser'); // Credentials preserved
    });

    it('should handle failed authentication flow', () => {
      let state = initialState;

      // User enters credentials
      state = authReducer(state, setUsername('testuser'));
      state = authReducer(state, setPassword('wrongpassword'));

      // Start authentication
      state = authReducer(state, startAuthentication());
      expect(state.isAuthenticating).toBe(true);

      // Authentication fails
      state = authReducer(state, authenticationFailure('Invalid credentials'));
      expect(state.isAuthenticated).toBe(false);
      expect(state.isAuthenticating).toBe(false);
      expect(state.error).toBe('Invalid credentials');
      expect(state.token).toBeNull();

      // User clears error
      state = authReducer(state, clearError());
      expect(state.error).toBeNull();
    });

    it('should handle token expiration during active session', () => {
      // User is authenticated with expired token
      let state: IAuthState = {
        ...initialState,
        token: 'expired-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() - 1000,
        isAuthenticated: true,
      };

      // Validate token
      state = authReducer(state, validateToken());
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.error).toBe('Token expired');
    });
  });

  describe('Immutability', () => {
    it('should not mutate original state', () => {
      const originalState = { ...initialState };
      const newState = authReducer(originalState, setUsername('NewUser'));
      
      expect(originalState.credentials.username).toBe('JCH'); // Unchanged
      expect(newState.credentials.username).toBe('NewUser');
    });

    it('should return new object references for modified properties', () => {
      const originalState = initialState;
      const newState = authReducer(originalState, setCredentials({ username: 'NewUser' }));
      
      expect(newState).not.toBe(originalState);
      expect(newState.credentials).not.toBe(originalState.credentials);
      expect(newState.credentials.username).toBe('NewUser'); // Verify value changed
    });

    it('should preserve unmodified state properties', () => {
      const originalState = {
        ...initialState,
        token: 'existing-token',
        isAuthenticated: true,
      };
      
      const newState = authReducer(originalState, setUsername('NewUser'));
      
      expect(newState.token).toBe('existing-token'); // Unchanged
      expect(newState.isAuthenticated).toBe(true); // Unchanged
      expect(newState.credentials.username).toBe('NewUser'); // Changed
    });
  });

  describe('Error Clearing Behavior', () => {
    it('should clear error when setting credentials', () => {
      const stateWithError = { ...initialState, error: 'Previous error' };
      const state = authReducer(stateWithError, setCredentials({ username: 'test' }));
      
      expect(state.error).toBeNull();
      expect(state.credentials.username).toBe('test');
    });

    it('should clear error when setting username', () => {
      const stateWithError = { ...initialState, error: 'Previous error' };
      const state = authReducer(stateWithError, setUsername('newuser'));
      
      expect(state.error).toBeNull();
      expect(state.credentials.username).toBe('newuser');
    });

    it('should clear error when setting password', () => {
      const stateWithError = { ...initialState, error: 'Previous error' };
      const state = authReducer(stateWithError, setPassword('newpassword'));
      
      expect(state.error).toBeNull();
      expect(state.credentials.password).toBe('newpassword');
    });

    it('should clear error when setting grant type', () => {
      const stateWithError = { ...initialState, error: 'Previous error' };
      const state = authReducer(stateWithError, setGrantType('client_credentials'));
      
      expect(state.error).toBeNull();
      expect(state.credentials.grant_type).toBe('client_credentials');
    });

    it('should clear error when starting authentication', () => {
      const stateWithError = { ...initialState, error: 'Previous error' };
      const state = authReducer(stateWithError, startAuthentication());
      
      expect(state.error).toBeNull();
      expect(state.isAuthenticating).toBe(true);
    });

    it('should handle partial credential updates', () => {
      const stateWithError = { ...initialState, error: 'Previous error' };
      const partialUpdate = { username: 'NewUser' };
      const state = authReducer(stateWithError, setCredentials(partialUpdate));
      
      expect(state.credentials.username).toBe('NewUser');
      expect(state.credentials.password).toBe(''); // Other fields unchanged
      expect(state.credentials.client_id).toBe('TestClientId');
      expect(state.error).toBeNull();
    });
  });
});
