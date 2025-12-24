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
   * @returns Promise<boolean> - true if refresh was successful, false otherwise
   * @throws Error if no refresh token is available
   */
  async refreshToken(): Promise<boolean> {
    console.log('🔄 TokenService: Initiating token refresh...');
    
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

    // Token is expired, try to refresh
    console.log('🔄 TokenService: Token expired, attempting refresh...');
    const refreshSuccess = await this.refreshToken();
    
    if (refreshSuccess) {
      return this.getCurrentToken();
    }
    
    return null;
  }

  // TODO: Add background token refresh service that monitors expiry and refreshes at 75% lifetime
  // TODO: Implement retry logic with fresh token after auth failure
  // TODO: Add token refresh queue to prevent multiple simultaneous refresh requests
  // TODO: Implement clock skew detection and compensation
  // TODO: Add token pre-validation before critical operations
  // TODO: Implement secure token storage with encryption
  // TODO: Add token revocation support
}

// Export singleton instance
export const tokenService = new TokenService();
