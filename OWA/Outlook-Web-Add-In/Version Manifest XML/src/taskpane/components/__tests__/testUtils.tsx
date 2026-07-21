/**
 * renderWithProviders — shared test utility for React component tests.
 *
 * Wraps a React element in a Redux Provider populated with a fully configured
 * test store (all reducers). The store can be pre-seeded with partial state
 * via `preloadedState`.
 *
 * react-i18next is mocked at the module level in each test file that uses
 * this helper, so no i18n provider wrapper is needed here.
 */
import * as React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore, PreloadedState } from "@reduxjs/toolkit";
import emailReducer from "@slices/emailSlice";
import serviceReducer from "@slices/serviceSlice";
import aktenReducer from "@slices/aktenSlice";
import personReducer from "@slices/personSlice";
import authReducer from "@slices/authSlice";
import connectionReducer from "@slices/connectionSlice";
import loggingReducer from "@slices/loggingSlice";
import languageReducer from "@slices/languageSlice";
import pairingReducer from "@slices/pairingSlice";

// Full reducer map matching the production store
const allReducers = {
  email: emailReducer,
  service: serviceReducer,
  akten: aktenReducer,
  person: personReducer,
  auth: authReducer,
  connection: connectionReducer,
  logging: loggingReducer,
  language: languageReducer,
  pairing: pairingReducer,
};

export type RenderStore = ReturnType<typeof configureStore<typeof allReducers>>;

export interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  preloadedState?: PreloadedState<any>;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { preloadedState, ...renderOptions }: RenderWithProvidersOptions = {}
) {
  const store = configureStore({
    reducer: allReducers as any,
    preloadedState,
    middleware: (getDefault) => getDefault(),
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
