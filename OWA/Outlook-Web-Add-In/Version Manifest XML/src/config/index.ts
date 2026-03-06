/* eslint-disable no-undef */
/**
 * Centralized Configuration Service
 * Main entry point for all configuration access
 */

import { AppConfig, SipServerConfig, ApiServerConfig } from "./types";
import { getEnvironmentConfig, isProduction } from "./environment";
import { getLogger } from "@services/logger";

const logger = getLogger();

/**
 * Application Version
 * The cache will be automatically cleared when the version changes.
 */
export const APP_VERSION = "1.0.0";

/**
 * Feature Flags
 */
export const ENABLE_CACHE_STATS = process.env.NODE_ENV !== "production"; // Hide in production

/**
 * Configuration Service Class
 * Manages application configuration with support for:
 * - Environment-based configuration
 * - Configuration validation
 * - Type-safe access to all settings
 */
class ConfigService {
  private config: AppConfig;

  constructor() {
    // Initialize with environment-based configuration
    this.config = getEnvironmentConfig();
    logger.info(`Initialized with ${this.config.environment} environment`, "ConfigService");
  }

  /**
   * Get the complete current configuration
   */
  public getConfig(): Readonly<AppConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Get SIP server configuration
   */
  public getSipConfig(): Readonly<SipServerConfig> {
    return Object.freeze({ ...this.config.sip });
  }

  /**
   * Get API server configuration
   */
  public getApiConfig(): Readonly<ApiServerConfig> {
    return Object.freeze({ ...this.config.api });
  }

  /**
   * Get API base URL with trailing slash handling
   */
  public getApiBaseUrl(): string {
    const baseUrl = this.config.api.baseUrl;
    return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  }

  /**
   * Get full API endpoint URL
   * @param path - API endpoint path (e.g., 'api/service/get-services')
   */
  public getApiUrl(path: string): string {
    const baseUrl = this.getApiBaseUrl();
    const cleanPath = path.startsWith("/") ? path.substring(1) : path;
    return `${baseUrl}${cleanPath}`;
  }

  /**
   * Build SIP URI for a given user/display name
   * @param displayName - Display name for the SIP URI
   */
  public buildSipUri(displayName: string): string {
    const { host, port } = this.config.sip;
    return `sip:${displayName}@${host}:${port}`;
  }

  /**
   * Build WebSocket URI
   */
  public getWebSocketUri(): string {
    return this.config.sip.wsUri;
  }

  /**
   * Validate current configuration
   * @returns Array of validation error messages (empty if valid)
   */
  public validateConfig(): string[] {
    const errors: string[] = [];

    // Validate SIP config
    if (!this.config.sip.wsUri) {
      errors.push("SIP WebSocket URI is not configured");
    }
    if (!this.config.sip.host) {
      errors.push("SIP host is not configured");
    }
    if (!this.config.sip.port || this.config.sip.port <= 0) {
      errors.push("SIP port is invalid");
    }

    // Validate API config
    if (!this.config.api.baseUrl) {
      errors.push("API base URL is not configured");
    }

    // Production-specific validations
    if (isProduction()) {
      if (
        this.config.sip.host.includes("localhost") ||
        this.config.sip.host.includes("127.0.0.1")
      ) {
        errors.push("CRITICAL: Production environment is using localhost for SIP server");
      }
      if (this.config.api.baseUrl.includes("localhost")) {
        errors.push("CRITICAL: Production environment is using localhost for API server");
      }
    }

    return errors;
  }

  /**
   * Log current configuration (with sensitive data masked)
   */
  public logConfig(): void {
    logger.debug("Current Configuration:", "ConfigService");
    logger.debug(`Environment: ${this.config.environment}`, "ConfigService");
    logger.debug(`SIP WebSocket URI: ${this.config.sip.wsUri}`, "ConfigService");
    logger.debug(`SIP Host: ${this.config.sip.host}`, "ConfigService");
    logger.debug(`SIP Port: ${this.config.sip.port}`, "ConfigService");
    logger.debug(`API Base URL: ${this.config.api.baseUrl}`, "ConfigService");
    logger.debug(`API Logging: ${this.config.api.enableLogging}`, "ConfigService");
  }

  /**
   * Reset configuration to environment defaults
   * Useful for testing or after configuration errors
   */
  public reset(): void {
    logger.info("Resetting configuration to environment defaults", "ConfigService");
    this.config = getEnvironmentConfig();
  }
}

// Export singleton instance
export const configService = new ConfigService();

// Export convenience function for getting config
export const getConfig = () => configService.getConfig();

// Export types and utilities
export * from "./types";
export { detectEnvironment, isDevelopment, isProduction, isStaging, isTest } from "./environment";
