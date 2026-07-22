/* eslint-disable no-undef */
/**
 * Integration Test — Pairing Flow
 *
 * Units under test (REAL, not mocked):
 *   PairingApiService  → pair() / checkServerId() use fetch + dispatch to real store
 *   pairingSlice       → real reducer: setPairingChecking, setPaired, setUnpaired, setPairingError
 *   Redux store        → real configureStore with pairingReducer
 *
 * External boundaries mocked:
 *   fetch              → intercepted via jest.spyOn(global, 'fetch')
 *   @infra/logger
 *   @config            → isDevelopment() returns false (use prod URL)
 *   @services/webRTCApiService (unused by pair/checkServerId, but imported by PairingApiService module)
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

// ─── Config mock ─────────────────────────────────────────────────────────────
jest.mock("@config", () => ({
  isDevelopment: jest.fn(() => false),
  configService: { getConfig: jest.fn(() => ({})) },
}));

// ─── webRTCApiService mock (not used by pair/checkServerId but imported) ─────
jest.mock("@services/webRTCApiService", () => ({
  webRTCApiService: {
    initialize: jest.fn(),
    cleanup:    jest.fn(),
    sendAuthMessage: jest.fn(),
  },
}));

// ─── Store mock — dynamic getter ──────────────────────────────────────────────
let _store: ReturnType<typeof buildStore>;
jest.mock("@store", () => ({
  get store() { return _store; },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────
import { configureStore } from "@reduxjs/toolkit";
import pairingReducer, {
  selectPairingStatus,
  selectAdvokatServerId,
} from "@slices/pairingSlice";
import { PairingApiService } from "@services/PairingApiService";

// ─── Real store factory ───────────────────────────────────────────────────────
function buildStore() {
  return configureStore({
    reducer: { pairing: pairingReducer },
    middleware: (gd) => gd({ serializableCheck: false }),
  });
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────
/** Create a minimal Response-like object without requiring global Response. */
function fakeResponse(body: unknown, status: number) {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok:     status >= 200 && status < 300,
    status,
    text:   async () => bodyStr,
    json:   async () => (typeof body === "string" ? JSON.parse(body) : body),
  };
}

function mockFetchOk(body: unknown, status = 200) {
  (global as any).fetch = jest.fn().mockResolvedValueOnce(fakeResponse(body, status));
}

function mockFetchError(status: number, text = "error") {
  (global as any).fetch = jest.fn().mockResolvedValueOnce(fakeResponse(text, status));
}

function mockFetchNetworkError(message = "Network Error") {
  (global as any).fetch = jest.fn().mockRejectedValueOnce(new TypeError(message));
}

const OFFICE_TOKEN    = "mock-office-jwt";
const SERVER_ID       = "advokat-server-001";
const KUERZEL         = "JCH";
const PAIRING_PAYLOAD = { advokatServerId: SERVER_ID, kuerzel: KUERZEL };

// ─────────────────────────────────────────────────────────────────────────────

describe("Integration — Pairing Flow", () => {
  let service: PairingApiService;

  beforeEach(() => {
    jest.clearAllMocks();
    _store = buildStore();
    service = new PairingApiService();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // pair()
  // ──────────────────────────────────────────────────────────────────────────

  describe("pair()", () => {
    it("dispatches setPairingChecking before the API call", async () => {
      mockFetchOk(PAIRING_PAYLOAD);
      const pairPromise = service.pair("OTP123", OFFICE_TOKEN);
      // Checking state before the await resolves
      expect(selectPairingStatus(_store.getState() as any)).toBe("checking");
      await pairPromise;
    });

    it("transitions store to 'paired' with correct advokatServerId on success", async () => {
      mockFetchOk(PAIRING_PAYLOAD);
      await service.pair("OTP123", OFFICE_TOKEN);
      expect(selectPairingStatus(_store.getState() as any)).toBe("paired");
      expect(selectAdvokatServerId(_store.getState() as any)).toBe(SERVER_ID);
    });

    it("returns the pairing server info on success", async () => {
      mockFetchOk(PAIRING_PAYLOAD);
      const result = await service.pair("OTP123", OFFICE_TOKEN);
      expect(result.advokatServerId).toBe(SERVER_ID);
      expect(result.kuerzel).toBe(KUERZEL);
    });

    it("sends Authorization header with the Office token", async () => {
      mockFetchOk(PAIRING_PAYLOAD);
      await service.pair("OTP123", OFFICE_TOKEN);
      const fetchCall = ((global as any).fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1]?.headers?.Authorization).toBe(`Bearer ${OFFICE_TOKEN}`);
    });

    it("sends the OTP in the request body", async () => {
      mockFetchOk(PAIRING_PAYLOAD);
      await service.pair("MYOTP", OFFICE_TOKEN);
      const fetchCall = ((global as any).fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse(fetchCall[1]?.body)).toMatchObject({ otp: "MYOTP" });
    });

    it("transitions store to 'error' and throws on HTTP 400", async () => {
      mockFetchError(400, "Invalid OTP");
      await expect(service.pair("WRONG", OFFICE_TOKEN)).rejects.toThrow(/HTTP 400/);
      expect(selectPairingStatus(_store.getState() as any)).toBe("error");
    });

    it("transitions store to 'error' and throws on network failure", async () => {
      mockFetchNetworkError("Failed to fetch");
      await expect(service.pair("OTP", OFFICE_TOKEN)).rejects.toThrow("Failed to fetch");
      expect(selectPairingStatus(_store.getState() as any)).toBe("error");
    });

    it("transitions store to 'error' when advokatServerId is missing from response", async () => {
      mockFetchOk({ kuerzel: KUERZEL }); // missing advokatServerId
      await expect(service.pair("OTP", OFFICE_TOKEN)).rejects.toThrow(/advokatServerId/);
      expect(selectPairingStatus(_store.getState() as any)).toBe("error");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // checkServerId()
  // ──────────────────────────────────────────────────────────────────────────

  describe("checkServerId()", () => {
    it("dispatches setPairingChecking before the API call", async () => {
      mockFetchOk(PAIRING_PAYLOAD);
      const checkPromise = service.checkServerId(OFFICE_TOKEN);
      expect(selectPairingStatus(_store.getState() as any)).toBe("checking");
      await checkPromise;
    });

    it("transitions store to 'paired' and returns server info when already paired", async () => {
      mockFetchOk(PAIRING_PAYLOAD);
      const result = await service.checkServerId(OFFICE_TOKEN);
      expect(selectPairingStatus(_store.getState() as any)).toBe("paired");
      expect(result?.advokatServerId).toBe(SERVER_ID);
    });

    it("transitions store to 'unpaired' and returns null on 404 (first-time user)", async () => {
      mockFetchError(404, "Not found");
      const result = await service.checkServerId(OFFICE_TOKEN);
      expect(result).toBeNull();
      expect(selectPairingStatus(_store.getState() as any)).toBe("unpaired");
    });

    it("transitions store to 'error' and throws on HTTP 500", async () => {
      mockFetchError(500, "Internal Server Error");
      await expect(service.checkServerId(OFFICE_TOKEN)).rejects.toThrow(/500/);
      expect(selectPairingStatus(_store.getState() as any)).toBe("error");
    });

    it("transitions store to 'error' and throws on network failure", async () => {
      mockFetchNetworkError("DNS failure");
      await expect(service.checkServerId(OFFICE_TOKEN)).rejects.toThrow("DNS failure");
      expect(selectPairingStatus(_store.getState() as any)).toBe("error");
    });
  });
});
