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
| `tabs/email/` | ❌ not yet implemented |
| `tabs/case/` | ❌ not yet implemented |
| `tabs/person/` | ❌ not yet implemented |
| `tabs/service/` | ❌ not yet implemented |

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
└── tabs/                       ← ❌ not yet implemented
    ├── email/
    ├── case/
    ├── person/
    └── service/
```

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

### `tabs/email/`

**What to test:**

| Scenario | Assertion |
|---|---|
| Email subject from `emailSlice` displayed | Subject text visible |
| Attachment list rendered | Each attachment name visible |
| Attachment checkbox toggled | Store action dispatched |
| Upload button clicked | `saveDokumentAsync` thunk dispatched |
| Loading state | Upload button disabled / spinner shown |

---

### `tabs/case/`

**What to test:**

| Scenario | Assertion |
|---|---|
| Search input typed | `aktLookUpAsync` dispatched with input value |
| Search results rendered | Each case name visible in list |
| Case row clicked | `setSelectedAkt` dispatched |
| Favorite star clicked | `addAktToFavoriteAsync` dispatched |
| No results | Empty state message shown |

---

### `tabs/person/`

**What to test:**

| Scenario | Assertion |
|---|---|
| Search input typed | `personLookUpAsync` dispatched |
| Results rendered | Person names visible |
| Favorite toggle | `addPersonToFavoriteAsync` dispatched |

---

### `tabs/service/`

**What to test:**

| Scenario | Assertion |
|---|---|
| Services loaded on mount | `loadServicesAsync` dispatched |
| Service item selected | Store updated with selection |
| Time field filled | State updated on change |
| Save button clicked | `saveLeistungAsync` dispatched |
| Loading state | Save button disabled |

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
