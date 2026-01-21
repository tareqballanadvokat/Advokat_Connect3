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
 * ICE Server Configuration (STUN/TURN servers)
 */
export interface IceServerConfig {
  /** STUN/TURN server URLs (e.g., stun:example.com:3478 or turn:example.com:3478) */
  urls: string | string[];
  /** Username for TURN authentication (optional, required for TURN) */
  username?: string;
  /** Credential/password for TURN authentication (optional, required for TURN) */
  credential?: string;
}

/**
 * WebRTC Configuration
 */
export interface WebRTCConfig {
  /** Array of ICE servers (STUN/TURN) for peer connection */
  iceServers: IceServerConfig[];
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
  /** WebRTC peer connection configuration */
  webrtc: WebRTCConfig;
  /** DevExtreme theme configuration */
  theme: {
    name: string;
    compact: boolean;
  };
}
