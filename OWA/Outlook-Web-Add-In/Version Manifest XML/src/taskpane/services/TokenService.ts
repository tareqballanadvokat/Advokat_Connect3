import { store } from '../../store';
import { selectAuthToken } from '../../store/slices/authSlice';

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

  // TODO: Implement automatic token refresh
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
