/**
 * WebRTC Data Channel Service
 * 
 * Implements the Observer pattern for managing WebRTC DataChannel communications.
 * This service acts as a centralized hub for DataChannel message handling,
 * allowing multiple subscribers to observe and react to DataChannel events.
 * 
 * Features:
 * - Singleton pattern for global access
 * - Observer pattern for decoupled event handling
 * - State management (open/closed)
 * - Message broadcasting to all subscribers
 * - Error handling and propagation
 * 
 * Usage:
 * ```typescript
 * // Subscribe to data channel events
 * WebRTCDataChannelService.getInstance().subscribe({
 *   onDataChannelMessage: (event) => handleMessage(event),
 *   onDataChannelStateChanged: (state) => handleStateChange(state),
 *   onDataChannelError: (error) => handleError(error)
 * });
 * 
 * // Set the active data channel
 * WebRTCDataChannelService.getInstance().setDataChannel(channel);
 * 
 * // Send a message
 * WebRTCDataChannelService.getInstance().send(message);
 * 
 * // Check if channel is open
 * if (WebRTCDataChannelService.getInstance().isOpen) {
 *   // Channel is ready for communication
 * }
 * ```
 * 
 * @author AdvokatConnect Development Team
 * @version 1.0.0
 */

/**
 * Observer interface for DataChannel events
 */
export interface DataChannelObserver {
  /**
   * Called when a message is received on the DataChannel
   * @param event - MessageEvent from the DataChannel
   */
  onDataChannelMessage?: (event: MessageEvent) => void | Promise<void>;

  /**
   * Called when the DataChannel state changes
   * @param state - New state of the DataChannel ('connecting' | 'open' | 'closing' | 'closed')
   */
  onDataChannelStateChanged?: (state: RTCDataChannelState) => void;

  /**
   * Called when an error occurs on the DataChannel
   * @param error - Error event or error message
   */
  onDataChannelError?: (error: Event | string) => void;
}

/**
 * WebRTC Data Channel Service
 * Singleton service implementing the Observer pattern for DataChannel management
 */
export class WebRTCDataChannelService {
  private static instance: WebRTCDataChannelService | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private observers: Set<DataChannelObserver> = new Set();

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    console.log('[WebRTCDataChannelService] 🏗️ Service instance created');
  }

  /**
   * Get the singleton instance
   * @returns The singleton instance of WebRTCDataChannelService
   */
  public static getInstance(): WebRTCDataChannelService {
    if (!WebRTCDataChannelService.instance) {
      WebRTCDataChannelService.instance = new WebRTCDataChannelService();
    }
    return WebRTCDataChannelService.instance;
  }

  /**
   * Subscribe an observer to DataChannel events
   * @param observer - Observer to subscribe
   */
  public subscribe(observer: DataChannelObserver): void {
    console.log('[WebRTCDataChannelService] 📝 New observer subscribed');
    this.observers.add(observer);
  }

  /**
   * Unsubscribe an observer from DataChannel events
   * @param observer - Observer to unsubscribe
   */
  public unsubscribe(observer: DataChannelObserver): void {
    console.log('[WebRTCDataChannelService] 🗑️ Observer unsubscribed');
    this.observers.delete(observer);
  }

  /**
   * Set the active DataChannel and attach event handlers
   * @param channel - RTCDataChannel to manage
   */
  public setDataChannel(channel: RTCDataChannel | null): void {
    // Clean up old channel if exists
    if (this.dataChannel) {
      this.cleanupDataChannel();
    }

    this.dataChannel = channel;

    if (channel) {
      console.log(`[WebRTCDataChannelService] 📡 DataChannel set: ${channel.label} (state: ${channel.readyState})`);
      this.setupDataChannelHandlers(channel);
      
      // Notify observers of initial state
      this.notifyStateChanged(channel.readyState);
    } else {
      console.log('[WebRTCDataChannelService] 📡 DataChannel cleared');
      this.notifyStateChanged('closed');
    }
  }

  /**
   * Setup event handlers for the DataChannel
   * @param channel - RTCDataChannel to setup handlers for
   */
  private setupDataChannelHandlers(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log(`[WebRTCDataChannelService] 🟢 DataChannel opened: ${channel.label}`);
      this.notifyStateChanged('open');
    };

    channel.onclose = () => {
      console.log(`[WebRTCDataChannelService] 🔴 DataChannel closed: ${channel.label}`);
      this.notifyStateChanged('closed');
    };

    channel.onerror = (error) => {
      console.error(`[WebRTCDataChannelService] ❌ DataChannel error:`, error);
      this.notifyError(error);
    };

    channel.onmessage = (event) => {
      this.handleMessage(event);
    };
  }

  /**
   * Clean up the current DataChannel
   */
  private cleanupDataChannel(): void {
    if (this.dataChannel) {
      console.log('[WebRTCDataChannelService] 🧹 Cleaning up DataChannel');
      
      // Remove event handlers
      this.dataChannel.onopen = null;
      this.dataChannel.onclose = null;
      this.dataChannel.onerror = null;
      this.dataChannel.onmessage = null;
      
      // Close the channel if it's open
      if (this.dataChannel.readyState === 'open' || this.dataChannel.readyState === 'connecting') {
        try {
          this.dataChannel.close();
        } catch (error) {
          console.error('[WebRTCDataChannelService] ❌ Error closing DataChannel:', error);
        }
      }
      
      this.dataChannel = null;
    }
  }

  /**
   * Handle incoming DataChannel message
   * @param event - MessageEvent from the DataChannel
   */
  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      // Log message details
      const data = event.data;
      let logText: string;
      
      if (data instanceof ArrayBuffer) {
        logText = new TextDecoder("utf-8").decode(data);
        console.log(`[WebRTCDataChannelService] 📨 ArrayBuffer received (${data.byteLength} bytes)`);
      } else if (data instanceof Blob) {
        logText = await data.text();
        console.log(`[WebRTCDataChannelService] 📨 Blob received (${data.size} bytes)`);
      } else if (typeof data === "string") {
        logText = data;
        console.log(`[WebRTCDataChannelService] 📨 Text received (${data.length} chars)`);
      } else {
        console.log(`[WebRTCDataChannelService] ❓ Unknown message type: ${typeof data}`);
        return;
      }

      // Notify all observers
      console.log(`[WebRTCDataChannelService] 📢 Broadcasting message to ${this.observers.size} observer(s)`);
      
      for (const observer of Array.from(this.observers)) {
        if (observer.onDataChannelMessage) {
          try {
            await observer.onDataChannelMessage(event);
          } catch (error) {
            console.error('[WebRTCDataChannelService] ❌ Error in observer message handler:', error);
          }
        }
      }
    } catch (error) {
      console.error('[WebRTCDataChannelService] ❌ Error handling message:', error);
      this.notifyError(error as string);
    }
  }

  /**
   * Notify observers of state change
   * @param state - New DataChannel state
   */
  private notifyStateChanged(state: RTCDataChannelState): void {
    console.log(`[WebRTCDataChannelService] 📡 State changed: ${state}`);
    
    for (const observer of Array.from(this.observers)) {
      if (observer.onDataChannelStateChanged) {
        try {
          observer.onDataChannelStateChanged(state);
        } catch (error) {
          console.error('[WebRTCDataChannelService] ❌ Error in observer state change handler:', error);
        }
      }
    }
  }

  /**
   * Notify observers of error
   * @param error - Error event or message
   */
  private notifyError(error: Event | string): void {
    console.error('[WebRTCDataChannelService] ❌ Error occurred:', error);
    
    for (const observer of Array.from(this.observers)) {
      if (observer.onDataChannelError) {
        try {
          observer.onDataChannelError(error);
        } catch (handlerError) {
          console.error('[WebRTCDataChannelService] ❌ Error in observer error handler:', handlerError);
        }
      }
    }
  }

  /**
   * Send a message through the DataChannel
   * @param message - Message to send (string, ArrayBuffer, or Blob)
   * @throws Error if DataChannel is not open
   */
  public send(message: string | ArrayBuffer | Blob): void {
    if (!this.dataChannel) {
      const error = 'Cannot send message: DataChannel not set';
      console.error(`[WebRTCDataChannelService] ❌ ${error}`);
      throw new Error(error);
    }

    if (this.dataChannel.readyState !== 'open') {
      const error = `Cannot send message: DataChannel is ${this.dataChannel.readyState}`;
      console.error(`[WebRTCDataChannelService] ❌ ${error}`);
      throw new Error(error);
    }

    try {
      // Cast to any to bypass TypeScript overload resolution issues
      (this.dataChannel as any).send(message);
      
      const messageSize = typeof message === 'string' 
        ? message.length 
        : message instanceof ArrayBuffer 
          ? message.byteLength 
          : (message as Blob).size;
      
      console.log(`[WebRTCDataChannelService] 📤 Message sent (${messageSize} ${typeof message === 'string' ? 'chars' : 'bytes'})`);
    } catch (error) {
      console.error('[WebRTCDataChannelService] ❌ Error sending message:', error);
      this.notifyError(error as string);
      throw error;
    }
  }

  /**
   * Check if the DataChannel is open and ready for communication
   * @returns true if DataChannel is open, false otherwise
   */
  public get isOpen(): boolean {
    return this.dataChannel !== null && this.dataChannel.readyState === 'open';
  }

  /**
   * Get the current DataChannel state
   * @returns Current DataChannel state or null if not set
   */
  public get state(): RTCDataChannelState | null {
    return this.dataChannel?.readyState ?? null;
  }

  /**
   * Get the active DataChannel
   * @returns The active RTCDataChannel or null if not set
   */
  public getDataChannel(): RTCDataChannel | null {
    return this.dataChannel;
  }

  /**
   * Reset the service (for testing or cleanup)
   */
  public reset(): void {
    console.log('[WebRTCDataChannelService] 🔄 Resetting service');
    this.cleanupDataChannel();
    this.observers.clear();
  }

  /**
   * Destroy the singleton instance (for testing)
   */
  public static destroy(): void {
    if (WebRTCDataChannelService.instance) {
      console.log('[WebRTCDataChannelService] 💥 Destroying singleton instance');
      WebRTCDataChannelService.instance.reset();
      WebRTCDataChannelService.instance = null;
    }
  }
}

