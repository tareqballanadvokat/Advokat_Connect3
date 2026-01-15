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
  
  theme: {
    name: 'devextreme/dist/css/dx.',
    compact: false,
  },
};

/**
 * Production configuration
 * IMPORTANT: Update these values with your production endpoints
 * You can set these via environment variables or modify this file
 */
export const PRODUCTION_CONFIG: Partial<AppConfig> = {
  environment: Environment.PRODUCTION,
  
  sip: {
    // TODO: Set production SIP/WebRTC signaling server
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
    // TODO: Set production API server
    baseUrl: 'https://api.production.com',
    timeout: 30000,
    enableLogging: false, // Disable verbose logging in production
  },
};

/**
 * Staging configuration
 * IMPORTANT: Update these values with your staging endpoints
 */
export const STAGING_CONFIG: Partial<AppConfig> = {
  environment: Environment.STAGING,
  
  sip: {
    // TODO: Set staging SIP/WebRTC signaling server
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
    // TODO: Set staging API server
    baseUrl: 'https://api.staging.com',
    timeout: 30000,
    enableLogging: true,
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
  
  theme: {
    name: 'devextreme/dist/css/dx.',
    compact: false,
  },
};
