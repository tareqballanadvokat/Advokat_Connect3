/**
 * Logger Usage Example
 *
 * This file demonstrates how to use the logger service in your application.
 */

import { getLogger, initializeLogger, LogLevel } from "./index";
// In real usage from other files: import { getLogger } from '@/services/logger';

// For the example, we'll show how it would be used
// import { getConfig } from '@/config';

// ============================================
// INITIALIZATION
// ============================================

// Initialize logger with config at app startup
// const config = getConfig();
// initializeLogger(config.logging);

// Or with manual config:
initializeLogger({
  enabled: true,
  level: LogLevel.DEBUG,
  includeTimestamp: true,
  includeStack: true,
});

// ============================================
// BASIC USAGE
// ============================================

const logger = getLogger();

// Different log levels
logger.debug("MyComponent", "Detailed debug information", { userId: 123 });
logger.info("MyService", "User logged in successfully");
logger.warn("ValidationService", "Invalid input detected", { field: "email" });
logger.error("ApiService", "Failed to fetch data", { error: "Network timeout" });

// ============================================
// RUNTIME CONTROLS
// ============================================

// Toggle logging on/off
logger.disable();
logger.enable();

// Change log level at runtime
logger.setLevel(LogLevel.WARN); // Only show warnings and errors

// Check status (example)
// const isEnabled = logger.isEnabled();
// const currentLevel = logger.getLevel();

// ============================================
// UPDATE CONFIGURATION
// ============================================

// Update logger config at runtime
logger.updateConfig({
  enabled: true,
  level: LogLevel.DEBUG,
});

// ============================================
// TYPICAL USAGE IN COMPONENTS
// ============================================

// Example class usage:
// class WebRTCConnectionManager {
//   private logger = getLogger();
//
//   async connect() {
//     this.logger.info("ConnectionManager", "Initiating connection");
//     try {
//       // Connection logic...
//       this.logger.debug("ConnectionManager", "Connection established", {
//         timestamp: Date.now(),
//       });
//     } catch (error) {
//       this.logger.error("ConnectionManager", "Connection failed", {
//         error: error.message,
//       });
//     }
//   }
// }
