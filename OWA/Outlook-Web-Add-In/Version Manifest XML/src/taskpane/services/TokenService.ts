import { store } from '../../store';
import { selectAuthToken, selectRefreshToken, authenticationSuccess, startAuthentication, authenticationFailure } from '../../store/slices/authSlice';
import { webRTCApiService } from './webRTCApiService';
import type { IAuthResponse } from '../components/interfaces/IAuth';

/**
 * Token Service for JWT token validation and management
 * Handles token expiration checks, validation logging, and future token refresh logic
 */
export class TokenService {
  private static readonly TOKEN_EXPIRY_BUFFER_MS = 30000; // 30 seconds
  /**
   * Promise tracking an in-progress token refresh operation
   * Prevents multiple simultaneous refresh requests
   */
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * Validates if a JWT token is expired or about to expire
   * @param token - JWT token to validate
   * @returns true if token is expired or expiring soon
   */
  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('⚠️ Invalid JWT token format');
        return true;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      const nbf = payload.nbf ? payload.nbf * 1000 : null;
      const now = Date.now();
      
      // Check expiration with buffer
      const isExpired = now >= (exp - TokenService.TOKEN_EXPIRY_BUFFER_MS);
      
      // Check not-before if present
      const isNotYetValid = nbf ? now < nbf : false;
      
      if (isExpired) {
        console.warn('⚠️ Token expired or expiring soon');
        console.warn(`  Expires: ${new Date(exp).toISOString()}`);
        console.warn(`  Current: ${new Date(now).toISOString()}`);
        console.warn(`  Time until expiry: ${Math.floor((exp - now) / 1000)}s`);
      }
      
      if (isNotYetValid) {
        console.warn('⚠️ Token not yet valid (nbf claim)');
        console.warn(`  Not before: ${new Date(nbf!).toISOString()}`);
        console.warn(`  Current: ${new Date(now).toISOString()}`);
      }
      
      return isExpired || isNotYetValid;
    } catch (error) {
      console.error('❌ Error parsing JWT token:', error);
      return true; // Treat parsing errors as expired
    }
  }

  /**
   * Logs detailed token validation information for debugging
   * @param token - JWT token to validate
   * @param messageType - Message type for context
   */
  logTokenValidation(token: string, messageType: string): void {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000;
      const nbf = payload.nbf ? payload.nbf * 1000 : null;
      const now = Date.now();
      
      console.log('🔐 Token validation for', messageType);
      console.log(`  Issuer: ${payload.iss || 'not set'}`);
      console.log(`  Subject: ${payload.sub || 'not set'}`);
      console.log(`  Expires: ${new Date(exp).toISOString()}`);
      console.log(`  Not before: ${nbf ? new Date(nbf).toISOString() : 'not set'}`);
      console.log(`  Current time: ${new Date(now).toISOString()}`);
      console.log(`  Time until expiry: ${Math.floor((exp - now) / 1000)}s`);
      console.log(`  Valid: ${now < exp && (!nbf || now >= nbf)}`);
    } catch (error) {
      console.warn('⚠️ Could not decode token for validation logging:', error);
    }
  }

  /**
   * Gets the current token from Redux store
   * @returns Current authentication token or null
   */
  getCurrentToken(): string | null {
    const state = store.getState();
    return selectAuthToken(state);
  }

  /**
   * Validates the current token from store
   * @returns true if current token is expired or invalid
   */
  isCurrentTokenExpired(): boolean {
    const token = this.getCurrentToken();
    if (!token) {
      return true;
    }
    return this.isTokenExpired(token);
  }

  /**
   * Automatically refreshes the authentication token using the refresh token
   * Updates Redux store with new token on success
   * Implements queuing to prevent multiple simultaneous refresh requests
   * @returns Promise<boolean> - true if refresh was successful, false otherwise
   * @throws Error if no refresh token is available
   */
  async refreshToken(): Promise<boolean> {
    // If a refresh is already in progress, return the existing promise
    if (this.refreshPromise) {
      console.log('🔄 TokenService: Token refresh already in progress, joining queue...');
      return this.refreshPromise;
    }

    console.log('🔄 TokenService: Initiating token refresh...');
    
    // Create new refresh promise
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      // Clear the promise when done (success or failure)
      this.refreshPromise = null;
    }
  }

  /**
   * Internal method that performs the actual token refresh operation
   * Separated from refreshToken() to enable proper queuing
   * @returns Promise<boolean> - true if refresh was successful, false otherwise
   * @private
   */
  private async performTokenRefresh(): Promise<boolean> {
    const state = store.getState();
    const refreshToken = selectRefreshToken(state);
    
    if (!refreshToken) {
      const error = 'No refresh token available. User must re-authenticate.';
      console.error('❌ TokenService:', error);
      throw new Error(error);
    }

    try {
      // Dispatch authentication start
      store.dispatch(startAuthentication());
      
      // Call the WebRTC API service to refresh the token
      const authResponse: IAuthResponse = await webRTCApiService.refreshToken(refreshToken);
      
      // Update Redux store with new tokens
      store.dispatch(authenticationSuccess(authResponse));
      
      console.log('✅ TokenService: Token refresh successful');
      console.log(`  New token expires in: ${authResponse.expires_in}s`);
      console.log(`  Refresh token expires in: ${authResponse.refresh_token_lifetime}s`);
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during token refresh';
      console.error('❌ TokenService: Token refresh failed:', errorMessage);
      
      // Dispatch authentication failure
      store.dispatch(authenticationFailure(errorMessage));
      
      return false;
    }
  }

  /**
   * Checks if token needs refresh and refreshes it automatically
   * Prevents race conditions by checking for in-progress refresh
   * @returns Promise<string | null> - Returns fresh token or null if refresh failed
   */
  async ensureValidToken(): Promise<string | null> {
    const currentToken = this.getCurrentToken();
    
    // No token at all - user needs to authenticate
    if (!currentToken) {
      console.warn('⚠️ TokenService: No token available');
      return null;
    }

    // Token is still valid
    if (!this.isTokenExpired(currentToken)) {
      return currentToken;
    }

    // If refresh is already in progress, wait for it
    if (this.isRefreshInProgress()) {
      console.log('🔄 TokenService: Token expired, refresh already in progress, waiting...');
      await this.refreshToken(); // This will join the existing refresh
      return this.getCurrentToken();
    }

    // Token is expired, try to refresh
    console.log('🔄 TokenService: Token expired, attempting refresh...');
    const refreshSuccess = await this.refreshToken();
    
    if (refreshSuccess) {
      return this.getCurrentToken();
    }
    
    return null;
  }

  /**
   * Checks if a token refresh is currently in progress
   * @returns true if refresh is in progress, false otherwise
   */
  isRefreshInProgress(): boolean {
    return this.refreshPromise !== null;
  }

  /**
   * Checks if an error is an authentication-related error that should trigger token refresh
   * @param error - The error to check
   * @returns true if error is auth-related (401, 403, or contains auth keywords)
   */
  isAuthenticationError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    
    // Check for HTTP status codes
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      return true;
    }
    
    // Check for authentication-related keywords
    const authKeywords = [
      'unauthorized',
      'authentication failed',
      'token expired',
      'token may be expired',
      'invalid token',
      'token not valid'
    ];
    
    return authKeywords.some(keyword => errorMessage.includes(keyword));
  }

  // TODO: Add background token refresh service that monitors expiry and refreshes at 75% lifetime
  // TODO: Implement clock skew detection and compensation
  // TODO: Add token pre-validation before critical operations
  // TODO: Implement secure token storage with encryption
  // TODO: Add token revocation support
}

// Export singleton instance
export const tokenService = new TokenService();
