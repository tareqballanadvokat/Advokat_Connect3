# Testing Strategy

## Overview

This document is the **master index** for the add-in's testing approach.
Each section summarises a test type and links to its dedicated guide.

| Guide | Scope | Status |
|---|---|---|
| [01_TESTING_GUIDE_SLICES.md](./01_TESTING_GUIDE_SLICES.md) | Unit tests — Redux slices | ✅ 476 tests passing (all 9 slices) |
| [02_TESTING_GUIDE_SERVICES.md](./02_TESTING_GUIDE_SERVICES.md) | Unit tests — Services | ⚠️ 132 tests passing (5 of 6 services — `PairingApiService` still missing) |
| [03_TESTING_GUIDE_SIP.md](./03_TESTING_GUIDE_SIP.md) | Unit tests — SIP infrastructure | ✅ 237 tests passing (all 7 files) |
| [04_TESTING_GUIDE_COMPONENTS.md](./04_TESTING_GUIDE_COMPONENTS.md) | Component tests (React Testing Library) | ⚠️ 40 tests passing (App, Header, Tab, PairingDialog — tab panels not started) |
| [05_TESTING_GUIDE_INTEGRATION.md](./05_TESTING_GUIDE_INTEGRATION.md) | Integration tests | ⚠️ 30 tests passing (token, pairing, idle — SIP+Redux sync not started) |
| [06_TESTING_GUIDE_E2E.md](./06_TESTING_GUIDE_E2E.md) | End-to-end tests (Playwright) | ❌ Not started |

Total: **915 tests passing** across 28 suites (`npx jest`).

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
All 9 slices are fully covered (476 tests): `authSlice`, `aktenSlice`, `emailSlice`, `serviceSlice`,
`personSlice`, `connectionSlice`, `pairingSlice`, `loggingSlice`, `languageSlice`.

**Status: ✅ Done**

→ **[Full guide: 01_TESTING_GUIDE_SLICES.md](./01_TESTING_GUIDE_SLICES.md)**

---

## 2. Unit Tests — Services

Business logic classes in `src/services/` tested in isolation. All external
dependencies (Redux store, Office API, WebRTC, network) are mocked.
5 of 6 services are covered (132 tests): `OfficeAuthService`, `TokenService`,
`IdleActivityMonitor`, `WebRTCDataChannelService`, `WebRTCConnectionManager`.
`PairingApiService` still has no test file.

**Status: ⚠️ Mostly done** — `PairingApiService` remaining.

→ **[Full guide: 02_TESTING_GUIDE_SERVICES.md](./02_TESTING_GUIDE_SERVICES.md)**

---

## 3. Unit Tests — SIP Infrastructure

The SIP protocol state-machine in `src/infrastructure/sip/` tested in isolation.
All 7 files are covered (237 tests): `MessageFactory`, `Helper`, `TimeoutManager`,
`Registration`, `EstablishingConnection`, `Peer2PeerConnection`, `SipClient`.

**Status: ✅ Done**

→ **[Full guide: 03_TESTING_GUIDE_SIP.md](./03_TESTING_GUIDE_SIP.md)**

---

## 4. Component Tests (React Testing Library)

React components in `src/taskpane/components/` rendered with a real Redux store and
i18n provider, via the shared `renderWithProviders` helper.
`App`, `Header`, `Tab`, and `PairingDialog` are covered (40 tests). The four tab
panels (`tabs/email`, `tabs/case`, `tabs/person`, `tabs/service`) have no tests yet.

**Status: ⚠️ Partial** — tab panel tests remaining.

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

## Remaining Work

Slices, SIP infrastructure, and the token/pairing/idle integration scenarios are
fully covered. What's left:

| Step | What | Guide | Effort |
|---|---|---|---|
| 1 | `PairingApiService` unit test | [Services](./02_TESTING_GUIDE_SERVICES.md) | Small |
| 2 | Component tests for `tabs/email`, `tabs/case`, `tabs/person`, `tabs/service` | [Components](./04_TESTING_GUIDE_COMPONENTS.md) | Medium per tab |
| 3 | SIP + Redux sync integration test (Scenario 4) | [Integration](./05_TESTING_GUIDE_INTEGRATION.md) | Medium |
| 4 | E2E tests | [E2E](./06_TESTING_GUIDE_E2E.md) | High |
