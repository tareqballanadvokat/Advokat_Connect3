/**
 * Configuration Types
 * Type definitions for all configuration objects
 */

/**
 * Environment types for the application
 */
export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  TEST = 'test'
}

/**
 * SIP/WebRTC Signaling Server Configuration
 */
export interface SipServerConfig {
  /** WebSocket URI for SIP signaling (e.g., wss://example.com:8009) */
  wsUri: string;
  /** SIP URI for the user (e.g., sip:user@host:port) */
  sipUri: string;
  /** SIP server host/IP */
  host: string;
  /** SIP server port */
  port: number;
  /** From display name (caller) */
  fromDisplayName: string;
  /** To display name (callee) */
  toDisplayName: string;
  /** Maximum connection retries */
  maxRetries: number;
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
}

/**
 * API Backend Server Configuration
 */
export interface ApiServerConfig {
  /** Base URL for API endpoints (e.g., https://api.example.com) */
  baseUrl: string;
  /** API timeout in milliseconds */
  timeout: number;
  /** Enable/disable request logging */
  enableLogging: boolean;
}

/**
 * Complete Application Configuration
 */
export interface AppConfig {
  /** Current environment */
  environment: Environment;
  /** SIP/WebRTC signaling configuration */
  sip: SipServerConfig;
  /** API backend configuration */
  api: ApiServerConfig;
  /** DevExtreme theme configuration */
  theme: {
    name: string;
    compact: boolean;
  };
}
