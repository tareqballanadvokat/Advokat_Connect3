/* eslint-disable no-undef */
/**
 * Unit Tests for MessageFactory
 *
 * Tests that each static factory method produces a correctly structured
 * SIP message string. Assertions target the presence of required SIP
 * headers and correct verb/body content rather than exact byte-for-byte
 * string matching — this keeps tests robust to minor formatting changes.
 *
 * Mocked dependencies:
 *   - @config     (configService.getSipConfig, configService.buildSipUri)
 *   - @infra/logger
 *   - @infra/sip/Helper (contentLength — deterministic, but mocked to isolate)
 */

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({
    debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(),
  })),
}));

// ─── Config mock ─────────────────────────────────────────────────────────────
jest.mock("@config", () => ({
  configService: {
    getSipConfig: jest.fn(() => ({
      toDisplayName: "SERVER",
      fromDisplayName: "CLIENT",
      host: "advokat.example.com",
      port: 5061,
    })),
    buildSipUri: jest.fn((displayName: string) => `sip:${displayName}@advokat.example.com:5061`),
  },
}));

import { MessageFactory } from "@infra/sip/MessageFactory";

// ─── Shared base params used by all message types ────────────────────────────
const BASE = {
  sipUri: "sip:CLIENT@advokat.example.com:5061",
  branch: "z9hG4bK-test-branch",
  callId: "test-call-id-abc123",
  tag: "test-tag-xyz",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MessageFactory", () => {

  // ──────────────────────────────────────────────────────────────────────────
  // createAckMessage
  // ──────────────────────────────────────────────────────────────────────────

  describe("createAckMessage", () => {
    const params = { ...BASE, cseq: 3 };

    it("should start with ACK verb and SIP version", () => {
      const msg = MessageFactory.createAckMessage(params);
      expect(msg).toMatch(/^ACK sip:/);
      expect(msg).toContain("SIP/2.0");
    });

    it("should contain the correct CSeq", () => {
      const msg = MessageFactory.createAckMessage(params);
      expect(msg).toContain("CSeq: 3 ACK");
    });

    it("should contain the Call-ID", () => {
      const msg = MessageFactory.createAckMessage({ ...params, callId: "call-id-test" });
      expect(msg).toContain("Call-ID: call-id-test");
    });

    it("should contain the branch in the Via header", () => {
      const msg = MessageFactory.createAckMessage(params);
      expect(msg).toContain(`branch=${BASE.branch}`);
    });

    it("should contain Content-Length: 0 (ACK has no body)", () => {
      const msg = MessageFactory.createAckMessage(params);
      expect(msg).toContain("Content-Length: 0");
    });

    it("should use pre-formatted toLine and fromLine when provided", () => {
      const msg = MessageFactory.createAckMessage({
        ...params,
        toLine: '"CUSTOM_TO" <sip:custom@host>',
        fromLine: '"CUSTOM_FROM" <sip:me@host>;tag=abc',
      });
      expect(msg).toContain("CUSTOM_TO");
      expect(msg).toContain("CUSTOM_FROM");
    });

    it("should fall back to configService display names when toLine/fromLine are absent", () => {
      const msg = MessageFactory.createAckMessage(params);
      expect(msg).toContain("SERVER");
      expect(msg).toContain("CLIENT");
    });

    it("should include the tag in the From header", () => {
      const msg = MessageFactory.createAckMessage(params);
      expect(msg).toContain(`tag=${BASE.tag}`);
    });

    it("should end with double CRLF (header/body separator)", () => {
      const msg = MessageFactory.createAckMessage(params);
      expect(msg).toMatch(/\r\n\r\n$/);
    });

    it("should include the Allow header", () => {
      const msg = MessageFactory.createAckMessage(params);
      expect(msg).toContain("Allow: INVITE,ACK,CANCEL,BYE");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createByeMessage
  // ──────────────────────────────────────────────────────────────────────────

  describe("createByeMessage", () => {
    const params = { ...BASE, cseq: 4 };

    it("should start with BYE verb", () => {
      const msg = MessageFactory.createByeMessage(params);
      expect(msg).toMatch(/^BYE sip:/);
    });

    it("should contain the correct CSeq", () => {
      const msg = MessageFactory.createByeMessage(params);
      expect(msg).toContain("CSeq: 4");
    });

    it("should contain the Call-ID", () => {
      const msg = MessageFactory.createByeMessage({ ...params, callId: "bye-call-id" });
      expect(msg).toContain("Call-ID: bye-call-id");
    });

    it("should add a To-tag when toTag is provided", () => {
      const msg = MessageFactory.createByeMessage({ ...params, toTag: "server-tag-99" });
      expect(msg).toContain("tag=server-tag-99");
    });

    it("should NOT add a To-tag when toTag is omitted", () => {
      const msg = MessageFactory.createByeMessage(params);
      // The To header should not have an extra tag (the From does though)
      const toLine = msg.split("\r\n").find((l) => l.startsWith("To:")) ?? "";
      expect(toLine).not.toContain("tag=");
    });

    it("should include a REGISTRATION Reason header", () => {
      const msg = MessageFactory.createByeMessage({ ...params, reasonType: "REGISTRATION" });
      expect(msg).toContain("Reason: REGISTRATION");
    });

    it("should include a CONNECTION Reason header", () => {
      const msg = MessageFactory.createByeMessage({ ...params, reasonType: "CONNECTION" });
      expect(msg).toContain("Reason: CONNECTION");
    });

    it("should include custom reason text in CUSTOM type", () => {
      const msg = MessageFactory.createByeMessage({
        ...params, reasonType: "CUSTOM", reasonText: "User hung up",
      });
      expect(msg).toContain("Reason: User hung up");
    });

    it("should produce no Reason header when reasonType is omitted", () => {
      const msg = MessageFactory.createByeMessage(params);
      expect(msg).not.toContain("Reason:");
    });

    it("should include reasonText appended to REGISTRATION reason", () => {
      const msg = MessageFactory.createByeMessage({
        ...params, reasonType: "REGISTRATION", reasonText: "timeout",
      });
      expect(msg).toContain("Reason: REGISTRATION - timeout");
    });

    it("should end with double CRLF", () => {
      const msg = MessageFactory.createByeMessage(params);
      expect(msg).toMatch(/\r\n\r\n$/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createServiceMessage
  // ──────────────────────────────────────────────────────────────────────────

  describe("createServiceMessage", () => {
    const sdpBody = '{"type":"offer","sdp":"v=0\\r\\n"}';
    const params = {
      ...BASE,
      cseq: 1,
      toLine: 'To: "SERVER" <sip:SERVER@advokat.example.com:5061>',
      body: sdpBody,
    };

    it("should start with SERVICE verb", () => {
      const msg = MessageFactory.createServiceMessage(params);
      expect(msg).toMatch(/^SERVICE sip:/);
    });

    it("should contain the correct CSeq", () => {
      const msg = MessageFactory.createServiceMessage(params);
      expect(msg).toContain("CSeq: 1 SERVICE");
    });

    it("should include the SDP body at the end", () => {
      const msg = MessageFactory.createServiceMessage(params);
      expect(msg).toContain(sdpBody);
    });

    it("should set Content-Length to the byte length of the body", () => {
      const msg = MessageFactory.createServiceMessage(params);
      const bodyBytes = new TextEncoder().encode(sdpBody).length;
      expect(msg).toContain(`Content-Length: ${bodyBytes}`);
    });

    it("should default Content-Type to application/sdp", () => {
      const msg = MessageFactory.createServiceMessage(params);
      expect(msg).toContain("Content-Type: application/sdp");
    });

    it("should use a custom Content-Type when provided", () => {
      const msg = MessageFactory.createServiceMessage({
        ...params, contentType: "application/json",
      });
      expect(msg).toContain("Content-Type: application/json");
    });

    it("should default Expires to 300", () => {
      const msg = MessageFactory.createServiceMessage(params);
      expect(msg).toContain("Expires: 300");
    });

    it("should use a custom Expires value when provided", () => {
      const msg = MessageFactory.createServiceMessage({ ...params, expires: 60 });
      expect(msg).toContain("Expires: 60");
    });

    it("should include the toLine header", () => {
      const msg = MessageFactory.createServiceMessage(params);
      expect(msg).toContain('To: "SERVER"');
    });

    it("should include the tag in the From header", () => {
      const msg = MessageFactory.createServiceMessage(params);
      expect(msg).toContain(`tag=${BASE.tag}`);
    });

    it("should include Supported and User-Agent headers", () => {
      const msg = MessageFactory.createServiceMessage(params);
      expect(msg).toContain("Supported: path,gruu,outbound");
      expect(msg).toContain("User-Agent: JsSIP 3.10.0");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createRegisterMessage
  // ──────────────────────────────────────────────────────────────────────────

  describe("createRegisterMessage", () => {
    const timeoutConfig = {
      ConnectionTimeout: 30000,
      PeerRegistrationTimeout: 10000,
      ReceiveTimeout: 5000,
    };
    const params = {
      ...BASE,
      fromDisplayName: "JCH",
      toDisplayName: "adv-server-01",
      timeoutConfig,
    };

    it("should start with REGISTER verb", () => {
      const msg = MessageFactory.createRegisterMessage(params);
      expect(msg).toMatch(/^REGISTER sip:/);
    });

    it("should default CSeq to 1", () => {
      const msg = MessageFactory.createRegisterMessage(params);
      expect(msg).toContain("CSeq: 1 REGISTER");
    });

    it("should use a custom CSeq when provided", () => {
      const msg = MessageFactory.createRegisterMessage({ ...params, cseq: 7 });
      expect(msg).toContain("CSeq: 7 REGISTER");
    });

    it("should set Content-Type to application/json", () => {
      const msg = MessageFactory.createRegisterMessage(params);
      expect(msg).toContain("Content-Type: application/json");
    });

    it("should embed the timeout config as a JSON body", () => {
      const msg = MessageFactory.createRegisterMessage(params);
      const expectedBody = JSON.stringify(timeoutConfig);
      expect(msg).toContain(expectedBody);
    });

    it("should set Content-Length to the JSON body byte length", () => {
      const msg = MessageFactory.createRegisterMessage(params);
      const body = JSON.stringify(timeoutConfig);
      expect(msg).toContain(`Content-Length: ${body.length}`);
    });

    it("should include the fromDisplayName in the From header", () => {
      const msg = MessageFactory.createRegisterMessage(params);
      expect(msg).toContain('"JCH"');
    });

    it("should include the toDisplayName in the To header", () => {
      const msg = MessageFactory.createRegisterMessage(params);
      expect(msg).toContain('"adv-server-01"');
    });

    it("should include the Call-ID", () => {
      const msg = MessageFactory.createRegisterMessage({ ...params, callId: "reg-call-id" });
      expect(msg).toContain("Call-ID: reg-call-id");
    });

    it("should include standard Expires: 300", () => {
      const msg = MessageFactory.createRegisterMessage(params);
      expect(msg).toContain("Expires: 300");
    });

    it("should include Supported and User-Agent headers", () => {
      const msg = MessageFactory.createRegisterMessage(params);
      expect(msg).toContain("Supported: path,gruu,outbound");
      expect(msg).toContain("User-Agent: JsSIP 3.10.0");
    });

    it("should end with the JSON body (no trailing CRLF after body)", () => {
      const msg = MessageFactory.createRegisterMessage(params);
      const body = JSON.stringify(timeoutConfig);
      expect(msg.endsWith(body)).toBe(true);
    });
  });
});
