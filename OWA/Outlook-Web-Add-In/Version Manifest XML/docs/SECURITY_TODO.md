# Security TODO

Findings from a codebase security review (2026-07-23). Ranked by severity.

## HIGH

- [ ] **Stop logging sensitive data (tokens, PII) to the browser console in production**
  - `src/config/defaults.ts` — `DEFAULT_CONFIG.logging` sets `level: LogLevel.DEBUG, enabled: true`, and `getEnvironmentConfig()` (`src/config/environment.ts`) uses `DEFAULT_CONFIG` for every non-test environment, including production.
  - `src/services/webRTCApiService.ts` — multiple `logger.debug(...)` calls log the full outgoing `protocolRequest` (includes the `Authorization: Bearer <token>` header) and fully decoded response bodies (case/person/service/document data).
  - Fix: default production logging to `WARN`/`ERROR` (or `NONE`); never log full request/response objects containing `Authorization` headers or response bodies — log metadata only (message type, status code, sizes).

## MEDIUM

- [ ] **Move TURN credentials out of committed source and into the existing env-injection path**
  - `src/config/defaults.ts` (`webrtc.iceServers`) hardcodes a literal TURN username/credential for `free.expressturn.com` instead of using `process.env.TURN_USERNAME` / `process.env.TURN_CREDENTIAL`.
  - `webpack.config.js` already wires up `DefinePlugin` for `TURN_USERNAME` / `TURN_CREDENTIAL` — it's just unused.
  - Longer term, per `docs/CONFIGURATION_README.md` / `TURN_SERVER_DEPLOYMENT.md`: implement a `/api/turn-credentials` endpoint issuing short-lived TURN credentials instead of a static shared secret.

- [ ] **Add security headers to the deployed app**
  - `staticwebapp.config.json` only sets `Cache-Control` — no `Content-Security-Policy`, `X-Content-Type-Options`, or `frame-ancestors`.
  - Add a `globalHeaders` block: CSP restricting `connect-src`/`script-src` to known origins (Azure Static Web App + WSS SIP endpoint), `X-Content-Type-Options: nosniff`, and `frame-ancestors` scoped to Outlook's hosts (e.g. `https://outlook.office.com`, `https://outlook.live.com`) since the taskpane is legitimately framed by Outlook.

## LOW

- [ ] **Remove dead legacy password-grant credentials state**
  - `src/store/slices/authSlice.ts` — `initialState.credentials` hardcodes `grant_type: "password"`, `client_secret: "TestClientId"`, `username: "JCH"`. No `.tsx` component wires up `setCredentials`/`setUsername`/`setPassword` to any UI — appears to be dead code from an earlier auth flow. Delete it so a stale placeholder secret can't be resurrected accidentally.

## Confirmed OK (no action needed)

- Office SSO token and ADVOKAT JWT are kept in Redux memory only — never written to `localStorage`/`sessionStorage`.
- No `dangerouslySetInnerHTML`, `eval`, or `new Function` usage found in the component tree.
- SIP message handlers (`Registration.ts`, `Peer2PeerConnection.ts`) validate message format with regex before parsing JSON.
- Source maps are only enabled in dev builds (`webpack.config.js`); the dev-server CORS wildcard is dev-only and not present in production config.
