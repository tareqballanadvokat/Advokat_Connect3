# Component Testing Guide — React UI

> Part of the overall [Testing Strategy](./00_TESTING_STRATEGY.md).  
> Covers `src/taskpane/components/` — all React components rendered inside the
> Outlook task pane.

---

## Scope

| Component | Status |
|---|---|
| `App.tsx` | ✅ 12 tests — render, PairingDialog visibility, SSO effect chain, logging init |
| `Tab.tsx` | ✅ 8 tests — language switcher, Tabs wrapper, ICE badge, keyboard shortcut |
| `Header.tsx` | ✅ 7 tests — rendering (message, logo, buttons), language switching, active state |
| `tabs/shared/PairingDialog` | ✅ 13 tests — visibility, OTP input, form submission (success, errors, SSO) |
| `tabs/email/EmailTabContent` | ✅ 9 tests — compose-mode visibility, case selection, sendEmailHandler validation/happy path |
| `tabs/case/CaseTabContent` | ✅ 7 tests — favorites fetch on mount, row rendering, remove-from-favorites success/error |
| `tabs/person/PersonTabContent` | ✅ 8 tests — favorites fetch, empty state, add/remove favorite success/error |
| `tabs/service/ServiceTabContent` | ✅ 9 tests — compose-mode visibility, case selection, sendServiceHandler validation/success/error |

---

## Infrastructure Requirements

All libraries are already installed. The following is a one-time setup.

### `renderWithProviders` helper

✅ Created at `src/__tests__/unit/components/testUtils.tsx`.
Wraps any component in a Redux `Provider` seeded with a full test store (all 9 reducers).
Also add `testUtils.tsx` to `testPathIgnorePatterns` in `jest.config.js` so Jest doesn't treat it as a test suite.

```tsx
import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import i18n from '@i18n';
import { createTestStore } from '../slices/testSetup';

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: any;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { preloadedState, ...options }: RenderWithProvidersOptions = {}
) {
  const store = createTestStore(preloadedState);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <I18nextProvider i18n={i18n}>
          {children}
        </I18nextProvider>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}
```

### Module-level mocks (add once per test file that needs them)

```typescript
jest.mock('@services/WebRTCConnectionManager', () => ({
  getWebRTCConnectionManager: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    getWebRTCApiService: jest.fn(),
  })),
}));

jest.mock('@services/OfficeAuthService', () => ({
  officeAuthService: {
    getAccessToken: jest.fn().mockResolvedValue('mock-office-token'),
  },
}));

jest.mock('@services/PairingApiService', () => ({
  pairingApiService: {
    checkPairingStatus: jest.fn(),
  },
}));
```

---

## Test File Locations

```
src/__tests__/unit/components/
├── testUtils.tsx               ← shared renderWithProviders helper
├── App.test.tsx                ← ✅ done
├── Header.test.tsx             ← ✅ done
├── Tab.test.tsx                ← ✅ done
├── PairingDialog.test.tsx      ← ✅ done
└── tabs/
    ├── EmailTabContent.test.tsx    ← ✅ done
    ├── CaseTabContent.test.tsx     ← ✅ done
    ├── PersonTabContent.test.tsx   ← ✅ done
    └── ServiceTabContent.test.tsx  ← ✅ done
```

### DevExtreme mocking pattern used for the tab content tests

Each tab's `*TabContent` component is tested in isolation: heavy sibling components
(`SearchCaseList`/`SearchPersonList`, `EmailSend`/`ServiceSend`, `RegisteredEmails`/
`RegisteredService`, `ServiceSection`, `WebRTCConnectionStatus`) are mocked to simple
stubs that capture the props passed to them (especially callback props like
`onCaseSelect` / `onTransfer`), so the test can invoke those callbacks directly instead
of clicking through real DevExtreme widgets. Real async thunks (`saveDokumentAsync`,
`saveLeistungAsync`, `getFavoriteAktenAsync`, `removeAktFromFavoriteAsync`,
`getFavoritePersonsAsync`, etc.) are exercised for real against a mocked
`@services/WebRTCConnectionManager` (`getWebRTCApiService()` returns per-test `jest.fn()`s),
so the tests validate real reducer/dispatch behaviour, not just that a thunk was called.

`CaseTabContent` and `PersonTabContent` render `devextreme-react/tree-list` and
`devextreme-react/accordion` directly (not through a wrapper component), so those two
test files mock the DevExtreme component inline (same pattern `Tab.test.tsx` already
used for `devextreme-react/tabs`) with a minimal implementation that actually invokes
`cellRender` / `itemTitleRender` / `itemRender` for each row, so the real click handlers
wired up by the tab content component (delete, etc.) can be exercised.

**Important — `devextreme/ui/notify` has its own moduleNameMapper entry.** All
`devextreme-react/*` and `devextreme/*` imports collapse to the same physical mock file
(`src/__mocks__/devextremeMock.js`) via `jest.config.js`. Since Jest keys manual mocks by
*resolved file path*, a per-test `jest.mock('devextreme-react/tree-list', ...)` and
`jest.mock('devextreme/ui/notify', ...)` in the **same test file** would silently collide
— whichever `jest.mock()` call is registered last wins for *both* import specifiers, so
`notify(...)` calls end up silently invoking the wrong mock (no error, no console output,
the call is just dropped). `devextreme/ui/notify` is therefore mapped to its own file
(`src/__mocks__/devextremeNotifyMock.js`) so it never collides with a
`devextreme-react/*` override in the same file. If a future test needs to mock two
*different* `devextreme-react/*` submodules in one file, apply the same fix (give one of
them its own moduleNameMapper entry) rather than debugging silently-dropped mock calls.

---

## Component-by-Component Guide

---

### `App.tsx`

**What to test:**

| Scenario | Assertion |
|---|---|
| Store has `pairingStatus: 'unpaired'` | `<PairingDialog>` is rendered |
| Store has `pairingStatus: 'paired'` | Tab navigation is rendered, no pairing dialog |
| On mount | Connection manager `connect()` is triggered |
| `isLocalhost = true` | Yellow dev banner visible |
| `isLocalhost = false` | Green production banner visible |

**Example:**

```tsx
import { screen } from '@testing-library/react';
import App from '../App';
import { renderWithProviders } from './testUtils';

it('should show pairing dialog when not paired', () => {
  renderWithProviders(<App title="Test" />, {
    preloadedState: { pairing: { status: 'unpaired' } },
  });

  expect(screen.getByRole('dialog', { name: /pairing/i })).toBeInTheDocument();
});
```

---

### `Header.tsx`

**What to test:**

| Scenario | Assertion |
|---|---|
| Renders title prop | Title text visible |
| Store `connectionStatus: 'Connected'` | Green indicator or "Connected" text visible |
| Store `connectionStatus: 'Disconnected'` | Appropriate status text visible |

---

### `Tab.tsx`

**What to test:**

| Scenario | Assertion |
|---|---|
| Renders all tab labels | Each tab label visible in the DOM |
| Click on a tab | Active tab changes to clicked tab |
| Default active tab | First tab is active on initial render |

```tsx
import userEvent from '@testing-library/user-event';

it('should switch to the clicked tab', async () => {
  const user = userEvent.setup();
  renderWithProviders(<Tabs />);

  await user.click(screen.getByRole('tab', { name: /email/i }));

  expect(screen.getByRole('tab', { name: /email/i })).toHaveAttribute('aria-selected', 'true');
});
```

---

### `PairingDialog`

**What to test:**

| Scenario | Assertion |
|---|---|
| Renders server URL and OTP inputs | Both inputs visible |
| Submit with empty fields | Validation error shown |
| Submit with valid data | Pairing action dispatched |
| API returns error | Error message displayed in the dialog |
| Pairing success | Dialog closes / success state shown |

---

### `tabs/email/EmailTabContent` — ✅ Done

**Test file:** `src/__tests__/unit/components/tabs/EmailTabContent.test.tsx` (9 tests)

Search/attachment/registered-emails UI lives in mocked-away children
(`SearchCaseList`, `EmailSend`, `TransferAndAttachment`, `RegisteredEmails`); this
suite covers `EmailTabContent`'s own logic instead.

| Scenario | Assertion |
|---|---|
| Always rendered | `WebRTCConnectionStatus`, `SearchCaseList`, `RegisteredEmails` present |
| Compose mode | `EmailSend` / `ServiceSection` / `TransferAndAttachment` hidden |
| Read mode | `EmailSend` / `ServiceSection` / `TransferAndAttachment` shown |
| Case selected via `SearchCaseList` | `setSelectedAkt` dispatched |
| Transfer clicked, no case selected | Warning notification, no save |
| Transfer clicked, messageId unavailable | Warning notification, no save |
| Transfer clicked, valid case + selected email | `saveDokument` called, item marked `disabled` in store |

---

### `tabs/case/CaseTabContent` — ✅ Done

**Test file:** `src/__tests__/unit/components/tabs/CaseTabContent.test.tsx` (7 tests)

`devextreme-react/tree-list` is mocked inline with a minimal implementation that
invokes the real `cellRender` for each top-level row, so the delete button's real
`handleDelete` handler can be exercised.

| Scenario | Assertion |
|---|---|
| Always rendered | `WebRTCConnectionStatus`, `SearchCaseList` present |
| Mount + ready + no favorites loaded | `getFavoriteAktenAsync` dispatched once |
| Mount + not ready | No fetch |
| Mount + favorites already loaded | No re-fetch |
| One row per favorite Akt | Row testids present |
| Delete button clicked, success | `removeAktFromFavorite` called, expanded keys updated, list refreshed |
| Delete button clicked, failure | Error notification shown |

---

### `tabs/person/PersonTabContent` — ✅ Done

**Test file:** `src/__tests__/unit/components/tabs/PersonTabContent.test.tsx` (8 tests)

`devextreme-react/accordion` is mocked inline with a minimal implementation that
invokes `itemTitleRender`/`itemRender` per entry; `CustomTitle`/`CustomItem` are used
unmocked since they're plain presentational components.

| Scenario | Assertion |
|---|---|
| Always rendered | `WebRTCConnectionStatus`, `SearchPersonList` present |
| No favorites | Empty-state message shown |
| Favorites present | One accordion entry per person |
| Mount + ready | `getFavoritePersonsAsync` dispatched |
| Mount + not ready | No fetch |
| Person added via search | `addPersonToFavoritesAsync` dispatched, success notification |
| Delete clicked, success | `removePersonFromFavoritesAsync` dispatched, success notification |
| Delete clicked, failure | Error notification shown |

---

### `tabs/service/ServiceTabContent` — ✅ Done

**Test file:** `src/__tests__/unit/components/tabs/ServiceTabContent.test.tsx` (9 tests)

Mirrors the `EmailTabContent` approach: `SearchCaseList`, `ServiceSend`,
`ServiceSection`, `RegisteredService` are mocked to stubs so the test focuses on
`ServiceTabContent`'s own `sendServiceHandler` logic.

| Scenario | Assertion |
|---|---|
| Always rendered | `WebRTCConnectionStatus`, `SearchCaseList`, `RegisteredService` present |
| Compose mode | `ServiceSend` / `ServiceSection` hidden |
| Read mode | `ServiceSend` / `ServiceSection` shown |
| Case selected via `SearchCaseList` | `setSelectedAkt` dispatched |
| Transfer clicked, no case selected | Warning notification, no save |
| Transfer clicked, only SB (no time) provided | Error notification, no save |
| Transfer clicked, valid | `saveLeistung` called, success notification |
| Save fails | Error notification shown |

---

## Best Practices

### Always use `screen` queries
```tsx
// ✅ Good
screen.getByRole('button', { name: /submit/i })

// ❌ Avoid — tied to implementation
container.querySelector('.submit-btn')
```

### Prefer `userEvent` over `fireEvent`
```tsx
// ✅ Good — simulates real browser interaction
await userEvent.type(input, 'search term');

// ❌ Lower fidelity
fireEvent.change(input, { target: { value: 'search term' } });
```

### Assert on behaviour, not implementation
```tsx
// ✅ Good
expect(screen.getByText('Upload successful')).toBeInTheDocument();

// ❌ Avoid
expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ type: '...' }));
```

---

## Running Component Tests

```bash
# Run all component tests
npm test -- --testPathPattern=src/__tests__/unit/components

# Run one component
npm test -- App.test

# With coverage
npm run test:coverage -- --collectCoverageFrom='src/taskpane/components/**'
```

---

## Coverage Targets

| Component | Statements | Branches |
|---|---|---|
| `App.tsx` | 90%+ | 80%+ |
| `Header.tsx` | 90%+ | 85%+ |
| `Tab.tsx` | 90%+ | 80%+ |
| `PairingDialog` | 90%+ | 80%+ |
| Tab panels (email, case, person, service) | 85%+ | 75%+ |
