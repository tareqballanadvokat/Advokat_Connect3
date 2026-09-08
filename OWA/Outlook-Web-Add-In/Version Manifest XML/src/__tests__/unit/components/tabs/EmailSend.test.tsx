/* eslint-disable no-undef */
/**
 * Component Tests for tabs/email/EmailSend.tsx
 *
 * Thin presentational wrapper — Button mocked as a plain <button>.
 */

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { changeLanguage: jest.fn() } }),
  initReactI18next: { type: "3rdParty", init: jest.fn() },
}));

jest.mock("devextreme-react/button", () => {
  const R = require("react");
  return {
    __esModule: true,
    default: ({ text, disabled, onClick, className }: any) =>
      R.createElement("button", { disabled, onClick, className }, text),
  };
});

import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import EmailSend from "@components/tabs/email/EmailSend";

describe("EmailSend", () => {
  const onTransfer = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("displays the case id in a read-only input", () => {
    render(<EmailSend caseId="TEST-1" onTransfer={onTransfer} transferBtnDisable={false} />);
    const input = screen.getByPlaceholderText("caseIdPlaceholder") as HTMLInputElement;
    expect(input.value).toBe("TEST-1");
    expect(input).toHaveAttribute("readonly");
  });

  it("calls onTransfer when the button is clicked", () => {
    render(<EmailSend caseId="TEST-1" onTransfer={onTransfer} transferBtnDisable={false} />);
    fireEvent.click(screen.getByText("buttons.transfer"));
    expect(onTransfer).toHaveBeenCalledTimes(1);
  });

  it("disables the button when transferBtnDisable is true", () => {
    render(<EmailSend caseId="TEST-1" onTransfer={onTransfer} transferBtnDisable={true} />);
    expect(screen.getByText("buttons.transfer")).toBeDisabled();
  });

  it("shows the sending label and disables the button while transferLoading", () => {
    render(
      <EmailSend caseId="TEST-1" onTransfer={onTransfer} transferBtnDisable={false} transferLoading />
    );
    const button = screen.getByText("buttons.sending");
    expect(button).toBeDisabled();
    expect(button).toHaveClass("transfer-button-loading");
  });

  it("defaults transferLoading to false when omitted", () => {
    render(<EmailSend caseId="TEST-1" onTransfer={onTransfer} transferBtnDisable={false} />);
    expect(screen.getByText("buttons.transfer")).not.toBeDisabled();
  });
});
