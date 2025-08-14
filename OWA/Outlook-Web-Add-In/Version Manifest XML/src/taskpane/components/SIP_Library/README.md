# SIP Library Documentation

## Overview

The SIP Library provides a complete Session Initiation Protocol (SIP) communication solution with WebRTC peer-to-peer connectivity. This library has been refactored from a monolithic `SipClient.tsx` file into well-organized, documented modules for better maintainability and code organization.

## Architecture

The SIP Library is organized into the following modules:

### Core Modules

#### 1. Helper (`Helper.ts`)
**Purpose**: Utility functions for common SIP operations
- **Logging**: Centralized console logging for debugging
- **Blob Conversion**: Convert WebSocket Blob messages to strings (with both sync and async methods)
- **Content Length**: Calculate byte length for SIP Content-Length headers

**Key Methods**:
- `log(msg: string)`: Log messages to console
- `blobToString(b: Blob)`: Convert blob to string (deprecated sync method)
- `blobToStringAsync(b: Blob)`: Modern async blob to string conversion
- `contentLength(data: string)`: Calculate byte length of string data

#### 2. Registration (`Registration.ts`)
**Purpose**: Handles SIP registration process with the server
- **REGISTER Message**: Creates initial SIP REGISTER requests
- **Response Handling**: Processes 202 Accepted, NOTIFY, and other responses
- **ACK Generation**: Creates appropriate ACK messages for different scenarios
- **State Tracking**: Monitors registration completion state

**Key Methods**:
- `getInitialRegistration()`: Generate initial REGISTER message
- `parseMessage(data: string)`: Route incoming messages to appropriate handlers
- `createACK(data: string)`: Create ACK for 202 responses
- `createACKAfterNotification(data: string)`: Handle post-notification ACKs
- `createConfirmation(data: string)`: Generate confirmation ACKs

#### 3. EstablishingConnection (`EstablishingConnection.ts`)
**Purpose**: Manages connection establishment and role negotiation
- **Role Negotiation**: Determines which peer creates WebRTC offer/answer
- **NOTIFY/ACK Exchange**: Handles connection setup message exchange
- **JSON Payload**: Processes IsOffering flags in SIP message bodies
- **State Management**: Tracks connection establishment progress

**Key Methods**:
- `updateData()`: Update connection parameters from registration
- `parseMessage(data: string)`: Process connection establishment messages
- `createACKForIsOffer(data: string)`: Handle offer creation role
- `createOffer(data: string)`: Handle answer creation role
- `getIsOffer(data: string)`: Extract offering flag from JSON payload

#### 4. Peer2PeerConnection (`Peer2PeerConnection.ts`)
**Purpose**: Handles WebRTC peer-to-peer communication
- **SDP Exchange**: Manages offer/answer SDP exchange
- **Data Channels**: Sets up bidirectional data channels
- **ICE Handling**: Manages ICE candidate gathering and exchange
- **Message Routing**: Routes DataChannel messages between peers

**Key Methods**:
- `parseServiceIncoming()`: Process incoming SDP offers and create answers
- `createAndSendOffer()`: Create and send SDP offers
- `parseIncomingAnswer()`: Process incoming SDP answers
- `getActiveDataChannel()`: Get the active data channel for messaging

#### 5. SipClient (`SipClient.ts`)
**Purpose**: Main controller that orchestrates all SIP components
- **WebSocket Management**: Handles WebSocket connection lifecycle
- **Message Routing**: Routes messages to appropriate handlers based on state
- **State Coordination**: Coordinates state transitions between components
- **Error Handling**: Centralized error handling and logging

**Key Function**:
- `initializeSipClient()`: Main initialization function that returns all component instances

## Usage

### Basic Usage

```typescript
import { initializeSipClient } from './SIP_Library';

// Initialize the SIP client
const sipClient = initializeSipClient();

// Access individual components
const { registration, connection, peer2peer, socket } = sipClient;

// Get active data channel for messaging
const dataChannel = peer2peer.getActiveDataChannel();
if (dataChannel) {
    dataChannel.send("Hello, peer!");
}
```

### Advanced Usage

```typescript
import { 
    Registration, 
    EstablishingConnection, 
    Peer2PeerConnection,
    Helper,
    logger 
} from './SIP_Library';

// Use individual components
const helper = new Helper();
const registration = new Registration();

// Custom logging
logger.log("Custom SIP operation started");

// Calculate content length
const messageBody = '{"IsOffering":true}';
const length = helper.contentLength(messageBody);
```

## Migration from Legacy SipClient.tsx

The original `SipClient.tsx` file now serves as a compatibility layer:

```typescript
// Old way (still works for backward compatibility)
import initializeSipClient from './SipClient';

// New way (recommended)
import { initializeSipClient } from './SIP_Library';
```

## Improvements Made

### 1. Code Organization
- **Separation of Concerns**: Each class handles a specific aspect of SIP communication
- **Single Responsibility**: Each file has a clear, documented purpose
- **Modular Design**: Components can be used independently or together

### 2. Modern JavaScript/TypeScript
- **Replaced Deprecated Methods**: 
  - `substr()` → `substring()`
  - Synchronous blob handling → async `blob.text()`
- **Type Safety**: Added TypeScript interfaces and type annotations
- **Error Handling**: Improved error handling with proper try-catch blocks

### 3. Documentation
- **Comprehensive Comments**: Each file has detailed header documentation
- **Method Documentation**: All public methods have JSDoc comments
- **Architecture Overview**: Clear explanation of component interactions

### 4. Maintainability
- **Centralized Exports**: Single index.ts file for clean imports
- **Consistent Naming**: Clear, descriptive method and variable names
- **Error Messages**: Improved error messages with context

## Development Guidelines

### Adding New Features
1. Determine which component the feature belongs to
2. Add the feature to the appropriate class
3. Update the class documentation
4. Export any new public methods through index.ts
5. Add usage examples to this documentation

### Testing
Each component can be tested independently:
```typescript
import { Registration } from './SIP_Library';

const registration = new Registration();
const registerMsg = registration.getInitialRegistration();
// Test the generated message
```

### Debugging
Use the centralized logger for consistent debugging:
```typescript
import { logger } from './SIP_Library';

logger.log('Debug message: ' + JSON.stringify(data));
```

## Browser Compatibility

The library uses modern Web APIs:
- **WebRTC**: RTCPeerConnection, RTCDataChannel
- **WebSockets**: For SIP transport
- **TextEncoder/TextDecoder**: For string/byte conversion
- **Modern Promise APIs**: async/await, blob.text()

Ensure your target browsers support these APIs or include appropriate polyfills.

## Security Considerations

- **WebSocket Security**: Always use WSS (secure WebSocket) in production
- **SIP Authentication**: Implement proper SIP authentication mechanisms
- **Data Channel Security**: WebRTC data channels are encrypted by default
- **Input Validation**: Validate all incoming SIP messages before processing

## Future Enhancements

Potential areas for future development:
1. **Error Recovery**: Automatic reconnection and state recovery
2. **Message Queuing**: Queue messages during connection issues
3. **Performance Monitoring**: Add metrics and performance tracking
4. **Unit Tests**: Comprehensive test suite for each component
5. **Configuration**: Externalize configuration parameters
