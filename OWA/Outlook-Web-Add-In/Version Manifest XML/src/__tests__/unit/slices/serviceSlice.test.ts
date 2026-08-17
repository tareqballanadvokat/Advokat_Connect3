/* eslint-disable no-undef */
// Tests for serviceSlice
import serviceReducer, {
  setSelectedServiceId,
  setTime,
  setText,
  setSb,
  resetServiceData,
  setServiceData,
  clearServices,
  clearSaveLeistungError,
  loadServicesAsync,
  saveLeistungAsync,
  loadLeistungenAsync,
} from "@slices/serviceSlice";
import { createMockWebRTCService, setupDefaultWebRTCMocks, cleanupTests } from "./testSetup";
import { createMockService, createMockLeistungPostData, createMockLeistung } from "./mockFactories";

// Create mock WebRTC service
const mockWebRTCService = createMockWebRTCService();

// Mock WebRTC connection manager
jest.mock("@services/WebRTCConnectionManager", () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    getWebRTCApiService: jest.fn(() => mockWebRTCService),
  })),
}));

// Mock cache service so loadLeistungenAsync's cache reads/writes are deterministic
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
jest.mock("@infra/cache", () => {
  const actual = jest.requireActual("@infra/cache");
  return {
    ...actual,
    cacheService: {
      ...actual.cacheService,
      get: (...args: unknown[]) => mockCacheGet(...args),
      set: (...args: unknown[]) => mockCacheSet(...args),
    },
  };
});

const readyGetState = (overrides: Record<string, unknown> = {}) => ({
  service: {
    loadCounter: 0,
    previousLoadKey: null,
  },
  auth: { credentials: { username: "testuser" }, isAuthenticated: true },
  connection: { sipClientState: "CONNECTED" },
  ...overrides,
});

describe("serviceSlice", () => {
  const initialState = {
    selectedServiceId: 0,
    time: "",
    text: "",
    sb: "",
    services: [],
    servicesLoading: false,
    servicesError: null,
    saveLeistungLoading: false,
    saveLeistungError: null,
    savedLeistungen: [],
    savedLeistungenLoading: false,
    savedLeistungenError: null,
    loadCounter: 0,
    previousLoadKey: null,
    registeredServicesLoading: false,
  };

  beforeEach(() => {
    cleanupTests();

    // Setup default mock implementations
    setupDefaultWebRTCMocks(mockWebRTCService);

    // Default: cache is empty, writes succeed
    mockCacheGet.mockReset().mockResolvedValue(null);
    mockCacheSet.mockReset().mockResolvedValue(undefined);
  });

  describe("Reducer", () => {
    it("should return the initial state", () => {
      expect(serviceReducer(undefined, { type: "unknown" })).toEqual(initialState);
    });

    describe("setSelectedServiceId", () => {
      it("should set selected service ID", () => {
        const actual = serviceReducer(initialState, setSelectedServiceId(5));
        expect(actual.selectedServiceId).toBe(5);
      });

      it("should update existing service ID", () => {
        const previousState = { ...initialState, selectedServiceId: 1 };
        const actual = serviceReducer(previousState, setSelectedServiceId(10));
        expect(actual.selectedServiceId).toBe(10);
      });

      it("should allow setting to 0", () => {
        const previousState = { ...initialState, selectedServiceId: 5 };
        const actual = serviceReducer(previousState, setSelectedServiceId(0));
        expect(actual.selectedServiceId).toBe(0);
      });
    });

    describe("setTime", () => {
      it("should set time", () => {
        const actual = serviceReducer(initialState, setTime("2.5"));
        expect(actual.time).toBe("2.5");
      });

      it("should update existing time", () => {
        const previousState = { ...initialState, time: "1.0" };
        const actual = serviceReducer(previousState, setTime("3.0"));
        expect(actual.time).toBe("3.0");
      });

      it("should allow empty string", () => {
        const previousState = { ...initialState, time: "1.5" };
        const actual = serviceReducer(previousState, setTime(""));
        expect(actual.time).toBe("");
      });
    });

    describe("setText", () => {
      it("should set text", () => {
        const actual = serviceReducer(initialState, setText("Service description"));
        expect(actual.text).toBe("Service description");
      });

      it("should update existing text", () => {
        const previousState = { ...initialState, text: "Old text" };
        const actual = serviceReducer(previousState, setText("New text"));
        expect(actual.text).toBe("New text");
      });

      it("should allow empty string", () => {
        const previousState = { ...initialState, text: "Some text" };
        const actual = serviceReducer(previousState, setText(""));
        expect(actual.text).toBe("");
      });
    });

    describe("setSb", () => {
      it("should set sb value", () => {
        const actual = serviceReducer(initialState, setSb("45"));
        expect(actual.sb).toBe("45");
      });

      it("should update existing sb", () => {
        const previousState = { ...initialState, sb: "30" };
        const actual = serviceReducer(previousState, setSb("60"));
        expect(actual.sb).toBe("60");
      });

      it("should allow empty string", () => {
        const previousState = { ...initialState, sb: "15" };
        const actual = serviceReducer(previousState, setSb(""));
        expect(actual.sb).toBe("");
      });
    });

    describe("resetServiceData", () => {
      it("should reset all service form fields", () => {
        const previousState = {
          ...initialState,
          selectedServiceId: 5,
          time: "2.5",
          text: "Some text",
          sb: "45",
        };
        const actual = serviceReducer(previousState, resetServiceData());

        expect(actual.selectedServiceId).toBe(0);
        expect(actual.time).toBe("");
        expect(actual.text).toBe("");
        expect(actual.sb).toBe("");
      });

      it("should NOT reset services list or loading states", () => {
        const previousState = {
          ...initialState,
          selectedServiceId: 5,
          services: [createMockService()],
          servicesLoading: true,
          saveLeistungLoading: true,
        };
        const actual = serviceReducer(previousState, resetServiceData());

        expect(actual.services).toHaveLength(1);
        expect(actual.servicesLoading).toBe(true);
        expect(actual.saveLeistungLoading).toBe(true);
      });
    });

    describe("setServiceData", () => {
      it("should set all service fields at once", () => {
        const serviceData = {
          selectedServiceId: 10,
          time: "3.5",
          text: "Complete description",
          sb: "90",
        };
        const actual = serviceReducer(initialState, setServiceData(serviceData));

        expect(actual.selectedServiceId).toBe(10);
        expect(actual.time).toBe("3.5");
        expect(actual.text).toBe("Complete description");
        expect(actual.sb).toBe("90");
      });

      it("should overwrite existing values", () => {
        const previousState = {
          ...initialState,
          selectedServiceId: 1,
          time: "1.0",
          text: "Old",
          sb: "30",
        };
        const serviceData = {
          selectedServiceId: 5,
          time: "2.0",
          text: "New",
          sb: "60",
        };
        const actual = serviceReducer(previousState, setServiceData(serviceData));

        expect(actual.selectedServiceId).toBe(5);
        expect(actual.time).toBe("2.0");
        expect(actual.text).toBe("New");
        expect(actual.sb).toBe("60");
      });
    });

    describe("clearServices", () => {
      it("should clear services list and error", () => {
        const previousState = {
          ...initialState,
          services: [createMockService()],
          servicesError: "Some error",
          selectedServiceId: 5,
        };
        const actual = serviceReducer(previousState, clearServices());

        expect(actual.services).toEqual([]);
        expect(actual.servicesError).toBeNull();
        expect(actual.selectedServiceId).toBe(0);
      });

      it("should NOT affect other state", () => {
        const previousState = {
          ...initialState,
          services: [createMockService()],
          time: "2.5",
          text: "Text",
          sb: "45",
          servicesLoading: true,
        };
        const actual = serviceReducer(previousState, clearServices());

        expect(actual.time).toBe("2.5");
        expect(actual.text).toBe("Text");
        expect(actual.sb).toBe("45");
        expect(actual.servicesLoading).toBe(true);
      });
    });

    describe("clearSaveLeistungError", () => {
      it("should clear save error", () => {
        const previousState = { ...initialState, saveLeistungError: "Save failed" };
        const actual = serviceReducer(previousState, clearSaveLeistungError());

        expect(actual.saveLeistungError).toBeNull();
      });

      it("should not affect other state", () => {
        const previousState = {
          ...initialState,
          saveLeistungError: "Error",
          selectedServiceId: 5,
          time: "2.0",
        };
        const actual = serviceReducer(previousState, clearSaveLeistungError());

        expect(actual.saveLeistungError).toBeNull();
        expect(actual.selectedServiceId).toBe(5);
        expect(actual.time).toBe("2.0");
      });
    });
  });

  describe("Async Thunks", () => {
    describe("loadServicesAsync", () => {
      it("should handle pending state", () => {
        const action = { type: loadServicesAsync.pending.type };
        const actual = serviceReducer(initialState, action);

        expect(actual.servicesLoading).toBe(true);
        expect(actual.servicesError).toBeNull();
      });

      it("should handle fulfilled state", () => {
        const payload = [createMockService()];
        const action = {
          type: loadServicesAsync.fulfilled.type,
          payload,
        };
        const actual = serviceReducer(initialState, action);

        expect(actual.servicesLoading).toBe(false);
        expect(actual.services).toEqual(payload);
        expect(actual.servicesError).toBeNull();
      });

      it("should handle rejected state", () => {
        const action = {
          type: loadServicesAsync.rejected.type,
          error: { message: "Network error" },
        };
        const actual = serviceReducer(initialState, action);

        expect(actual.servicesLoading).toBe(false);
        expect(actual.servicesError).toBe("Network error");
      });

      it("should handle rejected state with undefined error", () => {
        const action = {
          type: loadServicesAsync.rejected.type,
          error: {},
        };
        const actual = serviceReducer(initialState, action);

        expect(actual.servicesLoading).toBe(false);
        expect(actual.servicesError).toBe("Failed to load services");
      });

      it("should clear error when starting new load", () => {
        const previousState = { ...initialState, servicesError: "Previous error" };
        const action = { type: loadServicesAsync.pending.type };
        const actual = serviceReducer(previousState, action);

        expect(actual.servicesError).toBeNull();
      });

      it("should handle multiple services", () => {
        const payload = [
          createMockService({ id: 1, kürzel: "SRV001" }),
          createMockService({ id: 2, kürzel: "SRV002" }),
          createMockService({ id: 3, kürzel: "SRV003" }),
        ];
        const action = {
          type: loadServicesAsync.fulfilled.type,
          payload,
        };
        const actual = serviceReducer(initialState, action);

        expect(actual.services).toHaveLength(3);
        expect(actual.services).toEqual(payload);
      });
    });

    describe("saveLeistungAsync", () => {
      it("should handle pending state", () => {
        const action = { type: saveLeistungAsync.pending.type };
        const actual = serviceReducer(initialState, action);

        expect(actual.saveLeistungLoading).toBe(true);
        expect(actual.saveLeistungError).toBeNull();
      });

      it("should handle fulfilled state", () => {
        const previousState = {
          ...initialState,
          saveLeistungLoading: true,
        };
        const action = { type: saveLeistungAsync.fulfilled.type };
        const actual = serviceReducer(previousState, action);

        expect(actual.saveLeistungLoading).toBe(false);
        expect(actual.saveLeistungError).toBeNull();
      });

      it("should handle rejected state", () => {
        const action = {
          type: saveLeistungAsync.rejected.type,
          error: { message: "Save failed" },
        };
        const actual = serviceReducer(initialState, action);

        expect(actual.saveLeistungLoading).toBe(false);
        expect(actual.saveLeistungError).toBe("Save failed");
      });

      it("should handle rejected state with undefined error", () => {
        const action = {
          type: saveLeistungAsync.rejected.type,
          error: {},
        };
        const actual = serviceReducer(initialState, action);

        expect(actual.saveLeistungLoading).toBe(false);
        expect(actual.saveLeistungError).toBe("Failed to save service");
      });

      it("should clear error when starting new save", () => {
        const previousState = { ...initialState, saveLeistungError: "Previous error" };
        const action = { type: saveLeistungAsync.pending.type };
        const actual = serviceReducer(previousState, action);

        expect(actual.saveLeistungError).toBeNull();
      });
    });

    describe("loadLeistungenAsync", () => {
      it("should handle pending state", () => {
        const action = { type: loadLeistungenAsync.pending.type };
        const actual = serviceReducer(initialState, action);

        expect(actual.savedLeistungenLoading).toBe(true);
        expect(actual.savedLeistungenError).toBeNull();
      });

      it("should clear error when starting a new load", () => {
        const previousState = { ...initialState, savedLeistungenError: "Previous error" };
        const action = { type: loadLeistungenAsync.pending.type };
        const actual = serviceReducer(previousState, action);

        expect(actual.savedLeistungenError).toBeNull();
      });

      it("should handle fulfilled state", () => {
        const payload = [createMockLeistung()];
        const action = {
          type: loadLeistungenAsync.fulfilled.type,
          payload,
          meta: { arg: { aktId: 123 } },
        };
        const actual = serviceReducer(initialState, action);

        expect(actual.savedLeistungenLoading).toBe(false);
        expect(actual.savedLeistungen).toEqual(payload);
        expect(actual.savedLeistungenError).toBeNull();
      });

      it("should reset loadCounter and set previousLoadKey on first load for an aktId", () => {
        const previousState = { ...initialState, loadCounter: 5, previousLoadKey: null };
        const action = {
          type: loadLeistungenAsync.fulfilled.type,
          payload: [],
          meta: { arg: { aktId: 123 } },
        };
        const actual = serviceReducer(previousState, action);

        expect(actual.loadCounter).toBe(0);
        expect(actual.previousLoadKey).toBe("123");
      });

      it("should increment loadCounter on repeated loads for the same aktId", () => {
        const previousState = { ...initialState, loadCounter: 1, previousLoadKey: "123" };
        const action = {
          type: loadLeistungenAsync.fulfilled.type,
          payload: [],
          meta: { arg: { aktId: 123 } },
        };
        const actual = serviceReducer(previousState, action);

        expect(actual.loadCounter).toBe(2);
        expect(actual.previousLoadKey).toBe("123");
      });

      it("should reset loadCounter when switching to a different aktId", () => {
        const previousState = { ...initialState, loadCounter: 7, previousLoadKey: "123" };
        const action = {
          type: loadLeistungenAsync.fulfilled.type,
          payload: [],
          meta: { arg: { aktId: 456 } },
        };
        const actual = serviceReducer(previousState, action);

        expect(actual.loadCounter).toBe(0);
        expect(actual.previousLoadKey).toBe("456");
      });

      it("should cap loadCounter at 100", () => {
        const previousState = { ...initialState, loadCounter: 100, previousLoadKey: "123" };
        const action = {
          type: loadLeistungenAsync.fulfilled.type,
          payload: [],
          meta: { arg: { aktId: 123 } },
        };
        const actual = serviceReducer(previousState, action);

        expect(actual.loadCounter).toBe(100);
      });

      it("should handle missing aktId in meta.arg", () => {
        const previousState = { ...initialState, loadCounter: 3, previousLoadKey: "123" };
        const action = {
          type: loadLeistungenAsync.fulfilled.type,
          payload: [],
          meta: { arg: {} },
        };
        const actual = serviceReducer(previousState, action);

        expect(actual.loadCounter).toBe(0);
        expect(actual.previousLoadKey).toBe("");
      });

      it("should handle rejected state", () => {
        const action = {
          type: loadLeistungenAsync.rejected.type,
          error: { message: "Load failed" },
        };
        const actual = serviceReducer(initialState, action);

        expect(actual.savedLeistungenLoading).toBe(false);
        expect(actual.savedLeistungenError).toBe("Load failed");
      });

      it("should handle rejected state with undefined error", () => {
        const action = {
          type: loadLeistungenAsync.rejected.type,
          error: {},
        };
        const actual = serviceReducer(initialState, action);

        expect(actual.savedLeistungenLoading).toBe(false);
        expect(actual.savedLeistungenError).toBe("Failed to load Leistungen");
      });
    });
  });

  describe("State Transitions", () => {
    it("should handle complete service creation workflow", () => {
      let state = initialState;

      // Set service data
      state = serviceReducer(state, setSelectedServiceId(5));
      state = serviceReducer(state, setTime("2.5"));
      state = serviceReducer(state, setText("Legal consultation"));
      state = serviceReducer(state, setSb("45"));

      expect(state.selectedServiceId).toBe(5);
      expect(state.time).toBe("2.5");
      expect(state.text).toBe("Legal consultation");
      expect(state.sb).toBe("45");

      // Save pending
      state = serviceReducer(state, { type: saveLeistungAsync.pending.type });
      expect(state.saveLeistungLoading).toBe(true);

      // Save fulfilled
      state = serviceReducer(state, { type: saveLeistungAsync.fulfilled.type });
      expect(state.saveLeistungLoading).toBe(false);

      // Reset after save
      state = serviceReducer(state, resetServiceData());
      expect(state.selectedServiceId).toBe(0);
      expect(state.time).toBe("");
      expect(state.text).toBe("");
      expect(state.sb).toBe("");
    });

    it("should handle service loading workflow", () => {
      let state = initialState;

      // Load pending
      state = serviceReducer(state, { type: loadServicesAsync.pending.type });
      expect(state.servicesLoading).toBe(true);

      // Load fulfilled
      const services = [createMockService()];
      state = serviceReducer(state, {
        type: loadServicesAsync.fulfilled.type,
        payload: services,
      });
      expect(state.servicesLoading).toBe(false);
      expect(state.services).toEqual(services);

      // Select service
      state = serviceReducer(state, setSelectedServiceId(1));
      expect(state.selectedServiceId).toBe(1);

      // Clear services
      state = serviceReducer(state, clearServices());
      expect(state.services).toEqual([]);
      expect(state.selectedServiceId).toBe(0);
    });

    it("should handle error recovery", () => {
      let state = { ...initialState, saveLeistungError: "Save failed" };

      // New save should clear error
      state = serviceReducer(state, { type: saveLeistungAsync.pending.type });
      expect(state.saveLeistungError).toBeNull();

      // Error occurs
      state = serviceReducer(state, {
        type: saveLeistungAsync.rejected.type,
        error: { message: "Network error" },
      });
      expect(state.saveLeistungError).toBe("Network error");

      // Manual clear
      state = serviceReducer(state, clearSaveLeistungError());
      expect(state.saveLeistungError).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty services list", () => {
      const action = {
        type: loadServicesAsync.fulfilled.type,
        payload: [],
      };
      const actual = serviceReducer(initialState, action);

      expect(actual.services).toEqual([]);
      expect(actual.servicesLoading).toBe(false);
    });

    it("should handle multiple pending operations simultaneously", () => {
      let state = initialState;

      // Start loading services
      state = serviceReducer(state, { type: loadServicesAsync.pending.type });

      // Start saving
      state = serviceReducer(state, { type: saveLeistungAsync.pending.type });

      expect(state.servicesLoading).toBe(true);
      expect(state.saveLeistungLoading).toBe(true);
    });

    it("should handle very large service lists", () => {
      const largeServiceList = Array.from({ length: 500 }, (_, i) =>
        createMockService({ id: i + 1, kürzel: `SRV${String(i + 1).padStart(3, "0")}` })
      );

      const action = {
        type: loadServicesAsync.fulfilled.type,
        payload: largeServiceList,
      };
      const actual = serviceReducer(initialState, action);

      expect(actual.services).toHaveLength(500);
      expect(actual.services[0].kürzel).toBe("SRV001");
      expect(actual.services[499].kürzel).toBe("SRV500");
    });

    it("should handle rapid field updates", () => {
      let state = initialState;

      // Rapid updates
      state = serviceReducer(state, setTime("1"));
      state = serviceReducer(state, setTime("2"));
      state = serviceReducer(state, setTime("3"));
      state = serviceReducer(state, setTime("4"));

      expect(state.time).toBe("4");
    });
  });

  describe("Immutability", () => {
    it("should not mutate original state when setting service ID", () => {
      const originalState = { ...initialState };
      const stateCopy = { ...initialState };

      serviceReducer(stateCopy, setSelectedServiceId(5));

      expect(initialState).toEqual(originalState);
    });

    it("should not mutate original state when clearing services", () => {
      const originalState = {
        ...initialState,
        services: [createMockService()],
      };
      const originalServices = originalState.services;

      const newState = serviceReducer(originalState, clearServices());

      expect(newState.services).not.toBe(originalServices);
      expect(originalServices).toHaveLength(1); // Original unchanged
    });

    it("should return new object references for modified properties", () => {
      const originalState = { ...initialState };
      const newState = serviceReducer(originalState, setTime("2.5"));

      expect(newState).not.toBe(originalState);
      expect(newState.time).not.toBe(originalState.time);
    });

    it("should not mutate services array when updating", () => {
      const originalServices = [createMockService()];
      const previousState = { ...initialState, services: originalServices };

      const newServices = [createMockService({ id: 2 })];
      const newState = serviceReducer(previousState, {
        type: loadServicesAsync.fulfilled.type,
        payload: newServices,
      });

      expect(newState.services).not.toBe(originalServices);
      expect(originalServices).toHaveLength(1);
      expect(originalServices[0].id).toBe(1);
    });

    it("should not mutate when using setServiceData", () => {
      const originalState = { ...initialState };
      const newState = serviceReducer(
        originalState,
        setServiceData({
          selectedServiceId: 5,
          time: "2.0",
          text: "Test",
          sb: "30",
        })
      );

      expect(newState).not.toBe(originalState);
      expect(originalState.selectedServiceId).toBe(0);
      expect(originalState.time).toBe("");
    });
  });

  describe("Error Clearing Behavior", () => {
    it("should clear services error when starting new load", () => {
      const previousState = { ...initialState, servicesError: "Previous error" };
      const action = { type: loadServicesAsync.pending.type };
      const actual = serviceReducer(previousState, action);

      expect(actual.servicesError).toBeNull();
    });

    it("should clear save error when starting new save", () => {
      const previousState = { ...initialState, saveLeistungError: "Previous error" };
      const action = { type: saveLeistungAsync.pending.type };
      const actual = serviceReducer(previousState, action);

      expect(actual.saveLeistungError).toBeNull();
    });

    it("should handle manual error clearing", () => {
      const previousState = { ...initialState, saveLeistungError: "Some error" };
      const actual = serviceReducer(previousState, clearSaveLeistungError());

      expect(actual.saveLeistungError).toBeNull();
    });

    it("should clear error on successful load", () => {
      const previousState = { ...initialState, servicesError: "Load error" };
      const action = {
        type: loadServicesAsync.fulfilled.type,
        payload: [createMockService()],
      };
      const actual = serviceReducer(previousState, action);

      expect(actual.servicesError).toBeNull();
    });
  });

  describe("WebRTC Service Error Handling", () => {
    describe("loadServicesAsync", () => {
      it("should handle network timeouts", async () => {
        mockWebRTCService.loadServices.mockRejectedValue(new Error("Network timeout"));

        const dispatch = jest.fn();
        const getState = jest.fn(() => ({
          service: initialState,
          auth: { credentials: { username: "testuser" }, isAuthenticated: true },
          connection: { sipClientState: "CONNECTED" },
        }));

        const result = await loadServicesAsync({ OnlyQuickListe: true })(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/loadServices/rejected");
        if (loadServicesAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Network timeout");
        }
      });

      it("should handle connection refused errors", async () => {
        mockWebRTCService.loadServices.mockRejectedValue(new Error("Connection refused"));

        const dispatch = jest.fn();
        const getState = jest.fn(() => ({
          service: initialState,
          auth: { credentials: { username: "testuser" }, isAuthenticated: true },
          connection: { sipClientState: "CONNECTED" },
        }));

        const result = await loadServicesAsync({ OnlyQuickListe: true, Count: 50 })(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/loadServices/rejected");
        if (loadServicesAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Connection refused");
        }
      });

      it("should handle non-200 status code (400 Bad Request)", async () => {
        mockWebRTCService.loadServices.mockResolvedValue({
          statusCode: 400,
          body: "Invalid query parameters",
        });

        const dispatch = jest.fn();
        const getState = jest.fn(() => ({
          service: initialState,
          auth: { credentials: { username: "testuser" }, isAuthenticated: true },
          connection: { sipClientState: "CONNECTED" },
        }));

        const result = await loadServicesAsync({ OnlyQuickListe: true })(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/loadServices/rejected");
        if (loadServicesAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Failed to load services");
        }
      });

      it("should handle non-200 status code (500 Internal Server Error)", async () => {
        mockWebRTCService.loadServices.mockResolvedValue({
          statusCode: 500,
          body: "Database error",
        });

        const dispatch = jest.fn();
        const getState = jest.fn(() => ({
          service: initialState,
          auth: { credentials: { username: "testuser" }, isAuthenticated: true },
          connection: { sipClientState: "CONNECTED" },
        }));

        const result = await loadServicesAsync({ OnlyQuickListe: false })(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/loadServices/rejected");
        if (loadServicesAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Failed to load services");
        }
      });

      it("should handle response with null body", async () => {
        mockWebRTCService.loadServices.mockResolvedValue({
          statusCode: 200,
          body: null,
        });

        const dispatch = jest.fn();
        const getState = jest.fn(() => ({
          service: initialState,
          auth: { credentials: { username: "testuser" }, isAuthenticated: true },
          connection: { sipClientState: "CONNECTED" },
        }));

        const result = await loadServicesAsync({ OnlyQuickListe: true })(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/loadServices/fulfilled");
        if (loadServicesAsync.fulfilled.match(result)) {
          expect(result.payload).toEqual([]);
        }
      });

      it("should handle 401 Unauthorized", async () => {
        mockWebRTCService.loadServices.mockResolvedValue({
          statusCode: 401,
          body: "Unauthorized",
        });

        const dispatch = jest.fn();
        const getState = jest.fn(() => ({
          service: initialState,
          auth: { credentials: { username: "testuser" }, isAuthenticated: true },
          connection: { sipClientState: "CONNECTED" },
        }));

        const result = await loadServicesAsync({ OnlyQuickListe: true })(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/loadServices/rejected");
      });
    });

    describe("saveLeistungAsync", () => {
      it("should handle network timeouts", async () => {
        mockWebRTCService.saveLeistung.mockRejectedValue(new Error("Network timeout"));

        const dispatch = jest.fn();
        const getState = jest.fn();

        const result = await saveLeistungAsync(createMockLeistungPostData())(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/saveLeistung/rejected");
        if (saveLeistungAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Network timeout");
        }
      });

      it("should handle connection refused errors", async () => {
        mockWebRTCService.saveLeistung.mockRejectedValue(new Error("Connection refused"));

        const dispatch = jest.fn();
        const getState = jest.fn();

        const result = await saveLeistungAsync(createMockLeistungPostData())(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/saveLeistung/rejected");
        if (saveLeistungAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Connection refused");
        }
      });

      it("should handle non-200 status code (400 Bad Request)", async () => {
        mockWebRTCService.saveLeistung.mockResolvedValue({
          statusCode: 400,
          body: "Invalid service data",
        });

        const dispatch = jest.fn();
        const getState = jest.fn();

        const result = await saveLeistungAsync(createMockLeistungPostData())(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/saveLeistung/rejected");
        if (saveLeistungAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Invalid service data");
        }
      });

      it("should handle non-200 status code (500 Internal Server Error)", async () => {
        mockWebRTCService.saveLeistung.mockResolvedValue({
          statusCode: 500,
          body: "Server error",
        });

        const dispatch = jest.fn();
        const getState = jest.fn();

        const result = await saveLeistungAsync(createMockLeistungPostData())(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/saveLeistung/rejected");
        if (saveLeistungAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Server error");
        }
      });

      it("should handle 422 Unprocessable Entity", async () => {
        mockWebRTCService.saveLeistung.mockResolvedValue({
          statusCode: 422,
          body: "Validation failed: aktId is required",
        });

        const dispatch = jest.fn();
        const getState = jest.fn();

        const result = await saveLeistungAsync(createMockLeistungPostData())(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/saveLeistung/rejected");
        if (saveLeistungAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Validation failed: aktId is required");
        }
      });

      it("should handle response with null body and non-200 status", async () => {
        mockWebRTCService.saveLeistung.mockResolvedValue({
          statusCode: 400,
          body: null,
        });

        const dispatch = jest.fn();
        const getState = jest.fn();

        const result = await saveLeistungAsync(createMockLeistungPostData())(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/saveLeistung/rejected");
        if (saveLeistungAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Failed to save service");
        }
      });

      it("should successfully save with 200 status", async () => {
        mockWebRTCService.saveLeistung.mockResolvedValue({
          statusCode: 200,
          body: "Success",
        });

        const dispatch = jest.fn();
        const getState = jest.fn();

        const result = await saveLeistungAsync(createMockLeistungPostData())(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/saveLeistung/fulfilled");
        if (saveLeistungAsync.fulfilled.match(result)) {
          expect(result.payload.statusCode).toBe(200);
        }
      });

      it("should successfully save with 201 Created status", async () => {
        mockWebRTCService.saveLeistung.mockResolvedValue({
          statusCode: 201,
          body: "Created",
        });

        const dispatch = jest.fn();
        const getState = jest.fn();

        const result = await saveLeistungAsync(createMockLeistungPostData())(
          dispatch,
          getState,
          undefined
        );

        expect(result.type).toBe("service/saveLeistung/fulfilled");
        if (saveLeistungAsync.fulfilled.match(result)) {
          expect(result.payload.statusCode).toBe(201);
        }
      });
    });

    describe("loadLeistungenAsync", () => {
      it("should reject when connection is not ready (offline)", async () => {
        const dispatch = jest.fn();
        const getState = jest.fn(() =>
          readyGetState({ connection: { sipClientState: "DISCONNECTED" } })
        );

        const result = await loadLeistungenAsync({ aktId: 123 })(dispatch, getState, undefined);

        expect(result.type).toBe("service/loadLeistungen/rejected");
        if (loadLeistungenAsync.rejected.match(result)) {
          expect(result.error.message).toContain("Cannot load Leistungen");
        }
        expect(mockWebRTCService.getLeistungenByAkt).not.toHaveBeenCalled();
      });

      it("should reject when not authenticated", async () => {
        const dispatch = jest.fn();
        const getState = jest.fn(() =>
          readyGetState({ auth: { credentials: { username: "testuser" }, isAuthenticated: false } })
        );

        const result = await loadLeistungenAsync({ aktId: 123 })(dispatch, getState, undefined);

        expect(result.type).toBe("service/loadLeistungen/rejected");
        expect(mockWebRTCService.getLeistungenByAkt).not.toHaveBeenCalled();
      });

      it("should reject when aktId is missing", async () => {
        const dispatch = jest.fn();
        const getState = jest.fn(() => readyGetState());

        const result = await loadLeistungenAsync({})(dispatch, getState, undefined);

        expect(result.type).toBe("service/loadLeistungen/rejected");
        if (loadLeistungenAsync.rejected.match(result)) {
          expect(result.error.message).toBe("AktId is required for loading Leistungen");
        }
        expect(mockWebRTCService.getLeistungenByAkt).not.toHaveBeenCalled();
      });

      it("should reject when user is not authenticated with a username", async () => {
        const dispatch = jest.fn();
        const getState = jest.fn(() =>
          readyGetState({ auth: { credentials: { username: null }, isAuthenticated: true } })
        );

        const result = await loadLeistungenAsync({ aktId: 123 })(dispatch, getState, undefined);

        expect(result.type).toBe("service/loadLeistungen/rejected");
        if (loadLeistungenAsync.rejected.match(result)) {
          expect(result.error.message).toBe("User not authenticated");
        }
        expect(mockWebRTCService.getLeistungenByAkt).not.toHaveBeenCalled();
      });

      it("should fetch from the API on a cache miss and cache the result", async () => {
        const payload = [createMockLeistung({ id: 1 })];
        mockWebRTCService.getLeistungenByAkt.mockResolvedValue({
          statusCode: 200,
          body: JSON.stringify(payload),
        });

        const dispatch = jest.fn();
        const getState = jest.fn(() => readyGetState());

        const result = await loadLeistungenAsync({ aktId: 123 })(dispatch, getState, undefined);

        expect(mockWebRTCService.getLeistungenByAkt).toHaveBeenCalledWith({ aktId: 123 });
        expect(result.type).toBe("service/loadLeistungen/fulfilled");
        if (loadLeistungenAsync.fulfilled.match(result)) {
          expect(result.payload).toEqual(payload);
        }
        expect(mockCacheSet).toHaveBeenCalledWith(
          "registered_services_123",
          payload,
          expect.objectContaining({ namespace: "testuser" })
        );
      });

      it("should skip caching an empty result", async () => {
        mockWebRTCService.getLeistungenByAkt.mockResolvedValue({ statusCode: 200, body: "[]" });

        const dispatch = jest.fn();
        const getState = jest.fn(() => readyGetState());

        const result = await loadLeistungenAsync({ aktId: 123 })(dispatch, getState, undefined);

        expect(result.type).toBe("service/loadLeistungen/fulfilled");
        expect(mockCacheSet).not.toHaveBeenCalled();
      });

      it("should return cached data without calling the API when not force-refreshing", async () => {
        const cached = [createMockLeistung({ id: 9 })];
        mockCacheGet.mockResolvedValue(cached);

        const dispatch = jest.fn();
        const getState = jest.fn(() =>
          readyGetState({ service: { loadCounter: 0, previousLoadKey: null } })
        );

        const result = await loadLeistungenAsync({ aktId: 123 })(dispatch, getState, undefined);

        expect(result.type).toBe("service/loadLeistungen/fulfilled");
        if (loadLeistungenAsync.fulfilled.match(result)) {
          expect(result.payload).toEqual(cached);
        }
        expect(mockWebRTCService.getLeistungenByAkt).not.toHaveBeenCalled();
      });

      it("should bypass the cache and hit the API when loadCounter is odd for the same aktId (force refresh)", async () => {
        mockCacheGet.mockResolvedValue([createMockLeistung({ id: 9 })]);
        const fresh = [createMockLeistung({ id: 42 })];
        mockWebRTCService.getLeistungenByAkt.mockResolvedValue({
          statusCode: 200,
          body: JSON.stringify(fresh),
        });

        const dispatch = jest.fn();
        const getState = jest.fn(() =>
          readyGetState({ service: { loadCounter: 1, previousLoadKey: "123" } })
        );

        const result = await loadLeistungenAsync({ aktId: 123 })(dispatch, getState, undefined);

        expect(mockWebRTCService.getLeistungenByAkt).toHaveBeenCalled();
        expect(result.type).toBe("service/loadLeistungen/fulfilled");
        if (loadLeistungenAsync.fulfilled.match(result)) {
          expect(result.payload).toEqual(fresh);
        }
      });

      it("should reject when the API returns a non-200 status", async () => {
        mockWebRTCService.getLeistungenByAkt.mockResolvedValue({
          statusCode: 500,
          body: "Server error",
        });

        const dispatch = jest.fn();
        const getState = jest.fn(() => readyGetState());

        const result = await loadLeistungenAsync({ aktId: 123 })(dispatch, getState, undefined);

        expect(result.type).toBe("service/loadLeistungen/rejected");
        if (loadLeistungenAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Failed to load Leistungen");
        }
      });

      it("should fall back to stale cache when the API call throws", async () => {
        const stale = [createMockLeistung({ id: 7 })];
        // First cache read (pre-fetch) misses, second read (stale fallback) hits
        mockCacheGet.mockResolvedValueOnce(null).mockResolvedValueOnce(stale);
        mockWebRTCService.getLeistungenByAkt.mockRejectedValue(new Error("Network timeout"));

        const dispatch = jest.fn();
        const getState = jest.fn(() => readyGetState());

        const result = await loadLeistungenAsync({ aktId: 123 })(dispatch, getState, undefined);

        expect(result.type).toBe("service/loadLeistungen/fulfilled");
        if (loadLeistungenAsync.fulfilled.match(result)) {
          expect(result.payload).toEqual(stale);
        }
      });

      it("should reject when the API call throws and there is no stale cache", async () => {
        mockCacheGet.mockResolvedValue(null);
        mockWebRTCService.getLeistungenByAkt.mockRejectedValue(new Error("Network timeout"));

        const dispatch = jest.fn();
        const getState = jest.fn(() => readyGetState());

        const result = await loadLeistungenAsync({ aktId: 123 })(dispatch, getState, undefined);

        expect(result.type).toBe("service/loadLeistungen/rejected");
        if (loadLeistungenAsync.rejected.match(result)) {
          expect(result.error.message).toBe("Network timeout");
        }
      });
    });
  });
});
