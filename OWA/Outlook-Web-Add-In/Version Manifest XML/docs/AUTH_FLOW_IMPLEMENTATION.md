# Authentication Flow — Implementation Guide

> Written: March 12, 2026 — Updated: June 23, 2026

---

## Implementation Status (June 23, 2026)

| # | Component | Who | Status |
|---|-----------|-----|--------|
| — | WebRTC connection infrastructure (`SipClient`, `WebRTCConnectionManager`, `WebRTCDataChannelService`) | Add-in | ✅ Done |
| — | Post-connection auth via WebRTC data channel (username/password, temporary) | Add-in | ✅ Done (to be replaced) |
| — | Token encryption (AES-GCM), refresh, expiry (`TokenService`) | Add-in | ✅ Done |
| — | Redux auth state (`authSlice`) | Add-in | ✅ Done |
| — | Idle monitoring (auto-disconnect) | Add-in | ✅ Done |
| — | `<WebApplicationInfo>` in `manifest.xml` | Add-in | ✅ Done — Client ID `34d7bfcf-cabc-4a16-a380-f12a6103efbe` |
| — | Azure App Registration — Application ID URI + `access_as_user` scope + Office pre-auth + token v2 | Admin | ✅ Done |
| — | `manifest.localhost.xml` for localhost SSO dev testing | Add-in | ✅ Done — App ID `03310f88-5e4a-4a06-ad27-584c485d3fb9` |
| 1 | `OfficeRuntime.auth.getAccessToken()` — `OfficeAuthService` | Add-in | ✅ Done |
| 1 | `oid` / `officeToken` fields in `IAuthState` + `authSlice` reducers | Add-in | ✅ Done |
| 1 | `advokatToken` field in `IAuthState` + `authSlice` (session memory only) | Add-in | ✅ Done |
| 2 | **Pairing API** — deployed at `https://advokat-addin-pairing.azurewebsites.net` | Pairing API | ✅ Done |
| 2 | `GET /addin/server-id` — `PairingApiService.checkServerId()` (returning user check) | Add-in | ✅ Done |
| 2 | `POST /addin/pair` — `PairingApiService.pair(otp, officeToken)` (first-time OTP submit) | Add-in | ✅ Done |
| 2 | **`pairingSlice`** — Redux state: `unknown / checking / paired / unpaired / error` | Add-in | ✅ Done |
| 2 | Pairing check wired into `App.tsx` startup (token → check → dispatch) | Add-in | ✅ Done |
| 3 | OTP generation + display window | ADVOKAT Desktop Client | ✅ Done |
| 4 | `PairingDialog.tsx` — OTP input UI, live submit, error display | Add-in | ✅ Done |
| 5 | WebRTC connection uses `advokatServerId` from `pairingSlice` for routing | Add-in | ✅ Done |
| 6 | `sendAuthMessage(officeToken)` in `webRTCApiService` (returning users, post-connect auth) | Add-in | ✅ Done |
| 7 | Replace password-based `performAuthentication` with `sendAuthMessage` flow | Add-in | ✅ Done (June 24, 2026) |

**Corrected pairing flow (confirmed June 21, 2026):**
- OTP goes to **Pairing API** via `POST /addin/pair` (HTTP) — **not** through WebRTC
- Pairing API returns `advokatServerId` → Add-in uses it to route the WebRTC connection
- `sendRegisterOtpMessage()` (WebRTC data channel) was removed — incorrect assumption

**`advokatServerId` routing implementation (June 23, 2026):**
- `advokatServerId` is **not** sent as a separate field — it is sent the same way the SIP `"To"` field already was: as `sipConfig.toDisplayName`, which `MessageFactory.createRegisterMessage()` writes into the REGISTER message's `To:` header (`To: "${toDisplayName}" <${buildSipUri(toDisplayName)}>`).
- `setAdvokatServerId(serverId)` (new, in `src/config/runtimeConfig.ts`) patches `toDisplayName` at runtime, mirroring the existing `setUserIdentifier()` pattern used for `fromDisplayName`.
- In `App.tsx`, a `useEffect` watches `selectAdvokatServerId` (Redux, `pairingSlice`). As soon as it resolves — whether immediately for returning users (`checkServerId()`) or after the OTP dialog for first-time users (`pair()`) — it calls `setAdvokatServerId()` and only then `WebRTCConnectionManager.initialize()`. This guarantees the REGISTER message's `To:` header always carries the correct ADVOKAT Server ID instead of the static `"macs"` default.
- No changes were needed in `Registration.ts`, `MessageFactory.ts`, or `SipClient.ts` — they already read `toDisplayName` generically from `sipConfig`.

**Next steps:**
1. Replace `performAuthentication()` with `sendAuthMessage(officeToken)` for the post-connect auth step

---

## Overview

The authentication uses a **one-time pairing** approach:
- **First time:** User enters OTP from ADVOKAT Desktop Client → `POST /addin/pair` → returns `advokatServerId` → WebRTC connects to that server.
- **Every time after:** `GET /addin/server-id` returns the stored `advokatServerId` silently — no user interaction.

**Storage decisions (agreed with team leader):**
- `advokatToken` is **never persisted** — it lives only in WebRTC session memory and is re-fetched on every session start.
- `advokatServerId` is stored by the **Pairing API** as an `oid ↔ advokatServerId` mapping.
- OTP codes are held **in RAM only** on the ADVOKAT Server — no database table needed.
- The add-in stores **nothing** locally.

---

## Part 1: First-Time Registration (OTP Pairing)

### Step 1 — Add-in starts, calls `getAccessToken()`

**What happens:**
The add-in calls Office's built-in identity API. Office returns a JWT token signed by Microsoft containing the user's permanent ID (`oid`) and other claims.

**Implementation (Add-in side — TypeScript):**
```typescript
const officeToken = await OfficeRuntime.auth.getAccessToken({
allowSignInPrompt: true,   // show sign-in if user is not signed into Office
allowConsentPrompt: true,  // show consent dialog on first use
forMSGraphAccess: false
});
// officeToken is a string like "eyJ0eXAiOiJKV1Qi..."
```

**What `officeToken` contains (decoded):**
```json
{
"oid": "a7f3c291-4b2e-4d8a-9c12-0e1f2a3b4c5d",  // permanent user ID — never changes
"preferred_username": "jsmith@lawfirm.com",
"exp": 1741600000                                  // expires in ~1 hour, auto-renewed
}
```

**Prerequisite:** The add-in must be registered in Microsoft Entra ID first (see Appendix A).

---

### Step 2 — Add-in queries Live.Server for existing registration

**What happens:**
The add-in sends the Office token to Live.Server. Live.Server validates it, extracts `oid`, and looks up whether an `advokatServerId` is already linked to this user.
If not found → first-time setup. If found → skip to Part 2.

**Implementation (Add-in side):**
```typescript
const res = await fetch('https://live.advokat.at/addin/serverId', {
headers: { Authorization: `Bearer ${officeToken}` }
});

if (res.status === 404) {
// First time — show OTP registration dialog
showRegistrationDialog();
} else {
const { advokatServerId } = await res.json();
// Already registered — proceed to WebRTC connection (Part 2)
}
```

**Implementation (Live.Server side):**
- Validate Office token via JWKS → extract `oid`
- Look up `oid` in `addin_oid_serverid` table
- Return `{ advokatServerId }` or `404`

---

### Step 3 — ADVOKAT Desktop Client generates an OTP

**What happens:**
The logged-in SB opens a pairing window in the ADVOKAT desktop client. The server generates a short random code tied to that SB.

**Implementation (ADVOKAT Server side):**
```
OTP properties:
- Random alphanumeric string, e.g. "X7K2-M9P4"  (short enough to type)
- Linked to: current logged-in SB
- Stored in RAM only — no database table needed
- Valid for: duration the window is open + 10 minutes
- Single-use: removed from memory immediately after first use
- Contains (optionally embedded): the ADVOKAT Server ID
```

The OTP is displayed in the ADVOKAT Client window. The user copies it.

---

### Step 4 — User enters the OTP in the Add-in

**What happens:**
The add-in shows a registration dialog with a single text field. The user pastes the OTP.

**Implementation (Add-in side):**
- Show a simple input dialog: *"Open the ADVOKAT Client, go to Tools → Outlook Add-in Registration, and paste the code shown there."*
- On submit: proceed to Step 5.

---

### Step 5 — Add-in establishes WebRTC connection using the OTP

**What happens:**
The OTP (or the embedded Server ID within it) tells the Signaling Server which ADVOKAT Server to connect to.

**Implementation (Add-in side):**

5a. Get ICE candidates from STUN/TURN:
```typescript
const iceServers = [{ urls: 'stun:stun.advokat.at:3478' }];
const peerConnection = new RTCPeerConnection({ iceServers });
```

5b. Send REGISTER to Signaling Server:
```typescript
signalingSocket.send(JSON.stringify({
type: 'REGISTER',
officeToken,
advokatServerId: extractServerIdFromOtp(otp),  // or user manually entered
otp                                             // forwarded to ADVOKAT Server
}));
```

**Implementation (Signaling Server side):**
- Extract `advokatServerId` from the REGISTER message
- Look up `advokatServerId` in its customer table → find relay address
- Proceed with WebRTC SDP handshake between Add-in and API Relay

> Note: The Signaling Server does **not** validate the Office token. Token validation is the responsibility of the ADVOKAT Server (see Step 7 and Appendix B).

---

### Step 6 — WebRTC tunnel established

**What happens:**
The add-in and the API Relay (on the customer's ADVOKAT Server) are now connected peer-to-peer via WebRTC. No HTTP port needs to be open on the customer side.

**Implementation:**
This is handled by the existing WebRTC/SIP infrastructure already in the codebase (`SipClient.ts`, `Peer2PeerConnection.ts`). No new code needed here beyond the changes in Step 5.

---

### Step 7 — Add-in sends OTP + Office token through the tunnel

**What happens:**
Through the established WebRTC data channel, the add-in sends the OTP and the Office token directly to the ADVOKAT Server.

**Implementation (Add-in side):**
```typescript
dataChannel.send(JSON.stringify({
type: 'REGISTER_OTP',
otp: userEnteredOtp,
officeToken
}));
```

**Implementation (ADVOKAT Server side — API Relay receives and forwards to Advokat API):**
1. Receive `{ otp, officeToken }`
2. Validate OTP → find the linked SB (OTP is in RAM)
3. Validate `officeToken` signature via JWKS (see Appendix B)
4. Extract `oid` from the validated token
5. Store permanently: `oid → SB` (in the existing credentials/token table — discuss structure with SH)
6. Register `oid ↔ advokatServerId` on Live.Server (ADVOKAT Server makes this call, not the add-in)
7. Remove OTP from RAM (single use)
8. Return `{ advokatToken }` through the WebRTC tunnel

---

### Step 8 — Add-in holds the Advokat token in session memory

**What happens:**
The `advokatToken` received through the tunnel is held in memory for the lifetime of this WebRTC session only. It is never written to disk or `localStorage`.
The `oid ↔ advokatServerId` mapping is already registered on Live.Server by the ADVOKAT Server in Step 7.

**Implementation (Add-in side):**
```typescript
// Store token in module-level variable — in memory only
let currentAdvokatToken: string = receivedAdvokatToken;
// Token is lost when the add-in is closed; a fresh one is fetched next session (Part 2, Step 4)
```

Registration complete. The user will never see the OTP dialog again on any device.

---

## Part 2: Every Subsequent Session (Returning User)

### Step 1 — Add-in starts, calls `getAccessToken()`

Same as Part 1 Step 1. Returns a fresh Office token silently — no user interaction.
The `oid` inside the token is always the same permanent value.

---

### Step 2 — Add-in queries Live.Server for `advokatServerId`

```typescript
const res = await fetch('https://live.advokat.at/addin/serverId', {
headers: { Authorization: `Bearer ${officeToken}` }
});

if (res.status === 404) {
// No mapping found (new device or first time) — fall back to OTP registration
showRegistrationDialog();
return;
}

const { advokatServerId } = await res.json();
```

This works on any device — the mapping is stored centrally on Live.Server, not on the machine.

---

### Step 3 — Add-in establishes WebRTC connection

Same as Part 1 Step 5, except:
- No OTP needed
- REGISTER message contains only `officeToken` and `advokatServerId`

---

### Step 4 — Add-in authenticates with ADVOKAT Server via tunnel

```typescript
dataChannel.send(JSON.stringify({
type: 'AUTH',
officeToken
}));
```

ADVOKAT Server:
1. Validates Office token via JWKS
2. Extracts `oid`
3. Looks up `oid → SB`
4. Returns fresh `{ advokatToken }` through the tunnel

The add-in holds `advokatToken` in memory only for this session. Session active. User sees no login prompt at any point.

---

## Open Questions

1. ~~**`advokatServerId` embedded in OTP**~~ — **Resolved (June 23, 2026).** Not embedded in the OTP. The Pairing API resolves `advokatServerId` (via `checkServerId()` or `pair()`) before the WebRTC connection is started; `App.tsx` patches it into `sipConfig.toDisplayName` via `setAdvokatServerId()`, so it reaches the Signaling Server in the REGISTER message's `To:` header — see "`advokatServerId` routing implementation" above.

2. **`oid_mapping` table structure** 
The team leader confirmed a general-purpose credentials table for SB-linked external tokens already planned. Structure (display text, type, secret/oid, creation date, login log with client IPs and timestamps) to be defined with SH.

---

## Appendix A — Entra ID Registration (One-Time Setup)

Required before `getAccessToken()` works. Done once by the Azure admin.

**Known values (confirmed June 8, 2026):**
- Application (client) ID: `34d7bfcf-cabc-4a16-a380-f12a6103efbe`
- Tenant ID: `7bcbfb56-7264-4bc6-b679-3b98e704e7db`
- Add-in hosted at: `https://green-sea-08a52e81e.2.azurestaticapps.net`
- Application ID URI (required): `api://green-sea-08a52e81e.2.azurestaticapps.net/34d7bfcf-cabc-4a16-a380-f12a6103efbe`

**Checklist:**

| Step | Description | Status |
|------|-------------|--------|
| 1 | App Registration exists in Azure Entra ID | ✅ Client ID + Tenant ID received from admin |
| 2 | Application ID URI set to `api://green-sea-08a52e81e.2.azurestaticapps.net/34d7bfcf-cabc-4a16-a380-f12a6103efbe` | ❓ Needs admin confirmation |
| 3 | Scope `access_as_user` exposed under "Expose an API" | ❓ Needs admin confirmation |
| 4 | Office client apps pre-authorized (Outlook GUID: `d3590ed6-52b3-4102-aeff-aad2292ab01c`, OWA GUID: `bc59ab01-8403-45c6-8796-ac3ef710b3e3`) | ❓ Needs admin confirmation |
| 5 | `<WebApplicationInfo>` added to `manifest.xml` | ✅ Done (June 8, 2026) |

**Current `manifest.xml` block:**
```xml
<WebApplicationInfo>
<Id>34d7bfcf-cabc-4a16-a380-f12a6103efbe</Id>
<Resource>api://green-sea-08a52e81e.2.azurestaticapps.net/34d7bfcf-cabc-4a16-a380-f12a6103efbe</Resource>
<Scopes>
<Scope>openid</Scope>
<Scope>profile</Scope>
<Scope>offline_access</Scope>
</Scopes>
</WebApplicationInfo>
```

Reference: [Register an Office Add-in with Microsoft identity platform](https://learn.microsoft.com/en-us/office/dev/add-ins/develop/register-sso-add-in-aad-v2)

---

## Appendix B — JWKS Token Validation (ADVOKAT Server)

The ADVOKAT Server validates the Office token before trusting it. This step happens in Step 7 (OTP pairing) and Step 4 (returning user).

**What JWKS is:** Microsoft publishes its public signing keys at:
```
https://login.microsoftonline.com/common/discovery/v2.0/keys
```
Any server can fetch these keys and verify that a token was genuinely signed by Microsoft.

**Steps:**
1. Decode token header → read `kid` (Key ID)
2. Fetch the matching public key from the JWKS URL (cache it — keys rarely change)
3. Verify the token's RS256 signature using that key
4. Check claims:
- `aud` = your Application ID URI
- `exp` > current time (not expired)
- `appid` = your Add-in Client ID

**.NET implementation:**
```csharp
var configManager = new ConfigurationManager<OpenIdConnectConfiguration>(
"https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
new OpenIdConnectConfigurationRetriever());

var config = await configManager.GetConfigurationAsync();

var handler = new JwtSecurityTokenHandler();
var principal = handler.ValidateToken(officeToken, new TokenValidationParameters {
ValidAudience   = "api://advokat-connect.azurestaticapps.net/<client-id>",
IssuerSigningKeys = config.SigningKeys
}, out _);

var oid = principal.FindFirst("oid")?.Value;
```

Reference: [Validate tokens](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens#validate-tokens)

---

## Appendix C — Add-in Installation

| Scenario | Method |
|----------|--------|
| Law firm with M365 Business | IT admin uploads `manifest.xml` via [admin.microsoft.com](https://admin.microsoft.com) → Integrated Apps → applies to all users automatically |
| Individual user (any Office license) | User installs manually: Outlook → Get Add-ins → My Add-ins → Add from file → upload `manifest.xml` |
| Public release | Publish to [Microsoft AppSource](https://appsource.microsoft.com) — requires Microsoft review |

> **Note:** Outlook add-ins require Exchange Online or Exchange Server 2016+.
> Users on POP3/IMAP mail accounts cannot use Outlook add-ins regardless of Office license.
