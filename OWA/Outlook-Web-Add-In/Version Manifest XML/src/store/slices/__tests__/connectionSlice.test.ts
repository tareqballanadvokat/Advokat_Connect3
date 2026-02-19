/* eslint-disable no-undef */
/**
 * Unit Tests for connectionSlice
 * Tests all reducers, actions, selectors, and state transitions
 */

import connectionReducer, {
  updateConnectionState,
  updateConnectionStatus,
  setConnectionError,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  resetConnection,
  setIdle,
  updateLastActivity,
  setDisconnectedDueToIdleAt,
  setAutoReconnectPending,
  sipClientStateChanged,
  selectConnectionState,
  selectConnectionStatus,
  selectSipClientState,
  selectIsConnected,
  selectIsConnecting,
  selectIsFailed,
  selectIsDisconnected,
  selectIsReady,
  ConnectionState,
} from "../connectionSlice";
import { SipClientState } from "../../../taskpane/components/SIP_Library/SipClient";
import { cleanupTests } from "./testSetup";

describe("connectionSlice", () => {
  beforeEach(() => {
    cleanupTests();
  });

  // Initial state for tests
  const initialState: ConnectionState = {
    sipClientState: SipClientState.DISCONNECTED,
    connectionStatus: "Disconnected",
    reconnectAttempts: 0,
    isIdle: false,
    autoReconnectPending: false,
  };

  describe("Reducer", () => {
    it("should return the initial state", () => {
      const result = connectionReducer(undefined, { type: "unknown" });
      expect(result).toEqual(initialState);
    });

    it("should have correct initial state structure", () => {
      const state = connectionReducer(undefined, { type: "unknown" });

      expect(state).toHaveProperty("sipClientState");
      expect(state).toHaveProperty("connectionStatus");
      expect(state).toHaveProperty("reconnectAttempts");
      expect(state).toHaveProperty("isIdle");
      expect(state).toHaveProperty("autoReconnectPending");
      expect(state.sipClientState).toBe(SipClientState.DISCONNECTED);
      expect(state.connectionStatus).toBe("Disconnected");
    });
  });

  describe("sipClientStateChanged", () => {
    it('should update sipClientState and auto-set status to "Disconnected"', () => {
      const state = connectionReducer(
        initialState,
        sipClientStateChanged(SipClientState.DISCONNECTED)
      );

      expect(state.sipClientState).toBe(SipClientState.DISCONNECTED);
      expect(state.connectionStatus).toBe("Disconnected");
    });

    it('should set status to "Connecting..." for REGISTERING state', () => {
      const state = connectionReducer(
        initialState,
        sipClientStateChanged(SipClientState.REGISTERING)
      );

      expect(state.sipClientState).toBe(SipClientState.REGISTERING);
      expect(state.connectionStatus).toBe("Connecting...");
    });

    it('should set status to "Connecting..." for CONNECTING state', () => {
      const state = connectionReducer(
        initialState,
        sipClientStateChanged(SipClientState.CONNECTING)
      );

      expect(state.sipClientState).toBe(SipClientState.CONNECTING);
      expect(state.connectionStatus).toBe("Connecting...");
    });

    it('should set status to "Connecting..." for CONNECTING_P2P state', () => {
      const state = connectionReducer(
        initialState,
        sipClientStateChanged(SipClientState.CONNECTING_P2P)
      );

      expect(state.sipClientState).toBe(SipClientState.CONNECTING_P2P);
      expect(state.connectionStatus).toBe("Connecting...");
    });

    it('should set status to "Connected" for CONNECTED state', () => {
      const beforeTime = Date.now();
      const state = connectionReducer(
        initialState,
        sipClientStateChanged(SipClientState.CONNECTED)
      );
      const afterTime = Date.now();

      expect(state.sipClientState).toBe(SipClientState.CONNECTED);
      expect(state.connectionStatus).toBe("Connected");
      expect(state.lastSuccessfulConnection).toBeDefined();

      const timestamp = new Date(state.lastSuccessfulConnection!).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should reset reconnectAttempts when CONNECTED", () => {
      const stateWithAttempts = {
        ...initialState,
        reconnectAttempts: 5,
      };

      const state = connectionReducer(
        stateWithAttempts,
        sipClientStateChanged(SipClientState.CONNECTED)
      );

      expect(state.reconnectAttempts).toBe(0);
    });

    it("should not update lastSuccessfulConnection if already set", () => {
      const existingTimestamp = "2024-01-01T00:00:00.000Z";
      const stateWithTimestamp = {
        ...initialState,
        lastSuccessfulConnection: existingTimestamp,
      };

      const state = connectionReducer(
        stateWithTimestamp,
        sipClientStateChanged(SipClientState.CONNECTED)
      );

      expect(state.lastSuccessfulConnection).toBe(existingTimestamp);
    });

    it('should set status to "Connection failed" for FAILED state', () => {
      const state = connectionReducer(initialState, sipClientStateChanged(SipClientState.FAILED));

      expect(state.sipClientState).toBe(SipClientState.FAILED);
      expect(state.connectionStatus).toBe("Connection failed");
    });
  });

  describe("updateConnectionState", () => {
    it("should update partial connection state", () => {
      const state = connectionReducer(
        initialState,
        updateConnectionState({
          sipClientState: SipClientState.CONNECTED,
          connectionStatus: "Connected",
        })
      );

      expect(state.sipClientState).toBe(SipClientState.CONNECTED);
      expect(state.connectionStatus).toBe("Connected");
      expect(state.reconnectAttempts).toBe(0); // unchanged
    });

    it("should update multiple properties at once", () => {
      const updates: Partial<ConnectionState> = {
        sipClientState: SipClientState.CONNECTED,
        connectionStatus: "Connected",
        reconnectAttempts: 3,
        isIdle: true,
      };

      const state = connectionReducer(initialState, updateConnectionState(updates));

      expect(state.sipClientState).toBe(SipClientState.CONNECTED);
      expect(state.connectionStatus).toBe("Connected");
      expect(state.reconnectAttempts).toBe(3);
      expect(state.isIdle).toBe(true);
    });

    it("should preserve unchanged properties", () => {
      const modifiedState: ConnectionState = {
        ...initialState,
        sipClientState: SipClientState.CONNECTED,
        reconnectAttempts: 5,
      };

      const state = connectionReducer(
        modifiedState,
        updateConnectionState({ connectionStatus: "Updated" })
      );

      expect(state.sipClientState).toBe(SipClientState.CONNECTED);
      expect(state.reconnectAttempts).toBe(5);
      expect(state.connectionStatus).toBe("Updated");
    });

    it("should update lastError property", () => {
      const state = connectionReducer(
        initialState,
        updateConnectionState({ lastError: "Connection failed" })
      );

      expect(state.lastError).toBe("Connection failed");
    });

    it("should update lastSuccessfulConnection timestamp", () => {
      const timestamp = new Date().toISOString();
      const state = connectionReducer(
        initialState,
        updateConnectionState({ lastSuccessfulConnection: timestamp })
      );

      expect(state.lastSuccessfulConnection).toBe(timestamp);
    });
  });

  describe("updateConnectionStatus", () => {
    it("should update connection status message", () => {
      const state = connectionReducer(
        initialState,
        updateConnectionStatus("Connecting to server...")
      );

      expect(state.connectionStatus).toBe("Connecting to server...");
    });

    it("should override previous status", () => {
      let state = connectionReducer(initialState, updateConnectionStatus("Connecting..."));
      state = connectionReducer(state, updateConnectionStatus("Connected"));

      expect(state.connectionStatus).toBe("Connected");
    });

    it("should handle empty status string", () => {
      const state = connectionReducer(initialState, updateConnectionStatus(""));

      expect(state.connectionStatus).toBe("");
    });
  });

  describe("setConnectionError", () => {
    it("should set error message and update state to FAILED", () => {
      const state = connectionReducer(initialState, setConnectionError("Network timeout"));

      expect(state.lastError).toBe("Network timeout");
      expect(state.sipClientState).toBe(SipClientState.FAILED);
      expect(state.connectionStatus).toBe("Connection failed");
    });

    it("should override previous error", () => {
      let state = connectionReducer(initialState, setConnectionError("First error"));
      state = connectionReducer(state, setConnectionError("Second error"));

      expect(state.lastError).toBe("Second error");
      expect(state.sipClientState).toBe(SipClientState.FAILED);
    });

    it("should update state even if already connected", () => {
      const connectedState: ConnectionState = {
        ...initialState,
        sipClientState: SipClientState.CONNECTED,
        connectionStatus: "Connected",
      };

      const state = connectionReducer(connectedState, setConnectionError("Sudden disconnect"));

      expect(state.sipClientState).toBe(SipClientState.FAILED);
      expect(state.lastError).toBe("Sudden disconnect");
    });
  });

  describe("incrementReconnectAttempts", () => {
    it("should increment reconnect attempts from 0", () => {
      const state = connectionReducer(initialState, incrementReconnectAttempts());

      expect(state.reconnectAttempts).toBe(1);
    });

    it("should increment multiple times", () => {
      let state = connectionReducer(initialState, incrementReconnectAttempts());
      state = connectionReducer(state, incrementReconnectAttempts());
      state = connectionReducer(state, incrementReconnectAttempts());

      expect(state.reconnectAttempts).toBe(3);
    });

    it("should preserve other state properties", () => {
      const modifiedState: ConnectionState = {
        ...initialState,
        sipClientState: SipClientState.FAILED,
        lastError: "Connection lost",
      };

      const state = connectionReducer(modifiedState, incrementReconnectAttempts());

      expect(state.reconnectAttempts).toBe(1);
      expect(state.sipClientState).toBe(SipClientState.FAILED);
      expect(state.lastError).toBe("Connection lost");
    });
  });

  describe("resetReconnectAttempts", () => {
    it("should reset attempts to 0", () => {
      const stateWithAttempts: ConnectionState = {
        ...initialState,
        reconnectAttempts: 5,
      };

      const state = connectionReducer(stateWithAttempts, resetReconnectAttempts());

      expect(state.reconnectAttempts).toBe(0);
    });

    it("should work when already 0", () => {
      const state = connectionReducer(initialState, resetReconnectAttempts());

      expect(state.reconnectAttempts).toBe(0);
    });
  });

  describe("resetConnection", () => {
    it("should reset to initial state", () => {
      const modifiedState: ConnectionState = {
        sipClientState: SipClientState.CONNECTED,
        connectionStatus: "Connected",
        lastError: "Some error",
        reconnectAttempts: 5,
        lastSuccessfulConnection: new Date().toISOString(),
        isIdle: true,
        lastActivityTimestamp: new Date().toISOString(),
        idleDisconnectedAt: new Date().toISOString(),
        autoReconnectPending: true,
      };

      const state = connectionReducer(modifiedState, resetConnection());

      expect(state).toEqual(initialState);
    });
  });

  describe("setIdle", () => {
    it("should set idle to true", () => {
      const state = connectionReducer(initialState, setIdle(true));

      expect(state.isIdle).toBe(true);
    });

    it("should set idle to false", () => {
      const idleState: ConnectionState = {
        ...initialState,
        isIdle: true,
      };

      const state = connectionReducer(idleState, setIdle(false));

      expect(state.isIdle).toBe(false);
    });
  });

  describe("updateLastActivity", () => {
    it("should update lastActivityTimestamp", () => {
      const beforeTime = Date.now();
      const state = connectionReducer(initialState, updateLastActivity());
      const afterTime = Date.now();

      expect(state.lastActivityTimestamp).toBeDefined();
      const timestamp = new Date(state.lastActivityTimestamp!).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should update timestamp on subsequent calls", () => {
      const state1 = connectionReducer(initialState, updateLastActivity());

      // Wait a bit to ensure different timestamp
      const state2 = connectionReducer(state1, updateLastActivity());

      expect(state2.lastActivityTimestamp).toBeDefined();
      expect(state1.lastActivityTimestamp).toBeDefined();
      // Both should be valid ISO strings
      expect(() => new Date(state2.lastActivityTimestamp!)).not.toThrow();
    });
  });

  describe("setDisconnectedDueToIdleAt", () => {
    it("should set idleDisconnectedAt timestamp and enable auto-reconnect", () => {
      const timestamp = new Date().toISOString();
      const state = connectionReducer(initialState, setDisconnectedDueToIdleAt(timestamp));

      expect(state.idleDisconnectedAt).toBe(timestamp);
      expect(state.autoReconnectPending).toBe(true);
    });

    it("should clear idleDisconnectedAt when undefined", () => {
      const stateWithIdle: ConnectionState = {
        ...initialState,
        idleDisconnectedAt: new Date().toISOString(),
        autoReconnectPending: true,
      };

      const state = connectionReducer(stateWithIdle, setDisconnectedDueToIdleAt(undefined));

      expect(state.idleDisconnectedAt).toBeUndefined();
      expect(state.autoReconnectPending).toBe(true); // Not cleared by undefined
    });
  });

  describe("setAutoReconnectPending", () => {
    it("should set autoReconnectPending to true", () => {
      const state = connectionReducer(initialState, setAutoReconnectPending(true));

      expect(state.autoReconnectPending).toBe(true);
    });

    it("should set autoReconnectPending to false", () => {
      const stateWithPending: ConnectionState = {
        ...initialState,
        autoReconnectPending: true,
      };

      const state = connectionReducer(stateWithPending, setAutoReconnectPending(false));

      expect(state.autoReconnectPending).toBe(false);
    });
  });

  describe("Selectors", () => {
    const mockState = {
      connection: {
        sipClientState: SipClientState.CONNECTED,
        connectionStatus: "Connected",
        lastError: "Test error",
        reconnectAttempts: 3,
        lastSuccessfulConnection: "2024-01-01T00:00:00.000Z",
        isIdle: false,
        lastActivityTimestamp: "2024-01-01T00:00:00.000Z",
        idleDisconnectedAt: undefined,
        autoReconnectPending: false,
      },
      auth: {
        isAuthenticated: true,
        isAuthenticating: false,
        authToken: "test-token",
        authError: null,
      },
    } as any;

    describe("selectConnectionState", () => {
      it("should select the entire connection state", () => {
        const result = selectConnectionState(mockState);
        expect(result).toEqual(mockState.connection);
      });
    });

    describe("selectConnectionStatus", () => {
      it("should select connection status", () => {
        const result = selectConnectionStatus(mockState);
        expect(result).toBe("Connected");
      });
    });

    describe("selectSipClientState", () => {
      it("should select sipClientState", () => {
        const result = selectSipClientState(mockState);
        expect(result).toBe(SipClientState.CONNECTED);
      });
    });

    describe("selectIsConnected", () => {
      it("should return true when sipClientState is CONNECTED", () => {
        const result = selectIsConnected(mockState);
        expect(result).toBe(true);
      });

      it("should return false when sipClientState is not CONNECTED", () => {
        const disconnectedState = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.DISCONNECTED,
          },
        };

        const result = selectIsConnected(disconnectedState);
        expect(result).toBe(false);
      });

      it("should return false when sipClientState is CONNECTING", () => {
        const connectingState = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.CONNECTING,
          },
        };

        const result = selectIsConnected(connectingState);
        expect(result).toBe(false);
      });
    });

    describe("selectIsConnecting", () => {
      it("should return true for REGISTERING state", () => {
        const state = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.REGISTERING,
          },
        };

        const result = selectIsConnecting(state);
        expect(result).toBe(true);
      });

      it("should return true for CONNECTING state", () => {
        const state = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.CONNECTING,
          },
        };

        const result = selectIsConnecting(state);
        expect(result).toBe(true);
      });

      it("should return true for CONNECTING_P2P state", () => {
        const state = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.CONNECTING_P2P,
          },
        };

        const result = selectIsConnecting(state);
        expect(result).toBe(true);
      });

      it("should return false for CONNECTED state", () => {
        const result = selectIsConnecting(mockState);
        expect(result).toBe(false);
      });

      it("should return false for DISCONNECTED state", () => {
        const state = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.DISCONNECTED,
          },
        };

        const result = selectIsConnecting(state);
        expect(result).toBe(false);
      });

      it("should return false for FAILED state", () => {
        const state = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.FAILED,
          },
        };

        const result = selectIsConnecting(state);
        expect(result).toBe(false);
      });
    });

    describe("selectIsFailed", () => {
      it("should return true when sipClientState is FAILED", () => {
        const failedState = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.FAILED,
          },
        };

        const result = selectIsFailed(failedState);
        expect(result).toBe(true);
      });

      it("should return false when sipClientState is not FAILED", () => {
        const result = selectIsFailed(mockState);
        expect(result).toBe(false);
      });
    });

    describe("selectIsDisconnected", () => {
      it("should return true when sipClientState is DISCONNECTED", () => {
        const disconnectedState = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.DISCONNECTED,
          },
        };

        const result = selectIsDisconnected(disconnectedState);
        expect(result).toBe(true);
      });

      it("should return false when sipClientState is not DISCONNECTED", () => {
        const result = selectIsDisconnected(mockState);
        expect(result).toBe(false);
      });
    });

    describe("selectIsReady", () => {
      it("should return true when connected and authenticated", () => {
        const result = selectIsReady(mockState);
        expect(result).toBe(true);
      });

      it("should return false when connected but not authenticated", () => {
        const notAuthState = {
          ...mockState,
          auth: {
            ...mockState.auth,
            isAuthenticated: false,
          },
        };

        const result = selectIsReady(notAuthState);
        expect(result).toBe(false);
      });

      it("should return false when not connected but authenticated", () => {
        const notConnectedState = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.DISCONNECTED,
          },
        };

        const result = selectIsReady(notConnectedState);
        expect(result).toBe(false);
      });

      it("should return false when neither connected nor authenticated", () => {
        const neitherState = {
          ...mockState,
          connection: {
            ...mockState.connection,
            sipClientState: SipClientState.DISCONNECTED,
          },
          auth: {
            ...mockState.auth,
            isAuthenticated: false,
          },
        };

        const result = selectIsReady(neitherState);
        expect(result).toBe(false);
      });
    });
  });

  describe("State transitions", () => {
    it("should handle complete connection flow", () => {
      // Start disconnected
      let state = initialState;
      expect(state.sipClientState).toBe(SipClientState.DISCONNECTED);

      // Start registering
      state = connectionReducer(state, sipClientStateChanged(SipClientState.REGISTERING));
      expect(state.sipClientState).toBe(SipClientState.REGISTERING);
      expect(state.connectionStatus).toBe("Connecting...");

      // Move to connecting
      state = connectionReducer(state, sipClientStateChanged(SipClientState.CONNECTING));
      expect(state.sipClientState).toBe(SipClientState.CONNECTING);
      expect(state.connectionStatus).toBe("Connecting...");

      // Establish peer connection
      state = connectionReducer(state, sipClientStateChanged(SipClientState.CONNECTING_P2P));
      expect(state.sipClientState).toBe(SipClientState.CONNECTING_P2P);
      expect(state.connectionStatus).toBe("Connecting...");

      // Finally connected
      state = connectionReducer(state, sipClientStateChanged(SipClientState.CONNECTED));
      expect(state.sipClientState).toBe(SipClientState.CONNECTED);
      expect(state.connectionStatus).toBe("Connected");
      expect(state.lastSuccessfulConnection).toBeDefined();
      expect(state.reconnectAttempts).toBe(0);
    });

    it("should handle connection failure with reconnect attempts", () => {
      let state = initialState;

      // Try connecting
      state = connectionReducer(state, sipClientStateChanged(SipClientState.CONNECTING));

      // Connection fails
      state = connectionReducer(state, setConnectionError("Network timeout"));
      expect(state.sipClientState).toBe(SipClientState.FAILED);
      expect(state.lastError).toBe("Network timeout");

      // Increment reconnect attempts
      state = connectionReducer(state, incrementReconnectAttempts());
      expect(state.reconnectAttempts).toBe(1);

      // Try again
      state = connectionReducer(state, sipClientStateChanged(SipClientState.CONNECTING));

      // Fail again
      state = connectionReducer(state, setConnectionError("Connection refused"));
      state = connectionReducer(state, incrementReconnectAttempts());
      expect(state.reconnectAttempts).toBe(2);

      // Finally succeed
      state = connectionReducer(state, sipClientStateChanged(SipClientState.CONNECTED));
      expect(state.sipClientState).toBe(SipClientState.CONNECTED);
      expect(state.reconnectAttempts).toBe(0); // Reset on success
    });

    it("should handle idle disconnection and auto-reconnect", () => {
      // Start connected
      let state: ConnectionState = {
        ...initialState,
        sipClientState: SipClientState.CONNECTED,
        connectionStatus: "Connected",
      };

      // User becomes idle
      state = connectionReducer(state, setIdle(true));
      expect(state.isIdle).toBe(true);

      // Disconnect due to idle
      const idleTimestamp = new Date().toISOString();
      state = connectionReducer(state, setDisconnectedDueToIdleAt(idleTimestamp));
      state = connectionReducer(state, sipClientStateChanged(SipClientState.DISCONNECTED));

      expect(state.sipClientState).toBe(SipClientState.DISCONNECTED);
      expect(state.idleDisconnectedAt).toBe(idleTimestamp);
      expect(state.autoReconnectPending).toBe(true);

      // User becomes active again
      state = connectionReducer(state, updateLastActivity());
      state = connectionReducer(state, setIdle(false));

      // Auto-reconnect triggers
      state = connectionReducer(state, sipClientStateChanged(SipClientState.CONNECTING));
      state = connectionReducer(state, sipClientStateChanged(SipClientState.CONNECTED));
      state = connectionReducer(state, setAutoReconnectPending(false));

      expect(state.sipClientState).toBe(SipClientState.CONNECTED);
      expect(state.autoReconnectPending).toBe(false);
      expect(state.isIdle).toBe(false);
    });
  });
});
