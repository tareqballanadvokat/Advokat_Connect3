/* eslint-disable no-undef */
/**
 * Component Tests for tabs/shared/DropAttachArea.tsx
 *
 * LoadPanel is mocked with a minimal stand-in exposing its `visible` prop.
 * FileReader is replaced with a controllable mock so tests can drive the
 * async base64-read step deterministically.
 *
 * Covers:
 *  - Drag-over/drag-leave toggle the active class and label text
 *  - Drop with no files is a no-op
 *  - Drop with files: reads each as base64, strips the data-URL prefix,
 *    attaches sequentially via Office.context.mailbox.item, shows the
 *    LoadPanel while in flight and hides it afterward
 *  - Attach failure is caught without crashing and clears the loading state
 */

// ─── react-i18next mock ───────────────────────────────────────────────────────
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { changeLanguage: jest.fn() } }),
  initReactI18next: { type: "3rdParty", init: jest.fn() },
}));

// ─── Logger mock ─────────────────────────────────────────────────────────────
jest.mock("@infra/logger", () => ({
  getLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}));

// ─── LoadPanel mock ─────────────────────────────────────────────────────────────
jest.mock("devextreme-react/load-panel", () => {
  const R = require("react");
  return {
    __esModule: true,
    default: ({ visible, message }: any) =>
      visible ? R.createElement("div", { "data-testid": "load-panel" }, message) : null,
  };
});

// ─── Imports (after all mocks) ────────────────────────────────────────────────
import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DropAttachArea from "@components/tabs/shared/DropAttachArea";

// ─── FileReader mock ────────────────────────────────────────────────────────────
class MockFileReader {
  onload: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;
  result: string | null = null;

  readAsDataURL(_file: File) {
    // Resolve asynchronously on the next microtask, like the real API
    Promise.resolve().then(() => {
      this.result = "data:application/pdf;base64,ZmFrZS1jb250ZW50";
      this.onload?.({ target: this });
    });
  }
}

function makeFile(name: string): File {
  return new File(["content"], name, { type: "application/pdf" });
}

function makeDropEvent(files: File[]): any {
  return {
    preventDefault: jest.fn(),
    dataTransfer: { files },
  };
}

describe("DropAttachArea", () => {
  let originalFileReader: any;
  let addFileAttachmentFromBase64Async: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    originalFileReader = (global as any).FileReader;
    (global as any).FileReader = MockFileReader;

    addFileAttachmentFromBase64Async = jest.fn(
      (_base64: string, _name: string, _opts: any, callback: (r: any) => void) => {
        callback({ status: "succeeded" });
      }
    );
    (global as any).Office = {
      ...((global as any).Office ?? {}),
      context: { mailbox: { item: { addFileAttachmentFromBase64Async } } },
      AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    };
  });

  afterEach(() => {
    (global as any).FileReader = originalFileReader;
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Rendering / drag state
  // ──────────────────────────────────────────────────────────────────────────

  describe("drag state", () => {
    it("shows the default 'drag files here' label", () => {
      render(<DropAttachArea />);
      expect(screen.getByText("dragDrop.dragFilesHere")).toBeInTheDocument();
    });

    it("does not show the LoadPanel initially", () => {
      render(<DropAttachArea />);
      expect(screen.queryByTestId("load-panel")).not.toBeInTheDocument();
    });

    it("switches to the 'release to attach' label and active class on drag-over", () => {
      const { container } = render(<DropAttachArea />);
      const dropZone = container.querySelector(".drop-attach-area")!;

      fireEvent.dragOver(dropZone);

      expect(screen.getByText("dragDrop.releaseToAttach")).toBeInTheDocument();
      expect(dropZone).toHaveClass("drop-attach-area--active");
    });

    it("reverts to the default label on drag-leave", () => {
      const { container } = render(<DropAttachArea />);
      const dropZone = container.querySelector(".drop-attach-area")!;

      fireEvent.dragOver(dropZone);
      fireEvent.dragLeave(dropZone);

      expect(screen.getByText("dragDrop.dragFilesHere")).toBeInTheDocument();
      expect(dropZone).not.toHaveClass("drop-attach-area--active");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Drop handling
  // ──────────────────────────────────────────────────────────────────────────

  describe("onDrop", () => {
    it("is a no-op when no files are dropped", () => {
      const { container } = render(<DropAttachArea />);
      const dropZone = container.querySelector(".drop-attach-area")!;

      fireEvent.drop(dropZone, makeDropEvent([]));

      expect(addFileAttachmentFromBase64Async).not.toHaveBeenCalled();
      expect(screen.queryByTestId("load-panel")).not.toBeInTheDocument();
    });

    it("reads and attaches a single dropped file", async () => {
      const { container } = render(<DropAttachArea />);
      const dropZone = container.querySelector(".drop-attach-area")!;

      fireEvent.drop(dropZone, makeDropEvent([makeFile("invoice.pdf")]));

      await waitFor(() => expect(addFileAttachmentFromBase64Async).toHaveBeenCalledTimes(1));
      expect(addFileAttachmentFromBase64Async).toHaveBeenCalledWith(
        "ZmFrZS1jb250ZW50", // data-URL prefix stripped
        "invoice.pdf",
        { isInline: false },
        expect.any(Function)
      );
    });

    it("shows the LoadPanel while attaching and hides it afterward", async () => {
      const { container } = render(<DropAttachArea />);
      const dropZone = container.querySelector(".drop-attach-area")!;

      fireEvent.drop(dropZone, makeDropEvent([makeFile("invoice.pdf")]));

      expect(await screen.findByTestId("load-panel")).toBeInTheDocument();

      await waitFor(() => expect(screen.queryByTestId("load-panel")).not.toBeInTheDocument());
    });

    it("attaches multiple dropped files sequentially", async () => {
      const { container } = render(<DropAttachArea />);
      const dropZone = container.querySelector(".drop-attach-area")!;

      fireEvent.drop(dropZone, makeDropEvent([makeFile("a.pdf"), makeFile("b.pdf")]));

      await waitFor(() => expect(addFileAttachmentFromBase64Async).toHaveBeenCalledTimes(2));
      expect(addFileAttachmentFromBase64Async.mock.calls[0][1]).toBe("a.pdf");
      expect(addFileAttachmentFromBase64Async.mock.calls[1][1]).toBe("b.pdf");
    });

    it("clears the drag-active state on drop", () => {
      const { container } = render(<DropAttachArea />);
      const dropZone = container.querySelector(".drop-attach-area")!;

      fireEvent.dragOver(dropZone);
      fireEvent.drop(dropZone, makeDropEvent([]));

      expect(dropZone).not.toHaveClass("drop-attach-area--active");
    });

    it("does not throw and clears loading state when the attach call fails", async () => {
      addFileAttachmentFromBase64Async.mockImplementation(
        (_base64: string, _name: string, _opts: any, callback: (r: any) => void) => {
          callback({ status: "failed", error: new Error("attach failed") });
        }
      );

      const { container } = render(<DropAttachArea />);
      const dropZone = container.querySelector(".drop-attach-area")!;

      expect(() => fireEvent.drop(dropZone, makeDropEvent([makeFile("invoice.pdf")]))).not.toThrow();

      await waitFor(() => expect(screen.queryByTestId("load-panel")).not.toBeInTheDocument());
    });
  });
});
