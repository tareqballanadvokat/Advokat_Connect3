/**
 * Centralized Timeout Manager
 * 
 * Manages all timers across SIP phases with monitoring, tracking, and statistics.
 * Provides unified interface for timer lifecycle management and remaining time queries.
 * 
 * @author AdvokatConnect Development Team
 * @version 1.0.0
 */

import { logger } from './Helper';

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
            logger.log(`⏱️ [TIMEOUT_MANAGER] Timer '${name}' already exists, cancelling it first`);
            this.cancelTimer(name);
        }
        
        const startTime = Date.now();
        const expiryTime = startTime + duration;
        
        const timeout = setTimeout(() => {
            const actualElapsed = Date.now() - startTime;
            logger.log(`⏱️ [TIMEOUT_MANAGER] Timer '${name}' EXPIRED`);
            logger.log(`⏱️ [TIMEOUT_MANAGER] - Expected: ${duration}ms, Actual: ${actualElapsed}ms`);
            logger.log(`⏱️ [TIMEOUT_MANAGER] - Start: ${new Date(startTime).toISOString()}`);
            logger.log(`⏱️ [TIMEOUT_MANAGER] - Expiry: ${new Date().toISOString()}`);
            this.timers.delete(name);
            logger.log(`⏱️ [TIMEOUT_MANAGER] Timer '${name}' DELETED and REMOVED from active timers`);
            callback();
        }, duration);
        
        this.timers.set(name, {
            timeout,
            startTime,
            duration,
            callback
        });
        
        this.totalTimersCreated++;
        logger.log(`⏱️ [TIMEOUT_MANAGER] Timer '${name}' STARTED`);
        logger.log(`⏱️ [TIMEOUT_MANAGER] - Duration: ${duration}ms`);
        logger.log(`⏱️ [TIMEOUT_MANAGER] - Start: ${new Date(startTime).toISOString()}`);
        logger.log(`⏱️ [TIMEOUT_MANAGER] - Expected Expiry: ${new Date(expiryTime).toISOString()}`);
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
            logger.log(`⏱️ [TIMEOUT_MANAGER] Timer '${name}' not found, nothing to cancel`);
            return false;
        }
        
        clearTimeout(timerInfo.timeout);
        this.timers.delete(name);
        this.totalTimersCleared++;
        
        const elapsed = Date.now() - timerInfo.startTime;
        const remaining = timerInfo.duration - elapsed;
        logger.log(`⏱️ [TIMEOUT_MANAGER] Timer '${name}' CANCELLED`);
        logger.log(`⏱️ [TIMEOUT_MANAGER] - Elapsed: ${elapsed}ms of ${timerInfo.duration}ms`);
        logger.log(`⏱️ [TIMEOUT_MANAGER] - Remaining: ${remaining}ms`);
        logger.log(`⏱️ [TIMEOUT_MANAGER] - Started: ${new Date(timerInfo.startTime).toISOString()}`);
        logger.log(`⏱️ [TIMEOUT_MANAGER] - Cancelled: ${new Date().toISOString()}`);
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
            logger.log(`⏱️ [TIMEOUT_MANAGER] getRemainingTime('${name}'): Timer not found, returning 0`);
            return 0;
        }
        
        const now = Date.now();
        const elapsed = now - timerInfo.startTime;
        const remaining = Math.max(0, timerInfo.duration - elapsed);
        
        logger.log(`⏱️ [TIMEOUT_MANAGER] getRemainingTime('${name}'): ${remaining}ms remaining (${elapsed}ms/${timerInfo.duration}ms)`);
        
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
            logger.log(`⏱️ [TIMEOUT_MANAGER] Cannot reset timer '${name}' - not found`);
            return false;
        }
        
        const duration = newDuration !== undefined ? newDuration : timerInfo.duration;
        const callback = timerInfo.callback;
        
        this.cancelTimer(name);
        this.startTimer(name, duration, callback);
        
        logger.log(`⏱️ [TIMEOUT_MANAGER] Timer '${name}' reset to ${duration}ms`);
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
            remaining
        };
    }
    
    /**
     * Cancels all active timers
     */
    cancelAllTimers(): void {
        logger.log(`⏱️ [TIMEOUT_MANAGER] Cancelling all timers (${this.timers.size} active)`);
        
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
            cleared: this.totalTimersCleared
        };
    }
    
    /**
     * Logs current timer statistics
     */
    private logStats(): void {
        logger.log(`📊 [TIMEOUT_MANAGER] Active: ${this.timers.size} | Created: ${this.totalTimersCreated} | Cleared: ${this.totalTimersCleared}`);
    }
    
    /**
     * Logs detailed information about all active timers
     */
    logActiveTimers(): void {
        if (this.timers.size === 0) {
            logger.log('📊 [TIMEOUT_MANAGER] No active timers');
            return;
        }
        
        logger.log(`📊 [TIMEOUT_MANAGER] Active timers (${this.timers.size}):`);
        const timerEntries = Array.from(this.timers.entries());
        for (const [name, info] of timerEntries) {
            const elapsed = Date.now() - info.startTime;
            const remaining = Math.max(0, info.duration - elapsed);
            logger.log(`  - ${name}: ${remaining}ms remaining (${elapsed}ms elapsed / ${info.duration}ms total)`);
        }
    }
}
