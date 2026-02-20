/* eslint-disable no-undef */
/**
 * Logger Service
 * Centralized logging with environment-based configuration and runtime controls
 */

import { LogLevel, LoggerConfig, LOG_LEVEL_PRIORITY } from "./types";

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
      Logger.instance = new Logger({
        enabled: false,
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
    const shouldOutput = this.config.enabled && this.config.level !== LogLevel.NONE && 
                         LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
    return shouldOutput;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = Date.now();
    const stack =
      level === LogLevel.ERROR && this.config.includeStack ? new Error().stack : undefined;

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
      : "";

    const prefix = `${timestamp} [${entry.context}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.log(`🔍 ${message}`, entry.data ?? "");
        break;
      case LogLevel.INFO:
        console.log(`ℹ️ ${message}`, entry.data ?? "");
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${message}`, entry.data ?? "");
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${message}`, entry.data ?? "");
        if (entry.stack && this.config.includeStack) {
          console.error(entry.stack);
        }
        break;
    }
  }

  /**
   * Debug level logging
   */
  public debug(message: string, context: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  /**
   * Info level logging
   */
  public info(message: string, context: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  /**
   * Warning level logging
   */
  public warn(message: string, context: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  /**
   * Error level logging
   */
  public error(message: string, context: string, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data);
  }

  /**
   * Enable logging (runtime toggle)
   */
  public enable(): void {
    this.config.enabled = true;
    console.log('[Logger] Logging ENABLED - config.enabled =', this.config.enabled);
  }

  /**
   * Disable logging (runtime toggle)
   */
  public disable(): void {
    this.config.enabled = false;
    console.log('[Logger] Logging DISABLED - config.enabled =', this.config.enabled);
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
