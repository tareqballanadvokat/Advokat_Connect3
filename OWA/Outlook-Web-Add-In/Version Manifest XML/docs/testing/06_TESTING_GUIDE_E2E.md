# End-to-End Testing Guide

> Part of the overall [Testing Strategy](./00_TESTING_STRATEGY.md).  
> Covers full-stack automation of the add-in running in a real or simulated
> browser environment against a stubbed or real ADVOKAT backend.

---

## Status: ❌ Not ready to implement yet

E2E testing for an Outlook Web Add-in requires significant infrastructure that
is not yet in place. This guide documents the requirements and plan so that the
work can be scoped and started at the right time.

**Prerequisite:** Unit and component test coverage should be at a comfortable
level before investing in E2E infrastructure.

---

## What E2E Tests Cover

| Area | Example |
|---|---|
| Full auth flow | Office SSO token → ADVOKAT JWT → connected state |
| Pairing flow | User enters OTP, add-in transitions to main UI |
| Call/connection setup | Connect button → SIP handshake → DataChannel open |
| Document upload | User selects email attachment → file lands in ADVOKAT |
| Case search | User types case name → results appear → case selected |
| Idle disconnect | No activity → add-in disconnects, shows idle state |
| Error states | Server unavailable → user sees error message |

---

## Infrastructure Requirements

### 1. Playwright (recommended over Cypress for Office Add-ins)

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Playwright is preferred because:
- Better support for iframes (Office task pane runs in an iframe)
- Built-in network interception without extra plugins
- First-class TypeScript support

### 2. Add-in hosting

The add-in must be served over HTTPS for Office to load it.  
Use `manifest.localhost.xml` with the webpack dev server during local E2E runs.

```bash
npm run dev-server   # serves at https://localhost:3000
```

For CI, build and serve the static output:
```bash
npm run build
npx serve -s dist -l 3000 --ssl-cert ... --ssl-key ...
```

### 3. Office Add-in sideloading

**Option A — Outlook on the web (recommended for CI)**  
Playwright can navigate to `outlook.office.com`, sideload the add-in via the
manifest URL, and open the task pane.

**Option B — Outlook desktop**  
Requires `office-addin-debugging` and a physical Windows machine; not suitable
for CI without a self-hosted runner.

### 4. ADVOKAT server mock

Use `msw` in "browser" mode or a real lightweight stub server to handle:
- `POST /addin/office-token/token` — return a mock JWT
- `POST /addin/pairing` — return pairing success
- WebSocket endpoint — respond with correct SIP messages

### 5. Playwright config (`playwright.config.ts`)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'https://localhost:3000',
    ignoreHTTPSErrors: true,  // self-signed cert on dev server
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev-server',
    url: 'https://localhost:3000',
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
  },
});
```

---

## Test File Structure

```
e2e/
├── playwright.config.ts
├── fixtures/
│   ├── authFixture.ts       ← pre-authenticated browser state
│   └── pairingFixture.ts    ← pre-paired add-in state
├── pages/
│   ├── TaskPanePage.ts      ← Page Object for the task pane
│   └── PairingPage.ts       ← Page Object for PairingDialog
└── tests/
    ├── auth.spec.ts
    ├── pairing.spec.ts
    ├── caseSearch.spec.ts
    ├── documentUpload.spec.ts
    └── idleDisconnect.spec.ts
```

---

## Page Object Pattern (recommended)

Encapsulate task pane interactions in a Page Object to keep tests readable:

```typescript
// e2e/pages/TaskPanePage.ts
import { Page, FrameLocator } from '@playwright/test';

export class TaskPanePage {
  private frame: FrameLocator;

  constructor(page: Page) {
    // Office task pane runs inside an iframe
    this.frame = page.frameLocator('[title="ADVOKAT Connect"]');
  }

  async searchCase(query: string) {
    await this.frame.getByLabel('Case search').fill(query);
    await this.frame.getByRole('button', { name: 'Search' }).click();
  }

  async getCaseResults() {
    return this.frame.getByRole('listitem').allTextContents();
  }
}
```

---

## Example Test

```typescript
// e2e/tests/caseSearch.spec.ts
import { test, expect } from '@playwright/test';
import { TaskPanePage } from '../pages/TaskPanePage';

test('should display case search results', async ({ page }) => {
  // Load the add-in (assumes add-in is sideloaded in Outlook on the web)
  await page.goto('/taskpane.html');  // or full OWA URL
  const taskPane = new TaskPanePage(page);

  await taskPane.searchCase('Mustermann');

  const results = await taskPane.getCaseResults();
  expect(results.length).toBeGreaterThan(0);
  expect(results[0]).toContain('Mustermann');
});
```

---

## Running E2E Tests

```bash
# Run all E2E tests (headed)
npx playwright test --headed

# Run in CI (headless)
npx playwright test

# Run a specific file
npx playwright test e2e/tests/pairing.spec.ts

# Open Playwright UI (interactive)
npx playwright test --ui

# View last report
npx playwright show-report
```

---

## CI Integration

Add to your pipeline after unit and component tests pass:

```yaml
# Example GitHub Actions step
- name: Run E2E tests
  run: npx playwright test
  env:
    ADVOKAT_MOCK_SERVER_URL: http://localhost:8080
```

---

## Implementation Checklist

- [ ] Install Playwright (`npm install --save-dev @playwright/test`)
- [ ] Create `playwright.config.ts`
- [ ] Set up ADVOKAT mock server (msw browser mode or stub server)
- [ ] Validate add-in loads correctly at `https://localhost:3000/taskpane.html`
- [ ] Create `TaskPanePage` Page Object
- [ ] Write and validate pairing flow test
- [ ] Write and validate auth flow test
- [ ] Add remaining scenario tests
- [ ] Integrate into CI pipeline
