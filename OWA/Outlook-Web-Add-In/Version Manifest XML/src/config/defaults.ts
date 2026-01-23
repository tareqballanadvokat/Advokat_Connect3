/**
 * Default Configuration Values
 * Fallback values when no environment-specific config is provided
 */

import { AppConfig, Environment } from './types';

/**
 * Default configuration for development environment
 */
export const DEFAULT_CONFIG: AppConfig = {
  environment: Environment.DEVELOPMENT,
  
  sip: {
    wsUri: 'wss://localhost:8009',
    sipUri: 'sip:macc@127.0.0.1:8009',
    host: '127.0.0.1',
    port: 8009,
    fromDisplayName: 'macc',
    toDisplayName: 'macs',
    maxRetries: 3,
    connectionTimeout: 30000, // 30 seconds
  },
  
  api: {
    baseUrl: 'https://localhost:7231',
    timeout: 30000, // 30 seconds
    enableLogging: true,
  },
  
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { 
        urls: 'turn:108.143.154.176:3478',
        username: 'advokatuser',
        credential: '123456Advokat' // Change credentials
      },
      { 
        urls: 'turns:108.143.154.176:5349',
        username: 'advokatuser',
        credential: '123456Advokat' // Change credentials
      },
    ],
  },
  
  theme: {
    name: 'devextreme/dist/css/dx.',
    compact: false,
  },
};

/**
 * Production configuration
 * We can set these via environment variables or modify this file
 */
export const PRODUCTION_CONFIG: Partial<AppConfig> = {
  environment: Environment.PRODUCTION,
  
  sip: {
    // Update with production signaling server
    wsUri: 'wss://signaling.production.com:8009',
    sipUri: 'sip:user@signaling.production.com:8009',
    host: 'signaling.production.com',
    port: 8009,
    fromDisplayName: 'user',
    toDisplayName: 'server',
    maxRetries: 5,
    connectionTimeout: 30000,
  },
  
  api: {
    // Update with production API server
    baseUrl: 'https://api.production.com',
    timeout: 30000,
    enableLogging: false, // Disable verbose logging in production
  },
  
  webrtc: {
    iceServers: [
      // Update with Azure TURN server IP after deployment
      { urls: 'stun:108.143.154.176:3478' },
      { 
        urls: 'turn:108.143.154.176:3478',
        username: 'advokatuser',
        credential: '123456Advokat' // Change credentials
      },
      { 
        urls: 'turns:108.143.154.176:5349',
        username: 'advokatuser',
        credential: '123456Advokat' // Change credentials
      },
    ],
  },
  
  theme: {
    name: 'devextreme/dist/css/dx.',
    compact: false,
  },
};

/**
 * Staging configuration
 */
export const STAGING_CONFIG: Partial<AppConfig> = {
  environment: Environment.STAGING,
  
  sip: {
    // Update with staging signaling server
    wsUri: 'wss://signaling.staging.com:8009',
    sipUri: 'sip:user@signaling.staging.com:8009',
    host: 'signaling.staging.com',
    port: 8009,
    fromDisplayName: 'staging-user',
    toDisplayName: 'staging-server',
    maxRetries: 3,
    connectionTimeout: 30000,
  },
  
  api: {
    // Update with staging API server
    baseUrl: 'https://api.staging.com',
    timeout: 30000,
    enableLogging: true,
  },
  
  webrtc: {
    iceServers: [
      { urls: 'stun:108.143.154.176:3478' },
      { 
        urls: 'turn:108.143.154.176:3478',
        username: 'advokatuser',
        credential: '123456Advokat' // Change credentials
      },
      { 
        urls: 'turns:108.143.154.176:5349',
        username: 'advokatuser',
        credential: '123456Advokat' // Change credentials
      },
    ],
  },
  
  theme: {
    name: 'devextreme/dist/css/dx.',
    compact: false,
  },
};

/**
 * Test configuration for unit/integration tests
 * Uses the same values as development (original hard-coded values)
 */
export const TEST_CONFIG: AppConfig = {
  environment: Environment.TEST,
  
  sip: {
    wsUri: 'wss://localhost:8009',
    sipUri: 'sip:macc@127.0.0.1:8009',
    host: '127.0.0.1',
    port: 8009,
    fromDisplayName: 'macc',
    toDisplayName: 'macs',
    maxRetries: 3,
    connectionTimeout: 30000,
  },
  
  api: {
    baseUrl: 'https://localhost:7231',
    timeout: 30000,
    enableLogging: false,
  },
  
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  },
  
  theme: {
    name: 'devextreme/dist/css/dx.',
    compact: false,
  },
};
