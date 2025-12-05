/**
 * Unit Tests for connectionSlice
 * Tests all reducers, actions, selectors, and state transitions
 */

import connectionReducer, {
  updateConnectionState,
  updateConnectionStatus,
  setConnected,
  setConnecting,
  setRegistered,
  setConnectionEstablished,
  setPeerConnected,
  setDataChannelOpen,
  setConnectionError,
  incrementReconnectAttempts,
  resetReconnectAttempts,
  updateConnectionHealth,
  resetConnection,
  setIdle,
  updateLastActivity,
  setIdleDisconnected,
  setAutoReconnectPending,
  selectConnectionState,
  selectConnectionHealth,
  selectIsConnected,
  selectIsConnecting,
  selectIsRegistered,
  selectIsConnectionEstablished,
  selectConnectionStatus,
  selectIsReady,
  ConnectionState,
  ConnectionHealth,
} from '../connectionSlice';
import { RootState } from '../../index';
import { cleanupTests } from '../testHelpers';

describe('connectionSlice', () => {
  beforeEach(() => {
    cleanupTests();
  });

  // Initial state for tests
  const initialState = {
    state: {
      isConnected: false,
      isConnecting: false,
      isRegistered: false,
      isConnectionEstablished: false,
      isPeerConnected: false,
      isDataChannelOpen: false,
      isAuthenticated: false,
      isAuthenticating: false,
      connectionStatus: 'Initializing...',
      reconnectAttempts: 0,
      isIdle: false,
      autoReconnectPending: false,
    },
    health: {
      isHealthy: false,
      latency: 0,
      lastHealthCheck: expect.any(String),
      consecutiveFailures: 0,
    },
  };

  describe('Reducer', () => {
    it('should return the initial state', () => {
      const result = connectionReducer(undefined, { type: 'unknown' });
      expect(result).toEqual(initialState);
    });

    it('should have correct initial state structure', () => {
      const state = connectionReducer(undefined, { type: 'unknown' });
      
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('health');
      expect(state.state).toHaveProperty('isConnected');
      expect(state.state).toHaveProperty('connectionStatus');
      expect(state.health).toHaveProperty('isHealthy');
      expect(state.health).toHaveProperty('latency');
    });
  });

  describe('updateConnectionState', () => {
    it('should update partial connection state', () => {
      const state = connectionReducer(
        initialState,
        updateConnectionState({ isConnected: true, isRegistered: true })
      );

      expect(state.state.isConnected).toBe(true);
      expect(state.state.isRegistered).toBe(true);
      expect(state.state.isConnecting).toBe(false); // unchanged
    });

    it('should update multiple properties at once', () => {
      const updates: Partial<ConnectionState> = {
        isConnected: true,
        isRegistered: true,
        isConnectionEstablished: true,
        isDataChannelOpen: true,
        connectionStatus: 'Connected',
      };

      const state = connectionReducer(initialState, updateConnectionState(updates));

      expect(state.state.isConnected).toBe(true);
      expect(state.state.isRegistered).toBe(true);
      expect(state.state.isConnectionEstablished).toBe(true);
      expect(state.state.isDataChannelOpen).toBe(true);
      expect(state.state.connectionStatus).toBe('Connected');
    });

    it('should preserve unchanged properties', () => {
      const modifiedState = {
        ...initialState,
        state: {
          ...initialState.state,
          isConnected: true,
          reconnectAttempts: 5,
        },
      };

      const state = connectionReducer(
        modifiedState,
        updateConnectionState({ isRegistered: true })
      );

      expect(state.state.isConnected).toBe(true);
      expect(state.state.reconnectAttempts).toBe(5);
      expect(state.state.isRegistered).toBe(true);
    });

    it('should update lastError property', () => {
      const state = connectionReducer(
        initialState,
        updateConnectionState({ lastError: 'Connection failed' })
      );

      expect(state.state.lastError).toBe('Connection failed');
    });

    it('should update lastSuccessfulConnection timestamp', () => {
      const timestamp = new Date().toISOString();
      const state = connectionReducer(
        initialState,
        updateConnectionState({ lastSuccessfulConnection: timestamp })
      );

      expect(state.state.lastSuccessfulConnection).toBe(timestamp);
    });
  });

  describe('updateConnectionStatus', () => {
    it('should update connection status message', () => {
      const state = connectionReducer(
        initialState,
        updateConnectionStatus('Connecting to server...')
      );

      expect(state.state.connectionStatus).toBe('Connecting to server...');
    });

    it('should override previous status', () => {
      let state = connectionReducer(initialState, updateConnectionStatus('Connecting...'));
      state = connectionReducer(state, updateConnectionStatus('Connected'));

      expect(state.state.connectionStatus).toBe('Connected');
    });

    it('should handle empty status string', () => {
      const state = connectionReducer(initialState, updateConnectionStatus(''));

      expect(state.state.connectionStatus).toBe('');
    });
  });

  describe('setConnected', () => {
    it('should set isConnected to true', () => {
      const state = connectionReducer(initialState, setConnected(true));

      expect(state.state.isConnected).toBe(true);
    });

    it('should set isConnected to false', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, isConnected: true },
      };

      const state = connectionReducer(modifiedState, setConnected(false));

      expect(state.state.isConnected).toBe(false);
    });

    it('should set lastSuccessfulConnection timestamp when connected', () => {
      const beforeTime = Date.now();
      const state = connectionReducer(initialState, setConnected(true));
      const afterTime = Date.now();

      expect(state.state.lastSuccessfulConnection).toBeDefined();
      const timestamp = new Date(state.state.lastSuccessfulConnection!).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should reset reconnectAttempts to 0 when connected', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, reconnectAttempts: 5 },
      };

      const state = connectionReducer(modifiedState, setConnected(true));

      expect(state.state.reconnectAttempts).toBe(0);
    });

    it('should not set lastSuccessfulConnection when disconnecting', () => {
      const state = connectionReducer(initialState, setConnected(false));

      expect(state.state.lastSuccessfulConnection).toBeUndefined();
    });

    it('should not reset reconnectAttempts when disconnecting', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, reconnectAttempts: 3 },
      };

      const state = connectionReducer(modifiedState, setConnected(false));

      expect(state.state.reconnectAttempts).toBe(3);
    });
  });

  describe('setConnecting', () => {
    it('should set isConnecting to true', () => {
      const state = connectionReducer(initialState, setConnecting(true));

      expect(state.state.isConnecting).toBe(true);
    });

    it('should set isConnecting to false', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, isConnecting: true },
      };

      const state = connectionReducer(modifiedState, setConnecting(false));

      expect(state.state.isConnecting).toBe(false);
    });
  });

  describe('setRegistered', () => {
    it('should set isRegistered to true', () => {
      const state = connectionReducer(initialState, setRegistered(true));

      expect(state.state.isRegistered).toBe(true);
    });

    it('should set isRegistered to false', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, isRegistered: true },
      };

      const state = connectionReducer(modifiedState, setRegistered(false));

      expect(state.state.isRegistered).toBe(false);
    });
  });

  describe('setConnectionEstablished', () => {
    it('should set isConnectionEstablished to true', () => {
      const state = connectionReducer(initialState, setConnectionEstablished(true));

      expect(state.state.isConnectionEstablished).toBe(true);
    });

    it('should set isConnectionEstablished to false', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, isConnectionEstablished: true },
      };

      const state = connectionReducer(modifiedState, setConnectionEstablished(false));

      expect(state.state.isConnectionEstablished).toBe(false);
    });
  });

  describe('setPeerConnected', () => {
    it('should set isPeerConnected to true', () => {
      const state = connectionReducer(initialState, setPeerConnected(true));

      expect(state.state.isPeerConnected).toBe(true);
    });

    it('should set isPeerConnected to false', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, isPeerConnected: true },
      };

      const state = connectionReducer(modifiedState, setPeerConnected(false));

      expect(state.state.isPeerConnected).toBe(false);
    });
  });

  describe('setDataChannelOpen', () => {
    it('should set isDataChannelOpen to true', () => {
      const state = connectionReducer(initialState, setDataChannelOpen(true));

      expect(state.state.isDataChannelOpen).toBe(true);
    });

    it('should set isDataChannelOpen to false', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, isDataChannelOpen: true },
      };

      const state = connectionReducer(modifiedState, setDataChannelOpen(false));

      expect(state.state.isDataChannelOpen).toBe(false);
    });
  });

  describe('setConnectionError', () => {
    it('should set lastError message', () => {
      const state = connectionReducer(
        initialState,
        setConnectionError('Network timeout')
      );

      expect(state.state.lastError).toBe('Network timeout');
    });

    it('should set isConnecting to false', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, isConnecting: true },
      };

      const state = connectionReducer(modifiedState, setConnectionError('Failed'));

      expect(state.state.isConnecting).toBe(false);
    });

    it('should set isConnected to false', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, isConnected: true },
      };

      const state = connectionReducer(modifiedState, setConnectionError('Failed'));

      expect(state.state.isConnected).toBe(false);
    });

    it('should update error and reset connection flags simultaneously', () => {
      const modifiedState = {
        ...initialState,
        state: {
          ...initialState.state,
          isConnected: true,
          isConnecting: true,
        },
      };

      const state = connectionReducer(
        modifiedState,
        setConnectionError('Connection lost')
      );

      expect(state.state.lastError).toBe('Connection lost');
      expect(state.state.isConnected).toBe(false);
      expect(state.state.isConnecting).toBe(false);
    });
  });

  describe('incrementReconnectAttempts', () => {
    it('should increment reconnectAttempts by 1', () => {
      const state = connectionReducer(initialState, incrementReconnectAttempts());

      expect(state.state.reconnectAttempts).toBe(1);
    });

    it('should increment from previous value', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, reconnectAttempts: 3 },
      };

      const state = connectionReducer(modifiedState, incrementReconnectAttempts());

      expect(state.state.reconnectAttempts).toBe(4);
    });

    it('should handle multiple increments', () => {
      let state = connectionReducer(initialState, incrementReconnectAttempts());
      state = connectionReducer(state, incrementReconnectAttempts());
      state = connectionReducer(state, incrementReconnectAttempts());

      expect(state.state.reconnectAttempts).toBe(3);
    });
  });

  describe('resetReconnectAttempts', () => {
    it('should reset reconnectAttempts to 0', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, reconnectAttempts: 5 },
      };

      const state = connectionReducer(modifiedState, resetReconnectAttempts());

      expect(state.state.reconnectAttempts).toBe(0);
    });

    it('should keep 0 if already 0', () => {
      const state = connectionReducer(initialState, resetReconnectAttempts());

      expect(state.state.reconnectAttempts).toBe(0);
    });
  });

  describe('updateConnectionHealth', () => {
    it('should update health status', () => {
      const state = connectionReducer(
        initialState,
        updateConnectionHealth({ isHealthy: true, latency: 50 })
      );

      expect(state.health.isHealthy).toBe(true);
      expect(state.health.latency).toBe(50);
    });

    it('should update lastHealthCheck timestamp', () => {
      const beforeTime = Date.now();
      const state = connectionReducer(
        initialState,
        updateConnectionHealth({ isHealthy: true })
      );
      const afterTime = Date.now();

      expect(state.health.lastHealthCheck).toBeDefined();
      const timestamp = new Date(state.health.lastHealthCheck).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should update consecutiveFailures', () => {
      const state = connectionReducer(
        initialState,
        updateConnectionHealth({ consecutiveFailures: 3 })
      );

      expect(state.health.consecutiveFailures).toBe(3);
    });

    it('should preserve unchanged health properties', () => {
      const modifiedState = {
        ...initialState,
        health: {
          ...initialState.health,
          latency: 100,
          consecutiveFailures: 2,
        },
      };

      const state = connectionReducer(
        modifiedState,
        updateConnectionHealth({ isHealthy: true })
      );

      expect(state.health.isHealthy).toBe(true);
      expect(state.health.latency).toBe(100);
      expect(state.health.consecutiveFailures).toBe(2);
    });

    it('should update multiple health properties at once', () => {
      const state = connectionReducer(
        initialState,
        updateConnectionHealth({
          isHealthy: true,
          latency: 75,
          consecutiveFailures: 0,
        })
      );

      expect(state.health.isHealthy).toBe(true);
      expect(state.health.latency).toBe(75);
      expect(state.health.consecutiveFailures).toBe(0);
    });
  });

  describe('resetConnection', () => {
    it('should reset all state to initial values', () => {
      const modifiedState = {
        state: {
          isConnected: true,
          isConnecting: true,
          isRegistered: true,
          isConnectionEstablished: true,
          isPeerConnected: true,
          isDataChannelOpen: true,
          isAuthenticated: true,
          isAuthenticating: true,
          connectionStatus: 'Connected',
          lastError: 'Some error',
          reconnectAttempts: 5,
          lastSuccessfulConnection: new Date().toISOString(),
          isIdle: true,
          autoReconnectPending: true,
        },
        health: {
          isHealthy: true,
          latency: 100,
          lastHealthCheck: new Date().toISOString(),
          consecutiveFailures: 3,
        },
      };

      const state = connectionReducer(modifiedState, resetConnection());

      expect(state.state.isConnected).toBe(false);
      expect(state.state.isConnecting).toBe(false);
      expect(state.state.isRegistered).toBe(false);
      expect(state.state.isConnectionEstablished).toBe(false);
      expect(state.state.isPeerConnected).toBe(false);
      expect(state.state.isDataChannelOpen).toBe(false);
      expect(state.state.connectionStatus).toBe('Initializing...');
      expect(state.state.reconnectAttempts).toBe(0);
      expect(state.state.lastError).toBeUndefined();
      expect(state.state.isIdle).toBe(false);
      expect(state.state.autoReconnectPending).toBe(false);
    });

    it('should reset health to initial values', () => {
      const modifiedState = {
        ...initialState,
        health: {
          isHealthy: true,
          latency: 150,
          lastHealthCheck: '2025-01-01T00:00:00.000Z',
          consecutiveFailures: 5,
        },
      };

      const state = connectionReducer(modifiedState, resetConnection());

      expect(state.health.isHealthy).toBe(false);
      expect(state.health.latency).toBe(0);
      expect(state.health.consecutiveFailures).toBe(0);
    });
  });

  describe('setIdle', () => {
    it('should set isIdle to true', () => {
      const state = connectionReducer(initialState, setIdle(true));

      expect(state.state.isIdle).toBe(true);
    });

    it('should set isIdle to false', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, isIdle: true },
      };

      const state = connectionReducer(modifiedState, setIdle(false));

      expect(state.state.isIdle).toBe(false);
    });
  });

  describe('updateLastActivity', () => {
    it('should update lastActivityTimestamp', () => {
      const beforeTime = Date.now();
      const state = connectionReducer(initialState, updateLastActivity());
      const afterTime = Date.now();

      expect(state.state.lastActivityTimestamp).toBeDefined();
      const timestamp = new Date(state.state.lastActivityTimestamp!).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should override previous timestamp', () => {
      const modifiedState = {
        ...initialState,
        state: {
          ...initialState.state,
          lastActivityTimestamp: '2025-01-01T00:00:00.000Z',
        },
      };

      const state = connectionReducer(modifiedState, updateLastActivity());

      expect(state.state.lastActivityTimestamp).not.toBe('2025-01-01T00:00:00.000Z');
      expect(state.state.lastActivityTimestamp).toBeDefined();
    });
  });

  describe('setIdleDisconnected', () => {
    it('should set idleDisconnectedAt timestamp', () => {
      const timestamp = new Date().toISOString();
      const state = connectionReducer(initialState, setIdleDisconnected(timestamp));

      expect(state.state.idleDisconnectedAt).toBe(timestamp);
    });

    it('should set autoReconnectPending to true when timestamp provided', () => {
      const timestamp = new Date().toISOString();
      const state = connectionReducer(initialState, setIdleDisconnected(timestamp));

      expect(state.state.autoReconnectPending).toBe(true);
    });

    it('should clear idleDisconnectedAt with undefined', () => {
      const modifiedState = {
        ...initialState,
        state: {
          ...initialState.state,
          idleDisconnectedAt: new Date().toISOString(),
        },
      };

      const state = connectionReducer(modifiedState, setIdleDisconnected(undefined));

      expect(state.state.idleDisconnectedAt).toBeUndefined();
    });

    it('should not set autoReconnectPending when clearing timestamp', () => {
      const modifiedState = {
        ...initialState,
        state: {
          ...initialState.state,
          idleDisconnectedAt: new Date().toISOString(),
          autoReconnectPending: true,
        },
      };

      const state = connectionReducer(modifiedState, setIdleDisconnected(undefined));

      expect(state.state.autoReconnectPending).toBe(true); // Not changed
    });
  });

  describe('setAutoReconnectPending', () => {
    it('should set autoReconnectPending to true', () => {
      const state = connectionReducer(initialState, setAutoReconnectPending(true));

      expect(state.state.autoReconnectPending).toBe(true);
    });

    it('should set autoReconnectPending to false', () => {
      const modifiedState = {
        ...initialState,
        state: { ...initialState.state, autoReconnectPending: true },
      };

      const state = connectionReducer(modifiedState, setAutoReconnectPending(false));

      expect(state.state.autoReconnectPending).toBe(false);
    });
  });

  describe('Selectors', () => {
    const mockRootState: RootState = {
      connection: {
        state: {
          isConnected: true,
          isConnecting: false,
          isRegistered: true,
          isConnectionEstablished: true,
          isPeerConnected: true,
          isDataChannelOpen: true,
          isAuthenticated: true,
          isAuthenticating: false,
          connectionStatus: 'Connected',
          reconnectAttempts: 0,
          lastSuccessfulConnection: '2025-12-05T10:00:00.000Z',
          isIdle: false,
          autoReconnectPending: false,
        },
        health: {
          isHealthy: true,
          latency: 50,
          lastHealthCheck: '2025-12-05T10:00:00.000Z',
          consecutiveFailures: 0,
        },
      },
    } as RootState;

    describe('selectConnectionState', () => {
      it('should select the entire connection state', () => {
        const result = selectConnectionState(mockRootState);

        expect(result).toEqual(mockRootState.connection.state);
      });
    });

    describe('selectConnectionHealth', () => {
      it('should select the connection health', () => {
        const result = selectConnectionHealth(mockRootState);

        expect(result).toEqual(mockRootState.connection.health);
      });
    });

    describe('selectIsConnected', () => {
      it('should select isConnected value', () => {
        const result = selectIsConnected(mockRootState);

        expect(result).toBe(true);
      });

      it('should return false when not connected', () => {
        const disconnectedState = {
          ...mockRootState,
          connection: {
            ...mockRootState.connection,
            state: { ...mockRootState.connection.state, isConnected: false },
          },
        } as RootState;

        const result = selectIsConnected(disconnectedState);

        expect(result).toBe(false);
      });
    });

    describe('selectIsConnecting', () => {
      it('should select isConnecting value', () => {
        const result = selectIsConnecting(mockRootState);

        expect(result).toBe(false);
      });

      it('should return true when connecting', () => {
        const connectingState = {
          ...mockRootState,
          connection: {
            ...mockRootState.connection,
            state: { ...mockRootState.connection.state, isConnecting: true },
          },
        } as RootState;

        const result = selectIsConnecting(connectingState);

        expect(result).toBe(true);
      });
    });

    describe('selectIsRegistered', () => {
      it('should select isRegistered value', () => {
        const result = selectIsRegistered(mockRootState);

        expect(result).toBe(true);
      });
    });

    describe('selectIsConnectionEstablished', () => {
      it('should select isConnectionEstablished value', () => {
        const result = selectIsConnectionEstablished(mockRootState);

        expect(result).toBe(true);
      });
    });

    describe('selectConnectionStatus', () => {
      it('should select connectionStatus message', () => {
        const result = selectConnectionStatus(mockRootState);

        expect(result).toBe('Connected');
      });
    });

    describe('selectIsReady', () => {
      it('should return true when all required flags are true', () => {
        const result = selectIsReady(mockRootState);

        expect(result).toBe(true);
      });

      it('should return false when isConnected is false', () => {
        const state = {
          ...mockRootState,
          connection: {
            ...mockRootState.connection,
            state: { ...mockRootState.connection.state, isConnected: false },
          },
        } as RootState;

        const result = selectIsReady(state);

        expect(result).toBe(false);
      });

      it('should return false when isRegistered is false', () => {
        const state = {
          ...mockRootState,
          connection: {
            ...mockRootState.connection,
            state: { ...mockRootState.connection.state, isRegistered: false },
          },
        } as RootState;

        const result = selectIsReady(state);

        expect(result).toBe(false);
      });

      it('should return false when isConnectionEstablished is false', () => {
        const state = {
          ...mockRootState,
          connection: {
            ...mockRootState.connection,
            state: { ...mockRootState.connection.state, isConnectionEstablished: false },
          },
        } as RootState;

        const result = selectIsReady(state);

        expect(result).toBe(false);
      });

      it('should return false when isDataChannelOpen is false', () => {
        const state = {
          ...mockRootState,
          connection: {
            ...mockRootState.connection,
            state: { ...mockRootState.connection.state, isDataChannelOpen: false },
          },
        } as RootState;

        const result = selectIsReady(state);

        expect(result).toBe(false);
      });

      it('should return false when any required flag is missing', () => {
        const partialState = {
          ...mockRootState,
          connection: {
            ...mockRootState.connection,
            state: {
              ...mockRootState.connection.state,
              isConnected: true,
              isRegistered: false,
              isConnectionEstablished: true,
              isDataChannelOpen: false,
            },
          },
        } as RootState;

        const result = selectIsReady(partialState);

        expect(result).toBe(false);
      });
    });
  });

  describe('Complex State Transitions', () => {
    it('should handle complete connection flow', () => {
      let state = connectionReducer(initialState, setConnecting(true));
      expect(state.state.isConnecting).toBe(true);

      state = connectionReducer(state, updateConnectionStatus('Registering...'));
      expect(state.state.connectionStatus).toBe('Registering...');

      state = connectionReducer(state, setRegistered(true));
      expect(state.state.isRegistered).toBe(true);

      state = connectionReducer(state, setConnectionEstablished(true));
      expect(state.state.isConnectionEstablished).toBe(true);

      state = connectionReducer(state, setDataChannelOpen(true));
      expect(state.state.isDataChannelOpen).toBe(true);

      state = connectionReducer(state, setConnected(true));
      expect(state.state.isConnected).toBe(true);
      expect(state.state.isConnecting).toBe(true); // Not reset by setConnected
      expect(state.state.reconnectAttempts).toBe(0);
      expect(state.state.lastSuccessfulConnection).toBeDefined();

      state = connectionReducer(state, setConnecting(false));
      expect(state.state.isConnecting).toBe(false);
    });

    it('should handle connection failure and retry', () => {
      let state = connectionReducer(initialState, setConnecting(true));
      state = connectionReducer(state, setConnectionError('Network error'));

      expect(state.state.isConnected).toBe(false);
      expect(state.state.isConnecting).toBe(false);
      expect(state.state.lastError).toBe('Network error');

      state = connectionReducer(state, incrementReconnectAttempts());
      expect(state.state.reconnectAttempts).toBe(1);

      state = connectionReducer(state, setConnecting(true));
      state = connectionReducer(state, setConnected(true));

      expect(state.state.isConnected).toBe(true);
      expect(state.state.reconnectAttempts).toBe(0);
    });

    it('should handle idle disconnect and reconnect', () => {
      let state = connectionReducer(initialState, setIdle(true));
      expect(state.state.isIdle).toBe(true);

      const disconnectTime = new Date().toISOString();
      state = connectionReducer(state, setIdleDisconnected(disconnectTime));
      expect(state.state.idleDisconnectedAt).toBe(disconnectTime);
      expect(state.state.autoReconnectPending).toBe(true);

      state = connectionReducer(state, updateLastActivity());
      expect(state.state.lastActivityTimestamp).toBeDefined();

      state = connectionReducer(state, setIdle(false));
      state = connectionReducer(state, setAutoReconnectPending(false));
      expect(state.state.isIdle).toBe(false);
      expect(state.state.autoReconnectPending).toBe(false);
    });

    it('should handle health monitoring during connection', () => {
      let state = connectionReducer(initialState, setConnected(true));

      state = connectionReducer(
        state,
        updateConnectionHealth({ isHealthy: true, latency: 45 })
      );
      expect(state.health.isHealthy).toBe(true);
      expect(state.health.latency).toBe(45);

      state = connectionReducer(
        state,
        updateConnectionHealth({ consecutiveFailures: 1 })
      );
      expect(state.health.consecutiveFailures).toBe(1);

      state = connectionReducer(
        state,
        updateConnectionHealth({ isHealthy: false, consecutiveFailures: 3 })
      );
      expect(state.health.isHealthy).toBe(false);
      expect(state.health.consecutiveFailures).toBe(3);
    });

    it('should maintain state consistency during multiple updates', () => {
      let state = connectionReducer(
        initialState,
        updateConnectionState({
          isConnected: true,
          isRegistered: true,
          isConnectionEstablished: true,
          isDataChannelOpen: true,
          connectionStatus: 'Fully Connected',
        })
      );

      expect(state.state.isConnected).toBe(true);
      expect(state.state.isRegistered).toBe(true);
      expect(state.state.isConnectionEstablished).toBe(true);
      expect(state.state.isDataChannelOpen).toBe(true);
      expect(state.state.connectionStatus).toBe('Fully Connected');

      state = connectionReducer(state, resetConnection());

      expect(state.state.isConnected).toBe(false);
      expect(state.state.isRegistered).toBe(false);
      expect(state.state.isConnectionEstablished).toBe(false);
      expect(state.state.isDataChannelOpen).toBe(false);
      expect(state.state.connectionStatus).toBe('Initializing...');
    });
  });

  describe('Edge Cases', () => {
    it('should handle setting error without prior connection', () => {
      const state = connectionReducer(
        initialState,
        setConnectionError('Unexpected error')
      );

      expect(state.state.lastError).toBe('Unexpected error');
      expect(state.state.isConnected).toBe(false);
      expect(state.state.isConnecting).toBe(false);
    });

    it('should handle multiple consecutive errors', () => {
      let state = connectionReducer(initialState, setConnectionError('Error 1'));
      expect(state.state.lastError).toBe('Error 1');

      state = connectionReducer(state, setConnectionError('Error 2'));
      expect(state.state.lastError).toBe('Error 2');

      state = connectionReducer(state, setConnectionError('Error 3'));
      expect(state.state.lastError).toBe('Error 3');
    });

    it('should handle rapid reconnect attempts', () => {
      let state = initialState;

      for (let i = 0; i < 10; i++) {
        state = connectionReducer(state, incrementReconnectAttempts());
      }

      expect(state.state.reconnectAttempts).toBe(10);

      state = connectionReducer(state, setConnected(true));
      expect(state.state.reconnectAttempts).toBe(0);
    });

    it('should handle empty or null-like values gracefully', () => {
      const state = connectionReducer(
        initialState,
        updateConnectionState({})
      );

      expect(state.state).toEqual(initialState.state);
    });

    it('should preserve timestamps across updates', () => {
      const timestamp = '2025-12-05T12:00:00.000Z';
      let state = connectionReducer(
        initialState,
        updateConnectionState({ lastSuccessfulConnection: timestamp })
      );

      expect(state.state.lastSuccessfulConnection).toBe(timestamp);

      state = connectionReducer(state, updateConnectionStatus('Still connected'));

      expect(state.state.lastSuccessfulConnection).toBe(timestamp);
    });
  });
});
