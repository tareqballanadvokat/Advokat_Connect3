/**
 * Logger Service - Main Export
 * Provides singleton logger instance throughout the application
 */

import { Logger } from "./Logger";
import { LogLevel, LoggerConfig } from "./types";

// Export types
export { Logger, LogLevel, LoggerConfig };

// Export singleton instance (will be initialized with config from environment)
let loggerInstance: Logger | null = null;

/**
 * Initialize logger with configuration
 * Should be called once during app initialization
 * If logger already exists, updates its configuration
 */
export function initializeLogger(config: LoggerConfig): Logger {
  loggerInstance = Logger.getInstance(config);
  loggerInstance.updateConfig(config);
  return loggerInstance;
}

/**
 * Get the logger instance
 * If not initialized, returns a default instance
 */
export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = Logger.getInstance();
  }
  return loggerInstance;
}

// Default export for convenience
export default getLogger;
