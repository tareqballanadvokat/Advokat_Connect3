import { store } from '../../store';
import { selectAuthToken, selectRefreshToken, authenticationSuccess, startAuthentication, authenticationFailure } from '../../store/slices/authSlice';
import { webRTCApiService } from './webRTCApiService';
import type { IAuthResponse } from '../components/interfaces/IAuth';

/**
 * Token Service for JWT token validation and management
 * Handles token expiration checks, validation logging, and token refresh logic with secure storage
 */
export class TokenService {
  private static readonly TOKEN_EXPIRY_BUFFER_MS = 30000; // 30 seconds
  private static readonly ENCRYPTION_ALGORITHM = 'AES-GCM';
  private static readonly ENCRYPTION_KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  
  /**
   * Promise tracking an in-progress token refresh operation
   * Prevents multiple simultaneous refresh requests
   */
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * Cached encryption key for token storage
   * Generated once per session and stored in memory
   */
  private encryptionKey: CryptoKey | null = null;

  /**
   * Gets or creates the encryption key for token storage
   * Key is generated once per session and cached in memory
   * @returns Promise<CryptoKey> The encryption key
   */
  private async getEncryptionKey(): Promise<CryptoKey> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    // Generate a new key for this session
    this.encryptionKey = await crypto.subtle.generateKey(
      {
        name: TokenService.ENCRYPTION_ALGORITHM,
        length: TokenService.ENCRYPTION_KEY_LENGTH
      },
      false, // Not extractable for security
      ['encrypt', 'decrypt']
    );

    console.log('🔐 Generated new encryption key for token storage');
    return this.encryptionKey;
  }

  /**
   * Encrypts a string using AES-GCM
   * @param plaintext - The text to encrypt
   * @returns Promise<string> Base64-encoded encrypted data (IV + ciphertext)
   * @throws {Error} If plaintext is empty or encryption fails
   */
  async encryptToken(plaintext: string): Promise<string> {
    if (!plaintext) {
      throw new Error('Cannot encrypt empty token');
    }

    try {
      const key = await this.getEncryptionKey();
      
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(TokenService.IV_LENGTH));
      
      // Encode plaintext to bytes
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);
      
      // Encrypt
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: TokenService.ENCRYPTION_ALGORITHM,
          iv: iv
        },
        key,
        data
      );
      
      // Combine IV and ciphertext
      const encryptedArray = new Uint8Array(encryptedBuffer);
      const combined = new Uint8Array(iv.length + encryptedArray.length);
      combined.set(iv, 0);
      combined.set(encryptedArray, iv.length);
      
      // Convert to base64
      let binary = '';
      for (let i = 0; i < combined.length; i++) {
        binary += String.fromCharCode(combined[i]);
      }
      const base64 = btoa(binary);
      
      console.log('🔐 Token encrypted successfully');
      return base64;
    } catch (error) {
      console.error('❌ Failed to encrypt token:', error);
      throw new Error(`Token encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypts an authentication response before storing in Redux
   * @param authResponse - The authentication response with plain tokens
   * @returns Promise<IAuthResponse> Authentication response with encrypted tokens
   */
  async encryptAuthResponse(authResponse: IAuthResponse): Promise<IAuthResponse> {
    const encryptedAccessToken = await this.encryptToken(authResponse.access_token);
    const encryptedRefreshToken = authResponse.refresh_token
      ? await this.encryptToken(authResponse.refresh_token)
      : null; // Return null if server doesn't provide refresh token

    return {
      ...authResponse,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken
    };
  }

  /**
   * Decrypts a string using AES-GCM
   * @param encryptedBase64 - Base64-encoded encrypted data (IV + ciphertext)
   * @returns Promise<string | null> The decrypted plaintext or null if decryption fails
   */
  async decryptToken(encryptedBase64: string): Promise<string | null> {
    if (!encryptedBase64) {
      return null;
    }

    try {
      const key = await this.getEncryptionKey();
      
      // Decode from base64
      const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      
      // Extract IV and ciphertext
      const iv = combined.slice(0, TokenService.IV_LENGTH);
      const ciphertext = combined.slice(TokenService.IV_LENGTH);
      
      // Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: TokenService.ENCRYPTION_ALGORITHM,
          iv: iv
        },
        key,
        ciphertext
      );
      
      // Decode bytes to string
      const decoder = new TextDecoder();
      const plaintext = decoder.decode(decryptedBuffer);
      
      return plaintext;
    } catch (error) {
      console.error('❌ Failed to decrypt token:', error);
      console.error('❌ Token decryption failed - authentication required');
      return null;
    }
  }

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
   * Gets the current token from Redux store and decrypts it
   * @returns Promise<string | null> Current authentication token or null
   */
  async getCurrentToken(): Promise<string | null> {
    const state = store.getState();
    const encryptedToken = selectAuthToken(state);
    
    if (!encryptedToken) {
      return null;
    }
    
    // Decrypt the token before returning
    return await this.decryptToken(encryptedToken);
  }

  /**
   * Validates the current token from store
   * @returns Promise<boolean> true if current token is expired or invalid
   */
  async isCurrentTokenExpired(): Promise<boolean> {
    const token = await this.getCurrentToken();
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
   * Encrypts tokens before storing in Redux
   * @returns Promise<boolean> - true if refresh was successful, false otherwise
   * @private
   */
  private async performTokenRefresh(): Promise<boolean> {
    const state = store.getState();
    const encryptedRefreshToken = selectRefreshToken(state);
    
    if (!encryptedRefreshToken) {
      const error = 'No refresh token available. User must re-authenticate.';
      console.error('❌ TokenService:', error);
      throw new Error(error);
    }

    try {
      // Decrypt the refresh token before using it
      const refreshToken = await this.decryptToken(encryptedRefreshToken);
      
      if (!refreshToken) {
        throw new Error('Failed to decrypt refresh token');
      }
      
      // Dispatch authentication start
      store.dispatch(startAuthentication());
      
      // Call the WebRTC API service to refresh the token
      const authResponse: IAuthResponse = await webRTCApiService.refreshToken(refreshToken);
      
      // Encrypt tokens before storing (null if server doesn't provide new refresh token)
      const encryptedAuthResponse = await this.encryptAuthResponse(authResponse);
      
      // Update Redux store with encrypted tokens
      store.dispatch(authenticationSuccess(encryptedAuthResponse));
      
      console.log('✅ TokenService: Token refresh successful (tokens encrypted)');
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
   * Returns decrypted token
   * @returns Promise<string | null> - Returns fresh decrypted token or null if refresh failed
   */
  async ensureValidToken(): Promise<string | null> {
    const currentToken = await this.getCurrentToken();
    
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
      return await this.getCurrentToken();
    }

    // Token is expired, try to refresh
    console.log('🔄 TokenService: Token expired, attempting refresh...');
    const refreshSuccess = await this.refreshToken();
    
    if (refreshSuccess) {
      return await this.getCurrentToken();
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

  // TODO: Add background token refresh service that monitors expiry and refreshes at 75% lifetime (optional)
  // TODO: Implement clock skew detection and compensation (optional)
  // TODO: Add token revocation support (optional)
  // DONE: Automatic token refresh with refreshToken() and performTokenRefresh()
  // DONE: Token refresh queue preventing simultaneous requests
  // DONE: Retry logic simplified to pre-request validation
  // DONE: Token pre-validation before critical operations (ensureValidToken())
  // DONE: Secure token storage with AES-GCM encryption
}

// Export singleton instance
export const tokenService = new TokenService();
