/**
 * Logger Service
 * Centralized logging with environment-based configuration and runtime controls
 */

import { LogLevel, LoggerConfig, LOG_LEVEL_PRIORITY } from './types';

/**
 * Logger Class - Singleton pattern for consistent logging across the app
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;

  private constructor(config: LoggerConfig) {
    this.config = config;
  }

  /**
   * Get or create the logger singleton instance
   */
  public static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance && config) {
      Logger.instance = new Logger(config);
    } else if (!Logger.instance) {
      // Fallback config if none provided
      Logger.instance = new Logger({
        enabled: true,
        level: LogLevel.DEBUG,
        includeTimestamp: true,
        includeStack: true,
      });
    }
    return Logger.instance;
  }

  /**
   * Update logger configuration at runtime
   */
  public updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled || this.config.level === LogLevel.NONE) {
      return false;
    }
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, context: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = Date.now();
    const stack = level === LogLevel.ERROR && this.config.includeStack ? new Error().stack : undefined;

    // Output to console
    this.outputToConsole({ timestamp, level, context, message, data, stack });
  }

  /**
   * Format and output log entry to console
   */
  private outputToConsole(entry: { 
    timestamp: number; 
    level: LogLevel; 
    context: string; 
    message: string; 
    data?: any; 
    stack?: string;
  }): void {
    const timestamp = this.config.includeTimestamp 
      ? `[${new Date(entry.timestamp).toISOString()}]` 
      : '';
    
    const prefix = `${timestamp} [${entry.context}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.log(`🔍 ${message}`, entry.data ?? '');
        break;
      case LogLevel.INFO:
        console.log(`ℹ️ ${message}`, entry.data ?? '');
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${message}`, entry.data ?? '');
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${message}`, entry.data ?? '');
        if (entry.stack && this.config.includeStack) {
          console.error(entry.stack);
        }
        break;
    }
  }

  /**
   * Debug level logging
   */
  public debug(context: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, context, message, data);
  }

  /**
   * Info level logging
   */
  public info(context: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, context, message, data);
  }

  /**
   * Warning level logging
   */
  public warn(context: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, context, message, data);
  }

  /**
   * Error level logging
   */
  public error(context: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, context, message, data);
  }

  /**
   * Enable logging (runtime toggle)
   */
  public enable(): void {
    this.config.enabled = true;
  }

  /**
   * Disable logging (runtime toggle)
   */
  public disable(): void {
    this.config.enabled = false;
  }

  /**
   * Set log level (runtime control)
   */
  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Check if logging is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get current log level
   */
  public getLevel(): LogLevel {
    return this.config.level;
  }
}
