/**
 * WebRTC Data Channel Service
 * 
 * Implements the Observer pattern for managing WebRTC DataChannel communications
 * with dual channel architecture for clear separation of concerns.
 * 
 * Architecture:
 * - OFFER Channel: Used exclusively for SENDING messages (outgoing)
 * - ANSWER Channel: Used exclusively for RECEIVING messages (incoming)
 * 
 * This separation ensures:
 * - Clear responsibility: offer = send, answer = receive
 * - No ambiguity about which channel to use
 * - Proper WebRTC flow: offerer creates channels, answerer receives them
 * 
 * Features:
 * - Singleton pattern for global access
 * - Observer pattern for decoupled event handling
 * - Dual channel management (offer + answer)
 * - State management for both channels
 * - Message broadcasting to all subscribers
 * - Error handling and propagation
 * 
 * Usage:
 * ```typescript
 * // Subscribe to data channel events
 * WebRTCDataChannelService.getInstance().subscribe({
 *   onDataChannelMessage: (event) => handleMessage(event),
 *   onDataChannelStateChanged: (state, channelType) => handleStateChange(state, channelType),
 *   onDataChannelError: (error, channelType) => handleError(error, channelType)
 * });
 * 
 * // Set the offer channel (for sending)
 * WebRTCDataChannelService.getInstance().setOfferChannel(offerChannel);
 * 
 * // Set the answer channel (for receiving)
 * WebRTCDataChannelService.getInstance().setAnswerChannel(answerChannel);
 * 
 * // Send a message (uses offer channel)
 * WebRTCDataChannelService.getInstance().send(message);
 * 
 * // Check channel status
 * if (WebRTCDataChannelService.getInstance().isReadyForCommunication) {
 *   // Both channels are ready
 * }
 * 
 * // Get detailed status
 * const status = WebRTCDataChannelService.getInstance().getChannelStatus();
 * ```
 * 
 * @author AdvokatConnect Development Team
 * @version 2.0.0 - Dual Channel Architecture
 */

import { getLogger } from '../../services/logger';

/**
 * Channel type identifier
 */
export type ChannelType = 'offer' | 'answer';

/**
 * Observer interface for DataChannel events
 */
export interface DataChannelObserver {
  /**
   * Called when a message is received on the DataChannel (answer channel only)
   * @param event - MessageEvent from the DataChannel
   */
  onDataChannelMessage?: (event: MessageEvent) => void | Promise<void>;

  /**
   * Called when the DataChannel state changes
   * @param state - New state of the DataChannel ('connecting' | 'open' | 'closing' | 'closed')
   * @param channelType - Type of channel ('offer' or 'answer')
   */
  onDataChannelStateChanged?: (state: RTCDataChannelState, channelType: ChannelType) => void;

  /**
   * Called when an error occurs on the DataChannel
   * @param error - Error event or error message
   * @param channelType - Type of channel ('offer' or 'answer')
   */
  onDataChannelError?: (error: Event | string, channelType: ChannelType) => void;
}

/**
 * Channel status information
 */
export interface ChannelStatus {
  offer: {
    state: RTCDataChannelState | 'not-set';
    label: string | null;
    isOpen: boolean;
  };
  answer: {
    state: RTCDataChannelState | 'not-set';
    label: string | null;
    isOpen: boolean;
  };
  canSend: boolean;
  canReceive: boolean;
  isReadyForCommunication: boolean;
}

/**
 * WebRTC Data Channel Service
 * Singleton service implementing the Observer pattern for DataChannel management
 * with dual channel architecture (offer for sending, answer for receiving)
 */
export class WebRTCDataChannelService {
  private static instance: WebRTCDataChannelService | null = null;
  private offerChannel: RTCDataChannel | null = null;    // For sending messages
  private answerChannel: RTCDataChannel | null = null;   // For receiving messages
  private observers: Set<DataChannelObserver> = new Set();
  private logger = getLogger();

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.logger.info('Service instance created', 'WebRTCDataChannelService');
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
    this.logger.debug('New observer subscribed', 'WebRTCDataChannelService');
    this.observers.add(observer);
  }

  /**
   * Unsubscribe an observer from DataChannel events
   * @param observer - Observer to unsubscribe
   */
  public unsubscribe(observer: DataChannelObserver): void {
    this.logger.debug('Observer unsubscribed', 'WebRTCDataChannelService');
    this.observers.delete(observer);
  }

  /**
   * Unsubscribe all observers (safety net for cleanup)
   * Use sparingly - prefer individual unsubscribe for normal flow
   */
  public unsubscribeAll(): void {
    this.logger.debug(`Unsubscribing all ${this.observers.size} observers`, 'WebRTCDataChannelService');
    this.observers.clear();
  }

  /**
   * Check if an observer is currently subscribed
   * @param observer - Observer to check
   * @returns true if observer is subscribed
   */
  public isSubscribed(observer: DataChannelObserver): boolean {
    return this.observers.has(observer);
  }

  /**
   * Set the offer DataChannel (used for sending messages)
   * @param channel - RTCDataChannel to manage for outgoing messages
   */
  public setOfferChannel(channel: RTCDataChannel | null): void {
    // Clean up old channel if exists
    if (this.offerChannel) {
      this.cleanupChannel(this.offerChannel, 'offer');
    }

    this.offerChannel = channel;

    if (channel) {
      this.logger.info(`Offer channel set: ${channel.label} (state: ${channel.readyState})`, 'WebRTCDataChannelService');
      this.setupChannelHandlers(channel, 'offer');
      
      // Notify observers of initial state
      this.notifyStateChanged(channel.readyState, 'offer');
    } else {
      this.logger.info('Offer channel cleared', 'WebRTCDataChannelService');
      this.notifyStateChanged('closed', 'offer');
    }
  }

  /**
   * Set the answer DataChannel (used for receiving messages)
   * @param channel - RTCDataChannel to manage for incoming messages
   */
  public setAnswerChannel(channel: RTCDataChannel | null): void {
    // Clean up old channel if exists
    if (this.answerChannel) {
      this.cleanupChannel(this.answerChannel, 'answer');
    }

    this.answerChannel = channel;

    if (channel) {
      this.logger.info(`Answer channel set: ${channel.label} (state: ${channel.readyState})`, 'WebRTCDataChannelService');
      this.setupChannelHandlers(channel, 'answer');
      
      // Notify observers of initial state
      this.notifyStateChanged(channel.readyState, 'answer');
    } else {
      this.logger.info('Answer channel cleared', 'WebRTCDataChannelService');
      this.notifyStateChanged('closed', 'answer');
    }
  }

  /**
   * Setup event handlers for a DataChannel
   * @param channel - RTCDataChannel to setup handlers for
   * @param channelType - Type of channel ('offer' or 'answer')
   */
  private setupChannelHandlers(channel: RTCDataChannel, channelType: ChannelType): void {
    const prefix = channelType === 'offer' ? '📤' : '📥';
    
    channel.onopen = () => {
      this.logger.info(`${prefix} ${channelType} channel opened: ${channel.label}`, 'WebRTCDataChannelService');
      this.notifyStateChanged('open', channelType);
    };

    channel.onclose = () => {
      this.logger.info(`${prefix} ${channelType} channel closed: ${channel.label}`, 'WebRTCDataChannelService');
      this.notifyStateChanged('closed', channelType);
    };

    channel.onerror = (error) => {
      this.logger.error(`${prefix} ${channelType} channel error:`, 'WebRTCDataChannelService', error);
      this.notifyError(error, channelType);
    };

    // CRITICAL: Only answer channel receives messages (incoming data)
    if (channelType === 'answer') {
      channel.onmessage = (event) => {
        this.handleMessage(event);
      };
      this.logger.debug('Answer channel message handler attached', 'WebRTCDataChannelService');
    } else {
      this.logger.debug('Offer channel is send-only (no message handler)', 'WebRTCDataChannelService');
    }
  }

  /**
   * Clean up a specific DataChannel
   * @param channel - Channel to clean up
   * @param channelType - Type of channel being cleaned up
   */
  private cleanupChannel(channel: RTCDataChannel, channelType: ChannelType): void {
    const prefix = channelType === 'offer' ? '📤' : '📥';
    this.logger.debug(`Cleaning up ${channelType} channel`, 'WebRTCDataChannelService');
    
    // Remove event handlers
    channel.onopen = null;
    channel.onclose = null;
    channel.onerror = null;
    channel.onmessage = null;
    
    // Close the channel if it's open
    if (channel.readyState === 'open' || channel.readyState === 'connecting') {
      try {
        channel.close();
        this.logger.info(`${prefix} ${channelType} channel closed`, 'WebRTCDataChannelService');
      } catch (error) {
        this.logger.error(`Error closing ${channelType} channel:`, 'WebRTCDataChannelService', error);
      }
    }
  }

  /**
   * Clean up both channels
   */
  private cleanupAllChannels(): void {
    if (this.offerChannel) {
      this.cleanupChannel(this.offerChannel, 'offer');
      this.offerChannel = null;
    }
    if (this.answerChannel) {
      this.cleanupChannel(this.answerChannel, 'answer');
      this.answerChannel = null;
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
        this.logger.debug(`ArrayBuffer received (${data.byteLength} bytes)`, 'WebRTCDataChannelService');
      } else if (data instanceof Blob) {
        logText = await data.text();
        this.logger.debug(`Blob received (${data.size} bytes)`, 'WebRTCDataChannelService');
      } else if (typeof data === "string") {
        logText = data;
        this.logger.debug(`Text received (${data.length} chars)`, 'WebRTCDataChannelService');
      } else {
        this.logger.warn(`Unknown message type: ${typeof data}`, 'WebRTCDataChannelService');
        return;
      }

      // Notify all observers
      this.logger.debug(`Broadcasting message to ${this.observers.size} observer(s)`, 'WebRTCDataChannelService');
      
      for (const observer of Array.from(this.observers)) {
        if (observer.onDataChannelMessage) {
          try {
            await observer.onDataChannelMessage(event);
          } catch (error) {
            this.logger.error('Error in observer message handler:', 'WebRTCDataChannelService', error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error handling message:', 'WebRTCDataChannelService', error);
      this.notifyError(error as string, 'answer');
    }
  }

  /**
   * Notify observers of state change
   * @param state - New DataChannel state
   * @param channelType - Type of channel that changed state
   */
  private notifyStateChanged(state: RTCDataChannelState, channelType: ChannelType): void {
    const prefix = channelType === 'offer' ? '📤' : '📥';
    this.logger.debug(`${prefix} ${channelType} channel state changed: ${state}`, 'WebRTCDataChannelService');
    
    for (const observer of Array.from(this.observers)) {
      if (observer.onDataChannelStateChanged) {
        try {
          observer.onDataChannelStateChanged(state, channelType);
        } catch (error) {
          this.logger.error('Error in observer state change handler:', 'WebRTCDataChannelService', error);
        }
      }
    }
  }

  /**
   * Notify observers of error
   * @param error - Error event or message
   * @param channelType - Type of channel that encountered the error
   */
  private notifyError(error: Event | string, channelType: ChannelType): void {
    const prefix = channelType === 'offer' ? '📤' : '📥';
    this.logger.error(`${prefix} ${channelType} channel error:`, 'WebRTCDataChannelService', error);
    
    for (const observer of Array.from(this.observers)) {
      if (observer.onDataChannelError) {
        try {
          observer.onDataChannelError(error, channelType);
        } catch (handlerError) {
          this.logger.error('Error in observer error handler:', 'WebRTCDataChannelService', handlerError);
        }
      }
    }
  }

  /**
   * Send a message through the offer DataChannel (outgoing only)
   * @param message - Message to send (string, ArrayBuffer, or Blob)
   * @throws Error if offer DataChannel is not open
   */
  public send(message: string | ArrayBuffer | Blob): void {
    if (!this.offerChannel) {
      const error = 'Cannot send message: Offer channel not set';
      this.logger.error(error, 'WebRTCDataChannelService');
      throw new Error(error);
    }

    if (this.offerChannel.readyState !== 'open') {
      const error = `Cannot send message: Offer channel is ${this.offerChannel.readyState}`;
      this.logger.error(error, 'WebRTCDataChannelService');
      throw new Error(error);
    }

    try {
      // Cast to any to bypass TypeScript overload resolution issues
      (this.offerChannel as any).send(message);
      
      const messageSize = typeof message === 'string' 
        ? message.length 
        : message instanceof ArrayBuffer 
          ? message.byteLength 
          : (message as Blob).size;
      
      this.logger.debug(`Message sent via offer channel (${messageSize} ${typeof message === 'string' ? 'chars' : 'bytes'})`, 'WebRTCDataChannelService');
    } catch (error) {
      this.logger.error('Error sending message via offer channel:', 'WebRTCDataChannelService', error);
      this.notifyError(error as string, 'offer');
      throw error;
    }
  }

  /**
   * Check if the offer channel is open and ready for sending
   * @returns true if offer channel is open, false otherwise
   */
  public get isOfferChannelOpen(): boolean {
    return this.offerChannel !== null && this.offerChannel.readyState === 'open';
  }

  /**
   * Check if the answer channel is open and ready for receiving
   * @returns true if answer channel is open, false otherwise
   */
  public get isAnswerChannelOpen(): boolean {
    return this.answerChannel !== null && this.answerChannel.readyState === 'open';
  }

  /**
   * Check if both channels are open and ready for bidirectional communication
   * @returns true if both channels are open, false otherwise
   */
  public get isReadyForCommunication(): boolean {
    return this.isOfferChannelOpen && this.isAnswerChannelOpen;
  }

  /**
   * Check if we can send messages (offer channel is open)
   * @returns true if we can send, false otherwise
   */
  public get canSend(): boolean {
    return this.isOfferChannelOpen;
  }

  /**
   * Check if we can receive messages (answer channel is open)
   * @returns true if we can receive, false otherwise
   */
  public get canReceive(): boolean {
    return this.isAnswerChannelOpen;
  }

  /**
   * Get the current state of the offer channel
   * @returns Current offer channel state or null if not set
   */
  public get offerChannelState(): RTCDataChannelState | null {
    return this.offerChannel?.readyState ?? null;
  }

  /**
   * Get the current state of the answer channel
   * @returns Current answer channel state or null if not set
   */
  public get answerChannelState(): RTCDataChannelState | null {
    return this.answerChannel?.readyState ?? null;
  }

  /**
   * Get the offer DataChannel (for advanced use cases)
   * @returns The offer RTCDataChannel or null if not set
   */
  public getOfferChannel(): RTCDataChannel | null {
    return this.offerChannel;
  }

  /**
   * Get the answer DataChannel (for advanced use cases)
   * @returns The answer RTCDataChannel or null if not set
   */
  public getAnswerChannel(): RTCDataChannel | null {
    return this.answerChannel;
  }

  /**
   * Get detailed status of both channels
   * @returns ChannelStatus object with detailed information
   */
  public getChannelStatus(): ChannelStatus {
    return {
      offer: {
        state: this.offerChannel?.readyState ?? 'not-set',
        label: this.offerChannel?.label ?? null,
        isOpen: this.isOfferChannelOpen
      },
      answer: {
        state: this.answerChannel?.readyState ?? 'not-set',
        label: this.answerChannel?.label ?? null,
        isOpen: this.isAnswerChannelOpen
      },
      canSend: this.canSend,
      canReceive: this.canReceive,
      isReadyForCommunication: this.isReadyForCommunication
    };
  }

  /**
   * Reset the service (for testing or cleanup)
   */
  public reset(): void {
    this.logger.info('Resetting service', 'WebRTCDataChannelService');
    this.cleanupAllChannels();
    this.unsubscribeAll();
  }

  /**
   * Destroy the singleton instance (for testing)
   */
  public static destroy(): void {
    if (WebRTCDataChannelService.instance) {
      const logger = getLogger();
      logger.info('Destroying singleton instance', 'WebRTCDataChannelService');
      WebRTCDataChannelService.instance.reset();
      WebRTCDataChannelService.instance = null;
    }
  }
}

