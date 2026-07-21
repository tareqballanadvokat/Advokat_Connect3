/* eslint-disable no-undef */
/**
 * Unit Tests for Helper
 *
 * Tests the two utility methods:
 *   - blobToStringAsync: converts string | ArrayBuffer | Blob → string
 *   - contentLength: returns the byte length of a string (UTF-8 encoded)
 *
 * No mocks required — pure functions.
 */

import { Helper, helper } from "@infra/sip/Helper";

describe("Helper", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // blobToStringAsync
  // ──────────────────────────────────────────────────────────────────────────

  describe("blobToStringAsync", () => {
    describe("when input is a string", () => {
      it("should return the string as-is", async () => {
        expect(await helper.blobToStringAsync("hello")).toBe("hello");
      });

      it("should return an empty string unchanged", async () => {
        expect(await helper.blobToStringAsync("")).toBe("");
      });

      it("should return a string with special characters unchanged", async () => {
        const input = "SIP/2.0 200 OK\r\nContent-Length: 0\r\n\r\n";
        expect(await helper.blobToStringAsync(input)).toBe(input);
      });
    });

    describe("when input is an ArrayBuffer", () => {
      it("should decode ASCII bytes correctly", async () => {
        const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
        const result = await helper.blobToStringAsync(bytes.buffer);
        expect(result).toBe("Hello");
      });

      it("should decode an empty ArrayBuffer to an empty string", async () => {
        const result = await helper.blobToStringAsync(new ArrayBuffer(0));
        expect(result).toBe("");
      });

      it("should decode UTF-8 multi-byte characters correctly", async () => {
        // "Ä" = U+00C4 → UTF-8 bytes 0xC3 0x84 (195, 132)
        // Use Uint8Array literal so the ArrayBuffer is jsdom-native (avoids Node vs jsdom instanceof mismatch)
        const bytes = new Uint8Array([195, 132]);
        const result = await helper.blobToStringAsync(bytes.buffer);
        expect(result).toBe("Ä");
      });
    });

    describe("when input is a Blob", () => {
      it("should call .text() on the Blob and return its content", async () => {
        // Use a duck-typed fake — jsdom does not implement Blob.text()
        const fakeBlob = {
          text: jest.fn().mockResolvedValue("SIP message"),
        } as unknown as Blob;

        const result = await helper.blobToStringAsync(fakeBlob);

        expect(result).toBe("SIP message");
        expect((fakeBlob as any).text).toHaveBeenCalledTimes(1);
      });

      it("should handle an empty Blob", async () => {
        const fakeBlob = { text: jest.fn().mockResolvedValue("") } as unknown as Blob;
        expect(await helper.blobToStringAsync(fakeBlob)).toBe("");
      });
    });

    describe("singleton export", () => {
      it("should export a pre-constructed singleton instance", () => {
        expect(helper).toBeInstanceOf(Helper);
      });

      it("singleton should behave identically to a new instance", async () => {
        const instance = new Helper();
        const input = "test-message";
        expect(await helper.blobToStringAsync(input)).toBe(await instance.blobToStringAsync(input));
      });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // contentLength
  // ──────────────────────────────────────────────────────────────────────────

  describe("contentLength", () => {
    it("should return 0 for an empty string", () => {
      expect(helper.contentLength("")).toBe(0);
    });

    it("should return the character count for ASCII-only strings", () => {
      expect(helper.contentLength("hello")).toBe(5);
    });

    it("should return the byte count, not char count, for multi-byte characters", () => {
      // "Ä" is 2 bytes in UTF-8, 1 character
      expect(helper.contentLength("Ä")).toBe(2);
    });

    it("should correctly count a typical SIP body", () => {
      const body = JSON.stringify({ ConnectionTimeout: 30000, PeerRegistrationTimeout: 10000 });
      const expected = new TextEncoder().encode(body).length;
      expect(helper.contentLength(body)).toBe(expected);
    });

    it("should return the same result for repeated calls with the same input", () => {
      const input = "consistent-input";
      expect(helper.contentLength(input)).toBe(helper.contentLength(input));
    });
  });
});
