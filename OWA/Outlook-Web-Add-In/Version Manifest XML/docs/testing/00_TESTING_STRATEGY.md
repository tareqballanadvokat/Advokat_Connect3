# Testing Strategy

## Overview

This document is the **master index** for the add-in's testing approach.
Each section summarises a test type and links to its dedicated guide.

| Guide | Scope | Status |
|---|---|---|
| [01_TESTING_GUIDE_SLICES.md](./01_TESTING_GUIDE_SLICES.md) | Unit tests — Redux slices | ✅ 476 tests passing |
| [02_TESTING_GUIDE_SERVICES.md](./02_TESTING_GUIDE_SERVICES.md) | Unit tests — Services | ⏳ In progress (39 tests) |
| [03_TESTING_GUIDE_SIP.md](./03_TESTING_GUIDE_SIP.md) | Unit tests — SIP infrastructure | ⏳ In progress (92 tests, low-complexity files done) |
| [04_TESTING_GUIDE_COMPONENTS.md](./04_TESTING_GUIDE_COMPONENTS.md) | Component tests (React Testing Library) | ✅ 40 tests passing (App, Header, Tab, PairingDialog) |
| [05_TESTING_GUIDE_INTEGRATION.md](./05_TESTING_GUIDE_INTEGRATION.md) | Integration tests | ❌ Not started |
| [06_TESTING_GUIDE_E2E.md](./06_TESTING_GUIDE_E2E.md) | End-to-end tests (Playwright) | ❌ Not started |

---

## Test Infrastructure (already configured)


| Tool | Purpose | Status |
|---|---|---|
| **Jest** + `ts-jest` | Test runner + TypeScript compilation | ✅ configured (`jest.config.js`) |
| **jsdom** | Browser-like DOM environment | ✅ configured as `testEnvironment` |
| **@testing-library/react** | React component rendering + interaction | ✅ installed |
| **@testing-library/jest-dom** | Custom DOM matchers (`toBeInTheDocument`, etc.) | ✅ installed |
| `setupTests.ts` | Global jest-dom setup | ✅ in place |
| Path aliases (`@store`, `@slices`, `@services`, etc.) | Module resolution in tests | ✅ mapped in `jest.config.js` |
| `__mocks__/` | CSS, file, and DevExtreme stubs | ✅ in place |
| `testSetup.ts` + `mockFactories.ts` | Shared store factory and mock data builders | ✅ in place |

Run commands:

```bash
npm test                  # run all tests
npm run test:coverage     # with coverage report
npm run test:unit         # only __tests__ folders
npm run test:watch        # watch mode
```

---

## 1. Unit Tests — Redux Slices

Pure reducer logic, action creators, selectors, and async thunks tested in complete isolation.
Six slices are fully covered (632 tests). Three slices are still missing: `pairingSlice`, `loggingSlice`, `languageSlice`.

**Can start immediately: ✅ Yes** — all infrastructure is in place.

→ **[Full guide: 01_TESTING_GUIDE_SLICES.md](./01_TESTING_GUIDE_SLICES.md)**

---

## 2. Unit Tests — Services

Business logic classes in `src/services/` tested in isolation. All external
dependencies (Redux store, Office API, WebRTC, network) are mocked.  
Requires a one-time `OfficeRuntime` global mock and WebRTC global stubs in `setupTests.ts`.

**Can start immediately: ✅ Yes** — all infrastructure is in place.

→ **[Full guide: 02_TESTING_GUIDE_SERVICES.md](./02_TESTING_GUIDE_SERVICES.md)**

---

## 3. Unit Tests — SIP Infrastructure

The SIP protocol state-machine in `src/infrastructure/sip/` tested in isolation.
Start with `MessageFactory`, `Helper`, `TimeoutManager` (no mocks needed).
Higher-complexity files need a global `WebSocket` mock class.

**Can start immediately: ✅ Yes** (low-complexity files) / ⚠️ Partial (SipClient, Peer2PeerConnection)

→ **[Full guide: 03_TESTING_GUIDE_SIP.md](./03_TESTING_GUIDE_SIP.md)**

---

## 4. Component Tests (React Testing Library)

React components in `src/taskpane/components/` rendered with a real Redux store and
i18n provider. Requires a shared `renderWithProviders` helper (one-time setup).
All tooling (`@testing-library/react`, `@testing-library/jest-dom`) is already installed.

**Can start immediately: ✅ Yes**

→ **[Full guide: 04_TESTING_GUIDE_COMPONENTS.md](./04_TESTING_GUIDE_COMPONENTS.md)**

---

## 5. Integration Tests

Multiple real units wired together — only the Office API, `fetch`, and `WebSocket`
are mocked. Key scenarios: token refresh flow, pairing flow, idle disconnect, SIP + Redux sync.
The token and pairing scenarios can start now; SIP integration needs WebSocket mock work first.

**Can start immediately: ⚠️ Partially**

→ **[Full guide: 05_TESTING_GUIDE_INTEGRATION.md](./05_TESTING_GUIDE_INTEGRATION.md)**

---

## 6. End-to-End Tests

Full add-in loaded in a browser (Playwright) against a stubbed ADVOKAT backend.
Requires Playwright installation, HTTPS hosting of the add-in, and an ADVOKAT mock server.
Significant infrastructure investment — start after unit and component coverage is solid.

**Can start immediately: ❌ Not yet**

→ **[Full guide: 06_TESTING_GUIDE_E2E.md](./06_TESTING_GUIDE_E2E.md)**

---

## Recommended Implementation Order

| Step | What | Guide | Effort |
|---|---|---|---|
| 1 | `pairingSlice` unit test | [Slices](./01_TESTING_GUIDE_SLICES.md) | Small |
| 2 | `OfficeAuthService` unit test | [Services](./02_TESTING_GUIDE_SERVICES.md) | Small |
| 3 | `TokenService` unit test | [Services](./02_TESTING_GUIDE_SERVICES.md) | Small–Medium |
| 4 | `MessageFactory` + `Helper` + `TimeoutManager` | [SIP](./03_TESTING_GUIDE_SIP.md) | Small |
| 5 | `renderWithProviders` helper + `App.tsx` component test | [Components](./04_TESTING_GUIDE_COMPONENTS.md) | Medium |
| 6 | Remaining component tests (tabs) | [Components](./04_TESTING_GUIDE_COMPONENTS.md) | Medium per tab |
| 7 | `IdleActivityMonitor` unit test | [Services](./02_TESTING_GUIDE_SERVICES.md) | Medium |
| 8 | `WebRTCDataChannelService` unit test | [Services](./02_TESTING_GUIDE_SERVICES.md) | Medium |
| 9 | `Registration` + `EstablishingConnection` unit tests | [SIP](./03_TESTING_GUIDE_SIP.md) | Medium |
| 10 | `WebRTCConnectionManager` unit test | [Services](./02_TESTING_GUIDE_SERVICES.md) | High |
| 11 | Integration tests (token, pairing, idle) | [Integration](./05_TESTING_GUIDE_INTEGRATION.md) | Medium |
| 12 | E2E tests | [E2E](./06_TESTING_GUIDE_E2E.md) | High |
