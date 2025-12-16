// Setup file for Jest tests
import '@testing-library/jest-dom';

// Mock Office.js global object
global.Office = {
  context: {
    mailbox: {
      item: {
        subject: 'Test Subject',
        body: {
          getAsync: jest.fn(),
          setAsync: jest.fn(),
        },
        to: [],
        cc: [],
        bcc: [],
        attachments: [],
      },
      userProfile: {
        emailAddress: 'test@example.com',
        displayName: 'Test User',
      },
    },
    requirements: {
      isSetSupported: jest.fn(() => true),
    },
  },
  initialize: jest.fn(),
  onReady: jest.fn(() => Promise.resolve()),
} as any;

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
})) as any;

// Mock RTCPeerConnection for WebRTC tests
global.RTCPeerConnection = jest.fn(() => ({
  createOffer: jest.fn(() => Promise.resolve({ type: 'offer', sdp: 'mock-sdp' })),
  createAnswer: jest.fn(() => Promise.resolve({ type: 'answer', sdp: 'mock-sdp' })),
  setLocalDescription: jest.fn(() => Promise.resolve()),
  setRemoteDescription: jest.fn(() => Promise.resolve()),
  addIceCandidate: jest.fn(() => Promise.resolve()),
  createDataChannel: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  onicecandidate: null,
  ondatachannel: null,
  localDescription: null,
  remoteDescription: null,
})) as any;

// Mock RTCSessionDescription
global.RTCSessionDescription = jest.fn((init) => init) as any;

// Mock RTCIceCandidate
global.RTCIceCandidate = jest.fn((init) => init) as any;

// Mock window.matchMedia for theme detection
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
       args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
