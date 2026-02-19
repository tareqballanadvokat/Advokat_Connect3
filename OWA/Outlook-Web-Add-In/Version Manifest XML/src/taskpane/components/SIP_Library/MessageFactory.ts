/**
 * SIP Message Factory
 *
 * Centralized factory for creating all SIP protocol messages used in the application.
 * Provides unified methods for common message types (ACK, BYE, SERVICE) and specific
 * methods for unique message structures (REGISTER).
 *
 * Benefits:
 * - Single source of truth for SIP message formatting
 * - Consistent message structure across all components
 * - Easier testing and maintenance
 * - Type-safe message creation with parameter validation
 * - Reduced code duplication
 *
 * @author AdvokatConnect Development Team
 * @version 1.0.0
 */

import { helper } from "./Helper";
import { configService } from "../../../config/index";
import { getLogger } from "../../../services/logger";

const logger = getLogger();

// ========================================
// TYPE DEFINITIONS
// ========================================

/**
 * Base parameters common to all SIP messages
 */
interface BaseMessageParams {
  sipUri: string;
  branch: string;
  callId: string;
  tag: string;
}

/**
 * Parameters for creating ACK messages
 * Used for: Registration ACK (CSeq: 3), Connection ACK (CSeq: 5), etc.
 */
export interface AckMessageParams extends BaseMessageParams {
  cseq: number;
  toDisplayName?: string;
  fromDisplayName?: string;
  toLine?: string; // Pre-formatted To header line (optional)
  fromLine?: string; // Pre-formatted From header line (optional)
}

/**
 * Parameters for creating BYE messages
 * Supports: REGISTRATION BYE, CONNECTION BYE, and custom BYE messages
 */
export interface ByeMessageParams extends BaseMessageParams {
  cseq: number;
  toDisplayName?: string;
  fromDisplayName?: string;
  toTag?: string; // Optional To-tag for REGISTRATION BYE
  reasonType?: "REGISTRATION" | "CONNECTION" | "CUSTOM"; // Type of BYE message
  reasonText?: string; // Custom reason text
}

/**
 * Parameters for creating SERVICE messages
 * Used for: SDP Offer (CSeq: 1), SDP Answer (CSeq: 2), etc.
 */
export interface ServiceMessageParams extends BaseMessageParams {
  cseq: number;
  toLine: string; // Pre-formatted To header line
  body: string; // SDP body (JSON string)
  contentType?: string; // Default: 'application/sdp'
  expires?: number; // Default: 300
  fromDisplayName?: string;
}

/**
 * Parameters for creating REGISTER messages
 * Unique structure with timeout configuration
 */
export interface RegisterMessageParams extends BaseMessageParams {
  fromDisplayName: string;
  toDisplayName: string;
  timeoutConfig: {
    ConnectionTimeout: number;
    PeerRegistrationTimeout: number;
    ReceiveTimeout: number;
  };
  cseq?: number; // Default: 1
}

// ========================================
// MESSAGE FACTORY CLASS
// ========================================

export class MessageFactory {
  /**
   * Creates an ACK message (unified for all ACK types)
   *
   * Usage examples:
   * - Registration ACK (CSeq: 3) responding to 202 Accepted
   * - Connection ACK (CSeq: 5) responding to NOTIFY4
   *
   * @param params - ACK message parameters
   * @returns Formatted SIP ACK message
   */
  static createAckMessage(params: AckMessageParams): string {
    logger.debug(`Creating ACK message (CSeq: ${params.cseq})`, "MessageFactory");

    // Build To and From lines
    let toLine: string;
    let fromLine: string;

    if (params.toLine && params.fromLine) {
      // Use pre-formatted lines (e.g., for NOTIFY ACKs with swapped headers)
      toLine = params.toLine;
      fromLine = params.fromLine;
    } else {
      // Build standard lines
      const sipConfig = configService.getSipConfig();
      const toDisplay = params.toDisplayName || sipConfig.toDisplayName;
      const fromDisplay = params.fromDisplayName || sipConfig.fromDisplayName;
      const toSipUri = configService.buildSipUri(toDisplay);

      toLine = `"${toDisplay}" <${toSipUri}>`;
      fromLine = `"${fromDisplay}" <${params.sipUri};transport=wss>;tag=${params.tag}`;
    }

    const ackMessage =
      `ACK ${params.sipUri} SIP/2.0\r\n` +
      `Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=${params.branch}\r\n` +
      `Max-Forwards: 70\r\n` +
      `To: ${toLine}\r\n` +
      `From: ${fromLine}\r\n` +
      `Call-ID: ${params.callId}\r\n` +
      `CSeq: ${params.cseq} ACK\r\n` +
      `Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n` +
      `Content-Length: 0\r\n\r\n`;

    logger.debug(`ACK message created (CSeq: ${params.cseq})`, "MessageFactory");
    return ackMessage;
  }

  /**
   * Creates a BYE message (unified for all BYE types)
   *
   * Supports three types:
   * - REGISTRATION BYE: Used during registration phase failures/timeouts
   * - CONNECTION BYE: Used during connection establishment failures
   * - CUSTOM: Custom BYE with user-defined reason
   *
   * @param params - BYE message parameters
   * @returns Formatted SIP BYE message
   */
  static createByeMessage(params: ByeMessageParams): string {
    logger.debug(
      `Creating BYE message (CSeq: ${params.cseq}, Type: ${params.reasonType || "none"})`,
      "MessageFactory"
    );

    const sipConfig = configService.getSipConfig();
    const toDisplay = params.toDisplayName || sipConfig.toDisplayName;
    const fromDisplay = params.fromDisplayName || sipConfig.fromDisplayName;
    const toSipUri = configService.buildSipUri(toDisplay);

    // Build To header with optional tag
    let toHeader = `"${toDisplay}" <${toSipUri}>`;
    if (params.toTag) {
      toHeader += `;tag=${params.toTag}`;
    }

    // Build Reason header based on type
    let reasonHeader = "";
    if (params.reasonType === "REGISTRATION") {
      reasonHeader = `Reason: REGISTRATION${params.reasonText ? ` - ${params.reasonText}` : ""}\r\n`;
    } else if (params.reasonType === "CONNECTION") {
      reasonHeader = `Reason: CONNECTION${params.reasonText ? ` - ${params.reasonText}` : ""}\r\n`;
    } else if (params.reasonType === "CUSTOM" && params.reasonText) {
      reasonHeader = `Reason: ${params.reasonText}\r\n`;
    }

    // Determine method name based on type
    const method = params.reasonType ? `${params.reasonType} BYE` : "BYE";

    const byeMessage =
      `BYE ${params.sipUri} SIP/2.0\r\n` +
      `Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=${params.branch}\r\n` +
      `Max-Forwards: 70\r\n` +
      `To: ${toHeader}\r\n` +
      `From: "${fromDisplay}" <${params.sipUri};transport=wss>;tag=${params.tag}\r\n` +
      `Call-ID: ${params.callId}\r\n` +
      `CSeq: ${params.cseq} ${method}\r\n` +
      `Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n` +
      reasonHeader +
      `Content-Length: 0\r\n\r\n`;

    logger.debug(
      `BYE message created (Type: ${params.reasonType || "standard"})`,
      "MessageFactory"
    );
    return byeMessage;
  }

  /**
   * Creates a SERVICE message (unified for SDP offer/answer exchange)
   *
   * Usage examples:
   * - SDP Offer (CSeq: 1) - OWA client creates and sends offer
   * - SDP Answer (CSeq: 2) - Server responds with answer
   *
   * @param params - SERVICE message parameters
   * @returns Formatted SIP SERVICE message with SDP body
   */
  static createServiceMessage(params: ServiceMessageParams): string {
    logger.debug(`Creating SERVICE message (CSeq: ${params.cseq})`, "MessageFactory");

    const contentType = params.contentType || "application/sdp";
    const expires = params.expires || 300;
    const fromDisplay = params.fromDisplayName || "macc";
    const contentLength = helper.contentLength(params.body);

    const serviceMessage =
      `SERVICE ${params.sipUri} SIP/2.0\r\n` +
      `Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=${params.branch}\r\n` +
      `Max-Forwards: 70\r\n` +
      `${params.toLine}\r\n` +
      `From: "${fromDisplay}" <${params.sipUri};transport=wss>;tag=${params.tag}\r\n` +
      `Call-ID: ${params.callId}\r\n` +
      `CSeq: ${params.cseq} SERVICE\r\n` +
      `Expires: ${expires}\r\n` +
      `Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n` +
      `Supported: path,gruu,outbound\r\n` +
      `User-Agent: JsSIP 3.10.0\r\n` +
      `Content-Type: ${contentType}\r\n` +
      `Contact: <${params.sipUri}>\r\n` +
      `Content-Length: ${contentLength}\r\n\r\n` +
      params.body;

    logger.debug(`SERVICE message created (CSeq: ${params.cseq})`, "MessageFactory");
    return serviceMessage;
  }

  /**
   * Creates a REGISTER message (specific method for unique structure)
   *
   * REGISTER messages have a unique structure with:
   * - JSON body containing timeout configuration
   * - Specific headers: Expires, Contact, Supported
   * - Content-Type: application/json
   *
   * @param params - REGISTER message parameters
   * @returns Formatted SIP REGISTER message
   */
  static createRegisterMessage(params: RegisterMessageParams): string {
    const cseq = params.cseq || 1;
    logger.debug(`Creating REGISTER message (CSeq: ${cseq})`, "MessageFactory");

    // Generate timeout configuration JSON body
    const timeoutBody = JSON.stringify(params.timeoutConfig);
    const contentLength = timeoutBody.length;

    const registerMessage =
      `REGISTER ${params.sipUri} SIP/2.0\r\n` +
      `Via: SIP/2.0/WSS fgtpfo6ru3jm.invalid;branch=${params.branch}\r\n` +
      `Max-Forwards: 70\r\n` +
      `To: "${params.toDisplayName}" <${configService.buildSipUri(params.toDisplayName)}>\r\n` +
      `From: "${params.fromDisplayName}" <${params.sipUri};transport=wss>;tag=${params.tag}\r\n` +
      `Call-ID: ${params.callId}\r\n` +
      `CSeq: ${cseq} REGISTER\r\n` +
      `Expires: 300\r\n` +
      `Allow: INVITE,ACK,CANCEL,BYE,UPDATE,MESSAGE,OPTIONS,REFER,INFO,NOTIFY\r\n` +
      `Supported: path,gruu,outbound\r\n` +
      `User-Agent: JsSIP 3.10.0\r\n` +
      `Contact: <${params.sipUri}>\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${contentLength}\r\n\r\n` +
      timeoutBody;

    logger.debug("REGISTER message created with timeout configuration", "MessageFactory");
    return registerMessage;
  }
}
