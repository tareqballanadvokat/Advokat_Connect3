/* eslint-disable no-undef */
/**
 * Component Tests for tabs/person/CustomTitle.tsx
 *
 * Pure presentational component — no devextreme dependencies.
 */

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { changeLanguage: jest.fn() } }),
  initReactI18next: { type: "3rdParty", init: jest.fn() },
}));

import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CustomTitle from "@components/tabs/person/CustomTitle";

describe("CustomTitle", () => {
  const onDelete = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("shows the display name", () => {
    render(<CustomTitle anzeigename="Max Mustermann" onDelete={onDelete} />);
    expect(screen.getByText("Max Mustermann")).toBeInTheDocument();
  });

  it("calls onDelete when the delete button is clicked", () => {
    render(<CustomTitle anzeigename="Max Mustermann" onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle("hints.removeFromFavorites"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onDelete while isDeleting is true (button disabled)", () => {
    render(<CustomTitle anzeigename="Max Mustermann" isDeleting onDelete={onDelete} />);
    const button = screen.getByTitle("hints.removingFromFavorites");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("shows the spinning icon and 'removing' label while isDeleting", () => {
    const { container } = render(
      <CustomTitle anzeigename="Max Mustermann" isDeleting onDelete={onDelete} />
    );
    expect(container.querySelector(".person-title-icon--spinning")).toBeInTheDocument();
    expect(screen.getByText(/removingLabel/)).toBeInTheDocument();
  });

  it("shows the user icon (not spinning) when not deleting", () => {
    const { container } = render(<CustomTitle anzeigename="Max Mustermann" onDelete={onDelete} />);
    expect(container.querySelector(".dx-icon-user")).toBeInTheDocument();
    expect(container.querySelector(".person-title-icon--spinning")).not.toBeInTheDocument();
  });

  it("stops event propagation on delete click", () => {
    render(
      <div onClick={onDelete}>
        <CustomTitle anzeigename="Max Mustermann" onDelete={jest.fn()} />
      </div>
    );
    fireEvent.click(screen.getByTitle("hints.removeFromFavorites"));
    expect(onDelete).not.toHaveBeenCalled(); // parent's onClick should not fire
  });
});
