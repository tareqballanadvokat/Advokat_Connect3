/**
 * Default Configuration Values
 *
 * The SIP server address is injected at build time via webpack DefinePlugin
 * from the environment variable:
 *   - SIP_WS_URI : WebSocket URI of the SIP signaling server
 *
 * Set this in Azure Static Web Apps → Configuration → Application settings,
 * or in a local .env file for development.
 *
 * fromDisplayName is NOT set here; it is patched at runtime after the user
 * identity is resolved (see runtimeConfig.ts).
 */

import { AppConfig, Environment, LogLevel } from "./types";

// Shared SIP connection constants — same for all environments
const SIP_MAX_RETRIES = 2;
const SIP_CONNECTION_TIMEOUT_MS = 30000;
const SIP_TO_DISPLAY_NAME = "macs";

/**
 * Derive SIP host, port, and sipUri from a WebSocket URI.
 *
 * e.g. "wss://4.232.250.132:443"
 *   → host: "4.232.250.132", port: 443, sipUri: "sip:user@4.232.250.132:443"
 *
 * fromDisplayName is intentionally left out here; it is set at runtime.
 */
export function parseSipWsUri(wsUri: string): { host: string; port: number; sipUri: string } {
  try {
    // URL expects a proper scheme; replace wss/ws with https/http for parsing
    const normalized = wsUri.replace(/^wss?:\/\//, (m) => (m === "wss://" ? "https://" : "http://"));
    const url = new URL(normalized);
    const host = url.hostname;
    const port = url.port ? parseInt(url.port, 10) : url.protocol === "https:" ? 443 : 80;
    const sipUri = `sip:user@${host}:${port}`;
    return { host, port, sipUri };
  } catch {
    return { host: "", port: 0, sipUri: "" };
  }
}

// ---------------------------------------------------------------------------
// Resolved SIP values from the SIP_WS_URI environment variable
// ---------------------------------------------------------------------------
const _sipWsUri: string = process.env.SIP_WS_URI || "";
const _sipDerived = parseSipWsUri(_sipWsUri);

/**
 * Single application configuration.
 * Environment is detected at runtime by environment.ts (hostname / NODE_ENV).
 * Server addresses come from environment variables, not from hardcoded values.
 */
export const DEFAULT_CONFIG: AppConfig = {
  environment: Environment.DEVELOPMENT, // overridden by getEnvironmentConfig()

  sip: {
    wsUri: _sipWsUri,
    sipUri: _sipDerived.sipUri,
    host: _sipDerived.host,
    port: _sipDerived.port,
    // fromDisplayName is undefined until set via runtimeConfig.setUserIdentifier()
    toDisplayName: SIP_TO_DISPLAY_NAME,
    maxRetries: SIP_MAX_RETRIES,
    connectionTimeout: SIP_CONNECTION_TIMEOUT_MS,
  },

  webrtc: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },

      {
        urls: 'turn:108.143.154.176:3478',
        username: process.env.TURN_USERNAME || "",
        credential: process.env.TURN_CREDENTIAL || "",
      },
      {
        urls: 'turns:108.143.154.176:5349',
        username: process.env.TURN_USERNAME || "",
        credential: process.env.TURN_CREDENTIAL || "",
      },
    ],
  },

  logging: {
    enabled: true,
    level: LogLevel.DEBUG,
    includeTimestamp: true,
    includeStack: true,
  },

  theme: {
    name: "devextreme/dist/css/dx.",
    compact: false,
  },
};

/**
 * Test configuration for unit/integration tests.
 * Uses fixed stub values so tests are not dependent on env vars.
 */
export const TEST_CONFIG: AppConfig = {
  environment: Environment.TEST,

  sip: {
    wsUri: "wss://test.local:443",
    sipUri: "sip:user@test.local:443",
    host: "test.local",
    port: 443,
    toDisplayName: SIP_TO_DISPLAY_NAME,
    maxRetries: SIP_MAX_RETRIES,
    connectionTimeout: SIP_CONNECTION_TIMEOUT_MS,
  },

  webrtc: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
    ],
  },

  logging: {
    enabled: false,
    level: LogLevel.ERROR,
    includeTimestamp: false,
    includeStack: false,
  },

  theme: {
    name: "devextreme/dist/css/dx.",
    compact: false,
  },
};
