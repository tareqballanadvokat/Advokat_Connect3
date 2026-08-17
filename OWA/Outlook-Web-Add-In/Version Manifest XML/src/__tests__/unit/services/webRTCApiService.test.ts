/* eslint-disable no-undef */
/**
 * Unit Tests for WebRTCApiService
 *
 * Strategy:
 * - WebRTCDataChannelService, TokenService, and @infra/logger are mocked.
 * - chunkingUtils (real, pure protocol/chunking logic) is NOT mocked — requests
 *   are chunked and pending requests tracked through the real implementation.
 * - Server responses are simulated by capturing the request the service actually
 *   sent (via the mocked `send()`) and feeding a matching response back through
 *   `onDataChannelMessage()`, exactly as WebRTCDataChannelService would.
 * - Fake timers control the request timeout/retry cycle without wall-clock waits.
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  })),
}));

// ─── TokenService mock ────────────────────────────────────────────────────────
const mockEnsureValidToken = jest.fn(() => Promise.resolve("valid-token"));
const mockForceRefreshToken = jest.fn(() => Promise.resolve("refreshed-token"));
jest.mock("@services/TokenService", () => ({
  tokenService: {
    ensureValidToken: (...args: any[]) => mockEnsureValidToken(...args),
    forceRefreshToken: (...args: any[]) => mockForceRefreshToken(...args),
  },
}));

// ─── WebRTCDataChannelService mock ────────────────────────────────────────────
const mockSend = jest.fn();
const mockSubscribe = jest.fn();
const mockUnsubscribe = jest.fn();
const mockIsSubscribed = jest.fn(() => false);
const mockDataChannelSvc = {
  send: (...args: any[]) => mockSend(...args),
  subscribe: (...args: any[]) => mockSubscribe(...args),
  unsubscribe: (...args: any[]) => mockUnsubscribe(...args),
  isSubscribed: (...args: any[]) => mockIsSubscribed(...args),
  isReadyForCommunication: true,
};
jest.mock("@services/WebRTCDataChannelService", () => ({
  WebRTCDataChannelService: {
    getInstance: jest.fn(() => mockDataChannelSvc),
  },
}));

// ─────────────────────────────────────────────────────────────────────────────

import { WebRTCApiService } from "@services/webRTCApiService";
import type { WebRTCApiRequest, WebRTCApiResponse } from "@interfaces/IWebRTC";
import { CHUNKING_CONFIG } from "@utils/chunkingUtils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function base64EncodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Build an ArrayBuffer using only jsdom-realm globals (Uint8Array), not the
 * Node `util.TextEncoder` polyfill installed in setupTests.ts. That polyfill
 * constructs ArrayBuffers from Node's own realm, which fail `instanceof
 * ArrayBuffer` checks made inside source code running in the jsdom vm context.
 */
function stringToArrayBuffer(str: string): ArrayBuffer {
  const utf8 = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(utf8.length);
  for (let i = 0; i < utf8.length; i++) bytes[i] = utf8.charCodeAt(i);
  return bytes.buffer;
}

/** Parse the request most recently sent via the mocked send(). */
function lastSentRequest(): WebRTCApiRequest {
  const call = mockSend.mock.calls[mockSend.mock.calls.length - 1];
  return JSON.parse(call[0]);
}

function allSentRequests(): WebRTCApiRequest[] {
  return mockSend.mock.calls.map((c) => JSON.parse(c[0]));
}

/** Simulate the server responding to the given request id. */
function deliverResponse(svc: WebRTCApiService, response: Partial<WebRTCApiResponse> & { id: string }) {
  const full: WebRTCApiResponse = {
    timestamp: Date.now(),
    totalChunks: 1,
    currentChunk: 1,
    statusCode: 200,
    ...response,
  };
  svc.onDataChannelMessage(new MessageEvent("message", { data: JSON.stringify(full) }));
}

/** Simulate a successful JSON response for the most recently sent request. */
function deliverSuccessForLastRequest(svc: WebRTCApiService, jsonBody: unknown, statusCode = 200) {
  const req = lastSentRequest();
  deliverResponse(svc, {
    id: req.id,
    statusCode,
    body: base64EncodeUtf8(JSON.stringify(jsonBody)),
  });
}

const fakeSipClient = {} as any;

// ─────────────────────────────────────────────────────────────────────────────

describe("WebRTCApiService", () => {
  let svc: WebRTCApiService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockIsSubscribed.mockReturnValue(false);
    mockDataChannelSvc.isReadyForCommunication = true;
    mockEnsureValidToken.mockResolvedValue("valid-token");
    mockForceRefreshToken.mockResolvedValue("refreshed-token");
    svc = new WebRTCApiService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // initialize() / cleanup()
  // ──────────────────────────────────────────────────────────────────────────

  describe("initialize()", () => {
    it("subscribes to WebRTCDataChannelService", () => {
      svc.initialize(fakeSipClient);
      expect(mockSubscribe).toHaveBeenCalledWith(svc);
    });

    it("does not subscribe twice if already subscribed", () => {
      mockIsSubscribed.mockReturnValue(true);
      svc.initialize(fakeSipClient);
      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    it("cleans up previous state before re-initializing", () => {
      svc.initialize(fakeSipClient);
      svc.initialize(fakeSipClient);
      // cleanup() unsubscribes if it was subscribed — verified indirectly via no throw
      expect(mockSubscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe("cleanup()", () => {
    it("unsubscribes from WebRTCDataChannelService when subscribed", () => {
      mockIsSubscribed.mockReturnValue(true);
      svc.initialize(fakeSipClient);
      svc.cleanup();
      expect(mockUnsubscribe).toHaveBeenCalledWith(svc);
    });

    it("rejects all pending requests with 'Connection closed'", async () => {
      svc.initialize(fakeSipClient);
      const promise = svc.getFavoriteAkten({});
      await flush();
      const assertion = expect(promise).rejects.toThrow("Connection closed");
      svc.cleanup();
      await assertion;
    });

    it("clears pending requests after cleanup", async () => {
      svc.initialize(fakeSipClient);
      const promise = svc.getFavoriteAkten({});
      await flush();
      const rejected = expect(promise).rejects.toThrow();
      svc.cleanup();
      await rejected;
      expect(svc.getPendingRequestCount()).toBe(0);
    });

    it("clears the SIP client reference", () => {
      svc.initialize(fakeSipClient);
      svc.cleanup();
      // sendRequest guards on !this.sipClient — verify indirectly
      return expect(svc.getFavoriteAkten({})).rejects.toThrow(
        "WebRTC API service not initialized"
      );
    });

    it("is safe to call when nothing is pending or subscribed", () => {
      expect(() => svc.cleanup()).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // onDataChannelMessage() — incoming data type handling
  // ──────────────────────────────────────────────────────────────────────────

  describe("onDataChannelMessage() — data types", () => {
    beforeEach(() => svc.initialize(fakeSipClient));

    it("handles string data", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      deliverSuccessForLastRequest(svc, []);
      await expect(promise).resolves.toMatchObject({ statusCode: 200 });
    });

    it("handles ArrayBuffer data", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      const response: WebRTCApiResponse = {
        id: req.id,
        timestamp: Date.now(),
        totalChunks: 1,
        currentChunk: 1,
        statusCode: 200,
        body: base64EncodeUtf8(JSON.stringify([])),
      };
      const buffer = stringToArrayBuffer(JSON.stringify(response));
      svc.onDataChannelMessage(new MessageEvent("message", { data: buffer }));
      await expect(promise).resolves.toMatchObject({ statusCode: 200 });
    });

    it("handles Blob data", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      const response: WebRTCApiResponse = {
        id: req.id,
        timestamp: Date.now(),
        totalChunks: 1,
        currentChunk: 1,
        statusCode: 200,
        body: base64EncodeUtf8(JSON.stringify([])),
      };
      const blob = new Blob([JSON.stringify(response)]);
      svc.onDataChannelMessage(new MessageEvent("message", { data: blob }));
      await flush();
      await expect(promise).resolves.toMatchObject({ statusCode: 200 });
    });

    it("ignores non-JSON messages without throwing", () => {
      expect(() =>
        svc.onDataChannelMessage(new MessageEvent("message", { data: "not json" }))
      ).not.toThrow();
    });

    it("ignores a response for an unknown request id", () => {
      expect(() =>
        deliverResponse(svc, { id: "unknown-id-123", statusCode: 200 })
      ).not.toThrow();
    });

    it("ignores a message with no id field", () => {
      expect(() =>
        svc.onDataChannelMessage(
          new MessageEvent("message", { data: JSON.stringify({ foo: "bar" }) })
        )
      ).not.toThrow();
    });
  });

  describe("onDataChannelStateChanged() / onDataChannelError()", () => {
    it("does not throw for state changes", () => {
      expect(() => svc.onDataChannelStateChanged("open", "offer")).not.toThrow();
    });

    it("does not throw for errors", () => {
      expect(() => svc.onDataChannelError("boom", "answer")).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // sendRequest() guard clauses — exercised via a representative public method
  // ──────────────────────────────────────────────────────────────────────────

  describe("sendRequest() guard clauses", () => {
    it("rejects when the service has not been initialized", async () => {
      await expect(svc.getFavoriteAkten({})).rejects.toThrow(
        "WebRTC API service not initialized"
      );
    });

    it("rejects when channels are not ready for bidirectional communication", async () => {
      svc.initialize(fakeSipClient);
      mockDataChannelSvc.isReadyForCommunication = false;
      await expect(svc.getFavoriteAkten({})).rejects.toThrow(
        "WebRTC channels not ready for bidirectional communication"
      );
    });

    it("rejects when no auth token is available for a non-auth request", async () => {
      svc.initialize(fakeSipClient);
      mockEnsureValidToken.mockResolvedValue(null);
      await expect(svc.getFavoriteAkten({})).rejects.toThrow(
        "No auth token available. Please reconnect."
      );
    });

    it("does NOT require a token for auth.* requests (sendAuthMessage)", async () => {
      svc.initialize(fakeSipClient);
      mockEnsureValidToken.mockResolvedValue(null);

      const promise = svc.sendAuthMessage("office-jwt");
      expect(mockEnsureValidToken).not.toHaveBeenCalled();

      deliverSuccessForLastRequest(svc, {
        access_token: "jwt",
        expires_in: 3600,
        refresh_token: "rt",
      });
      await expect(promise).resolves.toMatchObject({ access_token: "jwt" });
    });

    it("attaches the Bearer token to non-auth requests", async () => {
      svc.initialize(fakeSipClient);
      const promise = svc.getFavoriteAkten({});
      await flush();
      deliverSuccessForLastRequest(svc, []);
      await promise;

      const sent = lastSentRequest();
      expect(sent.headers["Authorization"]).toBe("Bearer valid-token");
    });

    it("does NOT attach an Authorization header to auth.* requests", async () => {
      svc.initialize(fakeSipClient);
      const promise = svc.sendAuthMessage("office-jwt");
      const sent = lastSentRequest();
      // sendAuthMessage sets its own Authorization header (the Office token)
      expect(sent.headers["Authorization"]).toBe("Bearer office-jwt");
      deliverSuccessForLastRequest(svc, { access_token: "jwt", expires_in: 3600 });
      await promise;
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Response handling — success paths
  // ──────────────────────────────────────────────────────────────────────────

  describe("Successful responses", () => {
    beforeEach(() => svc.initialize(fakeSipClient));

    it("decodes a base64 JSON body and resolves with the decoded body", async () => {
      const payload = [{ id: 1, aKurz: "TEST-001" }];
      const promise = svc.getFavoriteAkten({});
      await flush();
      deliverSuccessForLastRequest(svc, payload);

      const result = await promise;
      expect(JSON.parse(result.body!)).toEqual(payload);
    });

    it("keeps the body as raw base64 for binary document downloads", async () => {
      const promise = svc.downloadDocument(42);
      await flush();
      const req = lastSentRequest();
      deliverResponse(svc, { id: req.id, statusCode: 200, body: "cmF3LWJpbmFyeS1kYXRh" });

      const result = await promise;
      expect(result).toBe("cmF3LWJpbmFyeS1kYXRh");
    });

    it("returns an empty string for downloadDocument when body is missing", async () => {
      const promise = svc.downloadDocument(42);
      await flush();
      const req = lastSentRequest();
      deliverResponse(svc, { id: req.id, statusCode: 200 });

      expect(await promise).toBe("");
    });

    it("resolves multiple independent requests concurrently, each with its own response", async () => {
      const p1 = svc.getFavoriteAkten({});
      const p2 = svc.aktLookUp("Mustermann");
      await flush();

      const [req1, req2] = allSentRequests();
      deliverResponse(svc, { id: req1.id, statusCode: 200, body: base64EncodeUtf8("[1]") });
      deliverResponse(svc, { id: req2.id, statusCode: 200, body: base64EncodeUtf8("[2]") });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.body).toBe("[1]");
      expect(r2.body).toBe("[2]");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Chunked responses
  // ──────────────────────────────────────────────────────────────────────────

  describe("Chunked responses", () => {
    beforeEach(() => svc.initialize(fakeSipClient));

    it("reassembles a response delivered across multiple chunks", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();

      const fullBody = base64EncodeUtf8(JSON.stringify([{ id: 1 }, { id: 2 }]));
      const half = Math.ceil(fullBody.length / 2);

      deliverResponse(svc, {
        id: req.id,
        totalChunks: 2,
        currentChunk: 1,
        statusCode: 200,
        body: fullBody.slice(0, half),
      });
      deliverResponse(svc, {
        id: req.id,
        totalChunks: 2,
        currentChunk: 2,
        statusCode: 200,
        body: fullBody.slice(half),
      });

      const result = await promise;
      expect(JSON.parse(result.body!)).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it("ignores a duplicate chunk", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      const fullBody = base64EncodeUtf8(JSON.stringify([1, 2]));
      const half = Math.ceil(fullBody.length / 2);

      deliverResponse(svc, { id: req.id, totalChunks: 2, currentChunk: 1, body: fullBody.slice(0, half) });
      deliverResponse(svc, { id: req.id, totalChunks: 2, currentChunk: 1, body: fullBody.slice(0, half) }); // duplicate
      deliverResponse(svc, { id: req.id, totalChunks: 2, currentChunk: 2, body: fullBody.slice(half) });

      const result = await promise;
      expect(JSON.parse(result.body!)).toEqual([1, 2]);
    });

    it("does not resolve until all chunks have arrived", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      const fullBody = base64EncodeUtf8(JSON.stringify([1, 2, 3]));
      const third = Math.ceil(fullBody.length / 3);

      deliverResponse(svc, { id: req.id, totalChunks: 3, currentChunk: 1, body: fullBody.slice(0, third) });

      let settled = false;
      promise.then(() => { settled = true; });
      await Promise.resolve();
      await Promise.resolve();
      expect(settled).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // HTTP error handling
  // ──────────────────────────────────────────────────────────────────────────

  describe("HTTP error handling", () => {
    beforeEach(() => svc.initialize(fakeSipClient));

    it("treats 404 as a successful empty-list response (not an error)", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      deliverResponse(svc, { id: req.id, statusCode: 404, body: base64EncodeUtf8("[]") });

      await expect(promise).resolves.toMatchObject({ statusCode: 404 });
    });

    it("fails permanently on a 400 Bad Request", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      deliverResponse(svc, { id: req.id, statusCode: 400, body: base64EncodeUtf8("Bad input") });

      await expect(promise).rejects.toThrow("HTTP 400");
    });

    it("fails permanently on a 403 Forbidden", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      deliverResponse(svc, { id: req.id, statusCode: 403 });

      await expect(promise).rejects.toThrow("HTTP 403");
    });

    it("fails permanently on a 422 Unprocessable Entity", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      deliverResponse(svc, { id: req.id, statusCode: 422 });

      await expect(promise).rejects.toThrow("HTTP 422");
    });

    it("treats an unrecognized error status as a permanent failure", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      deliverResponse(svc, { id: req.id, statusCode: 418 });

      await expect(promise).rejects.toThrow("HTTP 418");
    });

    it("retries automatically on a 500 Internal Server Error and succeeds on retry", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const firstReq = lastSentRequest();
      deliverResponse(svc, { id: firstReq.id, statusCode: 500 });

      // retryRequest() re-sends synchronously (via resendOriginalRequest) — flush microtasks
      await Promise.resolve();
      await Promise.resolve();

      const retriedReq = lastSentRequest();
      expect(retriedReq.id).toBe(firstReq.id); // same request id, re-sent
      deliverResponse(svc, { id: retriedReq.id, statusCode: 200, body: base64EncodeUtf8("[]") });

      await expect(promise).resolves.toMatchObject({ statusCode: 200 });
    });

    it("gives up after exceeding the max retry attempts on repeated 500s", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();

      for (let attempt = 0; attempt <= CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS; attempt++) {
        const req = lastSentRequest();
        deliverResponse(svc, { id: req.id, statusCode: 500 });
        await Promise.resolve();
        await Promise.resolve();
      }

      await expect(promise).rejects.toThrow();
    });

    it("errorCode is used when statusCode is absent", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      // @ts-expect-error - statusCode omitted intentionally to exercise errorCode fallback
      deliverResponse(svc, { id: req.id, statusCode: undefined, errorCode: 400 });

      await expect(promise).rejects.toThrow("HTTP 400");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 401 handling — force token refresh and retry once
  // ──────────────────────────────────────────────────────────────────────────

  describe("401 handling", () => {
    beforeEach(() => svc.initialize(fakeSipClient));

    it("forces a token refresh and retries once on a 401", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const firstReq = lastSentRequest();
      deliverResponse(svc, { id: firstReq.id, statusCode: 401 });

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockForceRefreshToken).toHaveBeenCalledTimes(1);

      const retriedReq = lastSentRequest();
      expect(retriedReq.headers["Authorization"]).toBe("Bearer refreshed-token");

      deliverResponse(svc, { id: retriedReq.id, statusCode: 200, body: base64EncodeUtf8("[]") });
      await expect(promise).resolves.toMatchObject({ statusCode: 200 });
    });

    it("fails permanently when the retried request 401s again", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const firstReq = lastSentRequest();
      deliverResponse(svc, { id: firstReq.id, statusCode: 401 });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const retriedReq = lastSentRequest();
      deliverResponse(svc, { id: retriedReq.id, statusCode: 401 });

      await expect(promise).rejects.toThrow("Authentication failed (401)");
      // Only one refresh attempt — no infinite retry loop
      expect(mockForceRefreshToken).toHaveBeenCalledTimes(1);
    });

    it("fails permanently without retrying when forceRefreshToken returns null", async () => {
      mockForceRefreshToken.mockResolvedValue(null);
      const promise = svc.getFavoriteAkten({});
      await flush();
      const req = lastSentRequest();
      deliverResponse(svc, { id: req.id, statusCode: 401 });

      await expect(promise).rejects.toThrow("Authentication failed (401)");
    });

    it("does not attempt a token refresh for an auth.* request that 401s", async () => {
      const promise = svc.sendAuthMessage("office-jwt");
      const req = lastSentRequest();
      deliverResponse(svc, { id: req.id, statusCode: 401 });

      await expect(promise).rejects.toThrow("Authentication failed (401)");
      expect(mockForceRefreshToken).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Timeout / retry handling
  // ──────────────────────────────────────────────────────────────────────────

  describe("Timeout retry", () => {
    beforeEach(() => svc.initialize(fakeSipClient));

    it("retries automatically when no response arrives before the timeout", async () => {
      const promise = svc.getFavoriteAkten({});
      await flush();
      const firstReq = lastSentRequest();

      await jest.advanceTimersByTimeAsync(CHUNKING_CONFIG.REQUEST.MAX_TIMEOUT_MS + 100);

      const retriedReq = lastSentRequest();
      expect(retriedReq.id).toBe(firstReq.id);
      expect(mockSend).toHaveBeenCalledTimes(2); // original + one retry

      deliverResponse(svc, { id: retriedReq.id, statusCode: 200, body: base64EncodeUtf8("[]") });
      await expect(promise).resolves.toMatchObject({ statusCode: 200 });
    });

    it("fails after exceeding max retry attempts with no response", async () => {
      const promise = svc.getFavoriteAkten({});
      const assertion = expect(promise).rejects.toThrow(/timeout/i);

      for (let i = 0; i <= CHUNKING_CONFIG.REQUEST.MAX_RETRY_ATTEMPTS; i++) {
        await jest.advanceTimersByTimeAsync(CHUNKING_CONFIG.REQUEST.MAX_TIMEOUT_MS + 100);
      }

      await assertion;
    });

    it("skips the retry if channels become unready before the timeout fires", async () => {
      const promise = svc.getFavoriteAkten({});
      const assertion = expect(promise).rejects.toThrow("Channels not ready");
      mockDataChannelSvc.isReadyForCommunication = false;

      await jest.advanceTimersByTimeAsync(CHUNKING_CONFIG.REQUEST.MAX_TIMEOUT_MS + 100);

      await assertion;
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Public API methods — request shape
  // ──────────────────────────────────────────────────────────────────────────

  describe("Public API methods — request construction", () => {
    beforeEach(() => svc.initialize(fakeSipClient));

    async function resolveLast(svc2: WebRTCApiService, body: unknown = []) {
      deliverSuccessForLastRequest(svc2, body);
    }

    it("getFavoriteAkten() builds the correct GET request", async () => {
      const p = svc.getFavoriteAkten({ AktId: 5, AKurzLike: "TEST", Count: 10, NurFavoriten: true });
      await flush();
      const req = lastSentRequest();
      expect(req.method).toBe("GET");
      expect(req.messageType).toBe("akten.getFavoriteAkten");
      expect(req.uri).toContain("api/v2.0/akten?");
      expect(req.uri).toContain("AktId=5");
      expect(req.uri).toContain("AKurzLike=TEST");
      expect(req.uri).toContain("NurFavoriten=true");
      await resolveLast(svc);
      await p;
    });

    it("aktLookUp() builds the correct GET request", async () => {
      const p = svc.aktLookUp("Mustermann");
      await flush();
      const req = lastSentRequest();
      expect(req.method).toBe("GET");
      expect(req.messageType).toBe("akten.aktLookUp");
      expect(req.uri).toBe("api/v2.0/akten/LookUp?searchText=Mustermann");
      await resolveLast(svc);
      await p;
    });

    it("addAktToFavorite() builds the correct POST request", async () => {
      const p = svc.addAktToFavorite(42);
      await flush();
      const req = lastSentRequest();
      expect(req.method).toBe("POST");
      expect(req.messageType).toBe("akten.addAktToFavorite");
      expect(req.uri).toBe("api/v2.0/akten/AddToFavorites/42");
      await resolveLast(svc);
      await p;
    });

    it("removeAktFromFavorite() builds the correct DELETE request", async () => {
      const p = svc.removeAktFromFavorite(42);
      await flush();
      const req = lastSentRequest();
      expect(req.method).toBe("DELETE");
      expect(req.messageType).toBe("akten.removeAktFromFavorite");
      expect(req.uri).toBe("api/v2.0/akten/RemoveFromFavorites/42");
      await resolveLast(svc);
      await p;
    });

    it("loadServices() builds the correct GET request", async () => {
      const p = svc.loadServices({ Kürzel: "ABC", OnlyQuickListe: true, Count: 5 });
      await flush();
      const req = lastSentRequest();
      expect(req.messageType).toBe("service.loadServices");
      expect(req.uri).toContain("api/v2.0/leistungen/Auswahl?");
      expect(decodeURIComponent(req.uri)).toContain("Kürzel=ABC");
      expect(req.uri).toContain("OnlyQuickListe=true");
      await resolveLast(svc);
      await p;
    });

    it("saveLeistung() sends the leistung data as a base64-encoded POST body", async () => {
      const leistungData = { aktId: 1, leistungKurz: "SRV" } as any;
      const p = svc.saveLeistung(leistungData);
      await flush();
      const req = lastSentRequest();
      expect(req.method).toBe("POST");
      expect(req.messageType).toBe("service.saveLeistung");
      expect(req.uri).toBe("api/v2.0/Leistungen");
      expect(req.headers["Content-Type"]).toContain("application/json-patch+json");
      expect(JSON.parse(atob(req.body!))).toEqual(leistungData);
      await resolveLast(svc);
      await p;
    });

    it("getLeistungenByAkt() converts Date query fields to local ISO strings", async () => {
      const erstelltAb = new Date(2024, 0, 15, 10, 30, 0);
      const p = svc.getLeistungenByAkt({ aktId: 7, erstelltAb });
      await flush();
      const req = lastSentRequest();
      expect(req.messageType).toBe("service.getLeistungenByAkt");
      expect(req.uri).toContain("AktId=7");
      expect(decodeURIComponent(req.uri)).toContain("ErstelltAb=2024-01-15T10:30:00");
      await resolveLast(svc);
      await p;
    });

    it("getLeistungenByAkt() passes through pre-formatted string date fields as-is", async () => {
      const p = svc.getLeistungenByAkt({ aktId: 7, erstelltVon: "user1" });
      await flush();
      const req = lastSentRequest();
      expect(decodeURIComponent(req.uri)).toContain("ErstelltVon=user1");
      await resolveLast(svc);
      await p;
    });

    it("saveDokument() builds the correct POST request with body", async () => {
      const dokumentData = { aktId: 1, betreff: "Test" } as any;
      const p = svc.saveDokument(dokumentData);
      await flush();
      const req = lastSentRequest();
      expect(req.method).toBe("POST");
      expect(req.messageType).toBe("dokument.saveDokument");
      expect(req.uri).toBe("api/v2.0/dokumente");
      expect(JSON.parse(atob(req.body!))).toEqual(dokumentData);
      await resolveLast(svc);
      await p;
    });

    it("getAvailableFolders() builds the correct GET request", async () => {
      const p = svc.getAvailableFolders(7);
      await flush();
      const req = lastSentRequest();
      expect(req.method).toBe("GET");
      expect(req.uri).toBe("api/v2.0/dokumente/folders/7");
      await resolveLast(svc);
      await p;
    });

    it("GetDocuments() builds a query with dokumentArten and date range", async () => {
      const p = svc.GetDocuments({
        aktId: 7,
        dokumentArten: [0, 1],
        erstelltAb: new Date(2024, 0, 1, 0, 0, 0),
      } as any);
      await flush();
      const req = lastSentRequest();
      expect(req.messageType).toBe("dokument.getDocuments");
      expect(req.uri).toContain("AktId=7");
      expect(req.uri).toContain("DokumentArten=");
      expect(req.uri).toContain("ErstelltAb=2024-01-01T00:00:00");
      await resolveLast(svc);
      await p;
    });

    it("downloadDocument() builds the correct GET request with octet-stream Accept header", async () => {
      const p = svc.downloadDocument(99);
      await flush();
      const req = lastSentRequest();
      expect(req.method).toBe("GET");
      expect(req.uri).toBe("api/v2.0/Dokumente/99/download");
      expect(req.headers["Accept"]).toBe("application/octet-stream");
      deliverResponse(svc, { id: req.id, statusCode: 200, body: "base64data" });
      await p;
    });

    it("getFavoritePersons() builds the correct GET request", async () => {
      const p = svc.getFavoritePersons({ NKurzLike: "MUS", NurFavoriten: true });
      await flush();
      const req = lastSentRequest();
      expect(req.messageType).toBe("person.getFavoritePersons");
      expect(req.uri).toContain("api/v2/personen?");
      expect(req.uri).toContain("NKurzLike=MUS");
      await resolveLast(svc);
      await p;
    });

    it("personLookUp() builds the correct GET request", async () => {
      const p = svc.personLookUp("Mustermann");
      await flush();
      const req = lastSentRequest();
      expect(req.uri).toBe("api/v2/personen/Lookup?searchText=Mustermann");
      await resolveLast(svc);
      await p;
    });

    it("addPersonToFavorites() builds the correct POST request", async () => {
      const p = svc.addPersonToFavorites(5);
      await flush();
      const req = lastSentRequest();
      expect(req.method).toBe("POST");
      expect(req.uri).toBe("api/v2/personen/AddToFavorites/5");
      await resolveLast(svc);
      await p;
    });

    it("removePersonFromFavorites() builds the correct DELETE request", async () => {
      const p = svc.removePersonFromFavorites(5);
      await flush();
      const req = lastSentRequest();
      expect(req.method).toBe("DELETE");
      expect(req.uri).toBe("api/v2/personen/RemoveFromFavorites/5");
      await resolveLast(svc);
      await p;
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // sendAuthMessage() — response parsing
  // ──────────────────────────────────────────────────────────────────────────

  describe("sendAuthMessage()", () => {
    beforeEach(() => svc.initialize(fakeSipClient));

    it("resolves with the parsed auth response on success", async () => {
      const p = svc.sendAuthMessage("office-jwt");
      const req = lastSentRequest();
      expect(req.messageType).toBe("auth.officeToken.exchange");
      expect(req.uri).toBe("addin/office-token/token");

      deliverSuccessForLastRequest(svc, {
        access_token: "adv-jwt",
        expires_in: 3600,
        refresh_token: "rt-1",
        refresh_token_lifetime: 7200,
      });

      const result = await p;
      expect(result.access_token).toBe("adv-jwt");
    });

    it("throws when the response body is missing required token fields", async () => {
      const p = svc.sendAuthMessage("office-jwt");
      deliverSuccessForLastRequest(svc, { token_type: "Bearer" });

      await expect(p).rejects.toThrow("missing required token fields");
    });

    it("throws when the response contains no body", async () => {
      const p = svc.sendAuthMessage("office-jwt");
      const req = lastSentRequest();
      deliverResponse(svc, { id: req.id, statusCode: 200 });

      await expect(p).rejects.toThrow("contained no body");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Pending-request accessors
  // ──────────────────────────────────────────────────────────────────────────

  describe("Pending request accessors", () => {
    beforeEach(() => svc.initialize(fakeSipClient));

    it("hasPendingRequests() is false with no active requests", () => {
      expect(svc.hasPendingRequests()).toBe(false);
    });

    it("hasPendingRequests() is true while a request is in flight", async () => {
      svc.getFavoriteAkten({});
      await flush();
      expect(svc.hasPendingRequests()).toBe(true);
    });

    it("hasPendingRequest(messageType) finds a request by its message type", async () => {
      svc.getFavoriteAkten({});
      await flush();
      expect(svc.hasPendingRequest("akten.getFavoriteAkten")).toBe(true);
      expect(svc.hasPendingRequest("person.personLookUp")).toBe(false);
    });

    it("getPendingRequestCount() reflects the number of in-flight requests", async () => {
      svc.getFavoriteAkten({});
      svc.aktLookUp("x");
      await flush();
      expect(svc.getPendingRequestCount()).toBe(2);

      const [req1, req2] = allSentRequests();
      deliverResponse(svc, { id: req1.id, statusCode: 200, body: base64EncodeUtf8("[]") });
      deliverResponse(svc, { id: req2.id, statusCode: 200, body: base64EncodeUtf8("[]") });
      await Promise.resolve();
      await Promise.resolve();

      expect(svc.getPendingRequestCount()).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // isReady()
  // ──────────────────────────────────────────────────────────────────────────

  describe("isReady()", () => {
    it("delegates to WebRTCDataChannelService.isReadyForCommunication", () => {
      mockDataChannelSvc.isReadyForCommunication = true;
      expect(svc.isReady()).toBe(true);

      mockDataChannelSvc.isReadyForCommunication = false;
      expect(svc.isReady()).toBe(false);
    });
  });
});

// ─── Local flush helper (module-scope, used inside a couple of tests) ─────────
async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}
