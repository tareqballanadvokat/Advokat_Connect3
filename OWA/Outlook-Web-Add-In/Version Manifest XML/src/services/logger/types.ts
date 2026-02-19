/**
 * Logger Types and Interfaces
 */

/**
 * Log Levels - ordered from least to most severe
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  NONE = 'none'
}

/**
 * Logger Configuration
 */
export interface LoggerConfig {
  /** Enable/disable logging */
  enabled: boolean;
  /** Minimum log level to output */
  level: LogLevel;
  /** Include timestamps in log output */
  includeTimestamp: boolean;
  /** Include stack traces for errors */
  includeStack: boolean;
}

/**
 * Log Level Severity Order for filtering
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.NONE]: 4,
};
