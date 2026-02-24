/* eslint-disable no-undef */
/**
 * Idle Activity Monitor
 * Monitors user activity and triggers callbacks when user goes idle or becomes active
 */

import { getLogger } from "../../services/logger";

export interface IdleActivityMonitorConfig {
  idleTimeout: number; // Time in ms before user is considered idle
  onIdle: () => void; // Callback when user goes idle
  onActive: () => void; // Callback when user becomes active
  throttleInterval?: number; // Throttle activity events (default: 1000ms)
}

export class IdleActivityMonitor {
  private config: Required<IdleActivityMonitorConfig>;
  private idleTimer: NodeJS.Timeout | null = null;
  private lastActivityTime: number = Date.now();
  private isCurrentlyIdle: boolean = false;
  private isMonitoring: boolean = false;
  private lastThrottleTime: number = 0;
  private logger = getLogger();

  // Activity event types to monitor
  private readonly activityEvents = [
    "mousedown",
    "mousemove",
    "keydown",
    "scroll",
    "touchstart",
    "click",
  ];

  // Visibility change events
  private readonly visibilityEvents = ["visibilitychange", "focus", "blur"];

  constructor(config: IdleActivityMonitorConfig) {
    this.config = {
      ...config,
      throttleInterval: config.throttleInterval || 3000, // Default 3 seconds throttle
    };
  }

  /**
   * Start monitoring user activity
   */
  start(): void {
    if (this.isMonitoring) {
      this.logger.warn("Already monitoring", "IdleMonitor");
      return;
    }

    this.logger.debug(`Starting (timeout: ${this.config.idleTimeout}ms)`, "IdleMonitor");
    this.isMonitoring = true;
    this.lastActivityTime = Date.now();
    this.isCurrentlyIdle = false;

    // Attach event listeners
    this.attachEventListeners();

    // Start idle timer
    this.resetIdleTimer();
  }

  /**
   * Stop monitoring user activity
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.logger.debug("Stopping", "IdleMonitor");
    this.isMonitoring = false;

    // Remove event listeners
    this.detachEventListeners();

    // Clear timers
    this.clearIdleTimer();
  }

  /**
   * Reset idle timer (called on user activity)
   */
  reset(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.lastActivityTime = Date.now();

    // If user was idle and now active, trigger onActive callback
    if (this.isCurrentlyIdle) {
      this.logger.info("User became active", "IdleMonitor");
      this.isCurrentlyIdle = false;
      this.config.onActive();
    }

    // Reset the idle timer
    this.resetIdleTimer();
  }

  /**
   * Check if user is currently idle
   */
  isIdle(): boolean {
    return this.isCurrentlyIdle;
  }

  /**
   * Get timestamp of last activity
   */
  getLastActivityTime(): number {
    return this.lastActivityTime;
  }

  /**
   * Get time since last activity in milliseconds
   */
  getTimeSinceLastActivity(): number {
    return Date.now() - this.lastActivityTime;
  }

  // ========== Private Methods ==========

  private attachEventListeners(): void {
    // Activity events (throttled)
    this.activityEvents.forEach((event) => {
      document.addEventListener(event, this.handleActivityThrottled, { passive: true });
    });

    // Visibility events (immediate)
    this.visibilityEvents.forEach((event) => {
      if (event === "visibilitychange") {
        document.addEventListener(event, this.handleVisibilityChange);
      } else {
        window.addEventListener(event, this.handleVisibilityChange);
      }
    });
  }

  private detachEventListeners(): void {
    // Remove activity events
    this.activityEvents.forEach((event) => {
      document.removeEventListener(event, this.handleActivityThrottled);
    });

    // Remove visibility events
    this.visibilityEvents.forEach((event) => {
      if (event === "visibilitychange") {
        document.removeEventListener(event, this.handleVisibilityChange);
      } else {
        window.removeEventListener(event, this.handleVisibilityChange);
      }
    });
  }

  /**
   * Handle activity events with throttling
   */
  private handleActivityThrottled = (): void => {
    const now = Date.now();
    const timeSinceLastThrottle = now - this.lastThrottleTime;

    // Only process if throttle interval has passed
    if (timeSinceLastThrottle >= this.config.throttleInterval) {
      this.lastThrottleTime = now;
      this.handleActivity();
    }
  };

  /**
   * Handle activity event
   */
  private handleActivity = (): void => {
    if (!this.isMonitoring) {
      return;
    }

    this.reset();
  };

  /**
   * Handle visibility change events (tab focus/blur)
   */
  private handleVisibilityChange = (): void => {
    if (!this.isMonitoring) {
      return;
    }

    // Check if page is visible/focused
    const isVisible = document.visibilityState === "visible";
    const hasFocus = document.hasFocus();

    if (isVisible || hasFocus) {
      this.logger.debug("Page became visible/focused", "IdleMonitor");
      this.handleActivity();
    } else {
      this.logger.debug("Page became hidden/blurred", "IdleMonitor");
      // When user switches away, we don't immediately mark as idle,
      // but the idle timer will continue and eventually trigger
    }
  };

  /**
   * Reset the idle timer
   */
  private resetIdleTimer(): void {
    this.clearIdleTimer();

    this.idleTimer = setTimeout(() => {
      if (this.isMonitoring && !this.isCurrentlyIdle) {
        this.logger.info("User went idle", "IdleMonitor");
        this.isCurrentlyIdle = true;
        this.config.onIdle();
      }
    }, this.config.idleTimeout);
  }

  /**
   * Clear idle timer
   */
  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
