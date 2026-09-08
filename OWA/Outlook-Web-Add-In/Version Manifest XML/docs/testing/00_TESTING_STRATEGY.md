# Testing Strategy

## Overview

This document is the **master index** for the add-in's testing approach.
Each section summarises a test type and links to its dedicated guide.

| Guide | Scope | Status |
|---|---|---|
| [01_TESTING_GUIDE_SLICES.md](./01_TESTING_GUIDE_SLICES.md) | Unit tests — Redux slices | ✅ 501 tests passing (all 9 slices) |
| [02_TESTING_GUIDE_SERVICES.md](./02_TESTING_GUIDE_SERVICES.md) | Unit tests — Services | ✅ 272 tests passing (all 8 files) |
| [03_TESTING_GUIDE_SIP.md](./03_TESTING_GUIDE_SIP.md) | Unit tests — SIP infrastructure | ✅ 318 tests passing (all 7 files) |
| [04_TESTING_GUIDE_COMPONENTS.md](./04_TESTING_GUIDE_COMPONENTS.md) | Component tests (React Testing Library) | ✅ 285 tests passing (22 files — App, Header, Tab, PairingDialog, all 4 tab panels, and all tab sub-components) |
| [05_TESTING_GUIDE_INTEGRATION.md](./05_TESTING_GUIDE_INTEGRATION.md) | Integration tests | ✅ 44 tests passing (token refresh, pairing incl. real UI, idle, SIP+Redux sync incl. retry/reconnect, favorites end-to-end, token expiry) |
| [06_TESTING_GUIDE_E2E.md](./06_TESTING_GUIDE_E2E.md) | End-to-end tests (Playwright) | ❌ Not started |

Total: **1420 tests passing** across 53 suites (`npx jest`).

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
All 9 slices are fully covered (501 tests): `authSlice`, `aktenSlice`, `emailSlice`, `serviceSlice`,
`personSlice`, `connectionSlice`, `pairingSlice`, `loggingSlice`, `languageSlice`.

**Status: ✅ Done**

→ **[Full guide: 01_TESTING_GUIDE_SLICES.md](./01_TESTING_GUIDE_SLICES.md)**

---

## 2. Unit Tests — Services

Business logic classes in `src/services/` tested in isolation. All external
dependencies (Redux store, Office API, WebRTC, network) are mocked.
All 8 files are covered (272 tests): `OfficeAuthService`, `TokenService`,
`IdleActivityMonitor`, `WebRTCDataChannelService`, `WebRTCConnectionManager`,
`PairingApiService`, `officeAuthErrors`, `webRTCApiService`.

**Status: ✅ Done**

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
`App`, `Header`, `Tab`, `PairingDialog`, all 4 tab panels (`tabs/email`,
`tabs/case`, `tabs/person`, `tabs/service`), and every tab sub-component
(search/registered lists, transfer & attachment UI, service section, cache
stats panel, drag-and-drop attach area, and the trivial presentational
pieces) are covered (285 tests across 22 files).

**Status: ✅ Done**

→ **[Full guide: 04_TESTING_GUIDE_COMPONENTS.md](./04_TESTING_GUIDE_COMPONENTS.md)**

---

## 5. Integration Tests

Multiple real units wired together — only the Office API, `fetch`, and `WebSocket`
are mocked. 7 scenarios are covered across 44 tests: token refresh flow, pairing
flow (service-level and through the real `PairingDialog` UI), idle disconnect,
SIP + Redux sync (drives the real SipClient/Registration/EstablishingConnection/
Peer2PeerConnection chain through a full handshake, a registration retry, and a
full reconnect cycle via a hand-driven mock WebSocket/RTCPeerConnection),
favorites (case) flow end-to-end (real component + thunk + `WebRTCApiService`
message construction), and token expiry mid-session (real `WebRTCConnectionStatus`
+ `TokenService`).

A 2026-08-17 re-audit found most of the original 4 files only wired 2 of the
"2+ real units" they claimed and fixed the gaps — surfacing one real production
bug along the way (see [05_TESTING_GUIDE_INTEGRATION.md](./05_TESTING_GUIDE_INTEGRATION.md)).

**Status: ✅ Done**

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

Slices, services, SIP infrastructure, components, and all 4 integration scenarios are
fully covered. What's left:

| Step | What | Guide | Effort |
|---|---|---|---|
| 1 | E2E tests | [E2E](./06_TESTING_GUIDE_E2E.md) | High |
