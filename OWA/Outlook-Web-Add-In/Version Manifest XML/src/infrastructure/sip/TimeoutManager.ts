/* eslint-disable no-undef */
/**
 * Centralized Timeout Manager
 *
 * Manages all timers across SIP phases with monitoring, tracking, and statistics.
 * Provides unified interface for timer lifecycle management and remaining time queries.
 *
 * @author AdvokatConnect Development Team
 * @version 1.0.0
 */

import { getLogger } from "@infra/logger";

const logger = getLogger();

interface TimerInfo {
  timeout: NodeJS.Timeout;
  startTime: number;
  duration: number;
  callback: () => void;
}

export class TimeoutManager {
  private timers: Map<string, TimerInfo> = new Map();
  private totalTimersCreated: number = 0;
  private totalTimersCleared: number = 0;

  /**
   * Starts a new timer with the given name
   * If a timer with the same name exists, it will be cancelled first
   * @param name - Unique identifier for the timer
   * @param duration - Duration in milliseconds
   * @param callback - Function to execute when timer expires
   */
  startTimer(name: string, duration: number, callback: () => void): void {
    // Cancel existing timer with same name if it exists
    if (this.timers.has(name)) {
      logger.debug(`Timer '${name}' already exists, cancelling it first`, "TimeoutManager");
      this.cancelTimer(name);
    }

    const startTime = Date.now();
    const expiryTime = startTime + duration;

    const timeout = setTimeout(() => {
      const actualElapsed = Date.now() - startTime;
      logger.debug(`Timer '${name}' EXPIRED`, "TimeoutManager");
      logger.debug(`- Expected: ${duration}ms, Actual: ${actualElapsed}ms`, "TimeoutManager");
      logger.debug(`- Start: ${new Date(startTime).toISOString()}`, "TimeoutManager");
      logger.debug(`- Expiry: ${new Date().toISOString()}`, "TimeoutManager");
      this.timers.delete(name);
      logger.debug(`Timer '${name}' DELETED and REMOVED from active timers`, "TimeoutManager");
      callback();
    }, duration);

    this.timers.set(name, {
      timeout,
      startTime,
      duration,
      callback,
    });

    this.totalTimersCreated++;
    logger.debug(`Timer '${name}' STARTED`, "TimeoutManager");
    logger.debug(`- Duration: ${duration}ms`, "TimeoutManager");
    logger.debug(`- Start: ${new Date(startTime).toISOString()}`, "TimeoutManager");
    logger.debug(`- Expected Expiry: ${new Date(expiryTime).toISOString()}`, "TimeoutManager");
    this.logStats();
  }

  /**
   * Cancels a timer by name
   * @param name - Timer identifier
   * @returns true if timer was found and cancelled, false otherwise
   */
  cancelTimer(name: string): boolean {
    const timerInfo = this.timers.get(name);
    if (!timerInfo) {
      logger.debug(`Timer '${name}' not found, nothing to cancel`, "TimeoutManager");
      return false;
    }

    clearTimeout(timerInfo.timeout);
    this.timers.delete(name);
    this.totalTimersCleared++;

    const elapsed = Date.now() - timerInfo.startTime;
    const remaining = timerInfo.duration - elapsed;
    logger.debug(`Timer '${name}' CANCELLED`, "TimeoutManager");
    logger.debug(`- Elapsed: ${elapsed}ms of ${timerInfo.duration}ms`, "TimeoutManager");
    logger.debug(`- Remaining: ${remaining}ms`, "TimeoutManager");
    logger.debug(`- Started: ${new Date(timerInfo.startTime).toISOString()}`, "TimeoutManager");
    logger.debug(`- Cancelled: ${new Date().toISOString()}`, "TimeoutManager");
    this.logStats();
    return true;
  }

  /**
   * Gets remaining time for a timer in milliseconds
   * @param name - Timer identifier
   * @returns Remaining time in ms, or 0 if timer doesn't exist or has expired
   */
  getRemainingTime(name: string): number {
    const timerInfo = this.timers.get(name);
    if (!timerInfo) {
      logger.debug(`getRemainingTime('${name}'): Timer not found, returning 0`, "TimeoutManager");
      return 0;
    }

    const now = Date.now();
    const elapsed = now - timerInfo.startTime;
    const remaining = Math.max(0, timerInfo.duration - elapsed);

    logger.debug(
      `getRemainingTime('${name}'): ${remaining}ms remaining (${elapsed}ms/${timerInfo.duration}ms)`,
      "TimeoutManager"
    );

    return remaining;
  }

  /**
   * Checks if a timer is currently active
   * @param name - Timer identifier
   * @returns true if timer exists and is active
   */
  isTimerActive(name: string): boolean {
    return this.timers.has(name);
  }

  /**
   * Resets a timer to a new duration (cancels and restarts)
   * @param name - Timer identifier
   * @param newDuration - New duration in milliseconds (optional, uses original if not provided)
   * @returns true if reset successful, false if timer doesn't exist
   */
  resetTimer(name: string, newDuration?: number): boolean {
    const timerInfo = this.timers.get(name);
    if (!timerInfo) {
      logger.debug(`Cannot reset timer '${name}' - not found`, "TimeoutManager");
      return false;
    }

    const duration = newDuration !== undefined ? newDuration : timerInfo.duration;
    const callback = timerInfo.callback;

    this.cancelTimer(name);
    this.startTimer(name, duration, callback);

    logger.debug(`Timer '${name}' reset to ${duration}ms`, "TimeoutManager");
    return true;
  }

  /**
   * Gets list of all active timer names
   * @returns Array of timer names
   */
  getActiveTimers(): string[] {
    return Array.from(this.timers.keys());
  }

  /**
   * Gets detailed information about a specific timer
   * @param name - Timer identifier
   * @returns Timer info or undefined if not found
   */
  getTimerInfo(name: string): { duration: number; elapsed: number; remaining: number } | undefined {
    const timerInfo = this.timers.get(name);
    if (!timerInfo) {
      return undefined;
    }

    const elapsed = Date.now() - timerInfo.startTime;
    const remaining = Math.max(0, timerInfo.duration - elapsed);

    return {
      duration: timerInfo.duration,
      elapsed,
      remaining,
    };
  }

  /**
   * Cancels all active timers
   */
  cancelAllTimers(): void {
    logger.debug(`Cancelling all timers (${this.timers.size} active)`, "TimeoutManager");

    const timerNames = Array.from(this.timers.keys());
    for (const name of timerNames) {
      this.cancelTimer(name);
    }

    this.logStats();
  }

  /**
   * Gets statistics about timer usage
   * @returns Object with timer statistics
   */
  getStats(): { active: number; created: number; cleared: number } {
    return {
      active: this.timers.size,
      created: this.totalTimersCreated,
      cleared: this.totalTimersCleared,
    };
  }

  /**
   * Logs current timer statistics
   */
  private logStats(): void {
    logger.debug(
      `Active: ${this.timers.size} | Created: ${this.totalTimersCreated} | Cleared: ${this.totalTimersCleared}`,
      "TimeoutManager"
    );
  }

  /**
   * Logs detailed information about all active timers
   */
  logActiveTimers(): void {
    if (this.timers.size === 0) {
      logger.debug("No active timers", "TimeoutManager");
      return;
    }

    logger.debug(`Active timers (${this.timers.size}):`, "TimeoutManager");
    const timerEntries = Array.from(this.timers.entries());
    for (const [name, info] of timerEntries) {
      const elapsed = Date.now() - info.startTime;
      const remaining = Math.max(0, info.duration - elapsed);
      logger.debug(
        `  - ${name}: ${remaining}ms remaining (${elapsed}ms elapsed / ${info.duration}ms total)`,
        "TimeoutManager"
      );
    }
  }
}
