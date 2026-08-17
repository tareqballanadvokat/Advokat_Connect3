# ADVOKAT Outlook Add-In — Client & Account Prerequisites

> Audience: Customer success / onboarding, IT admins at customer law firms.
> Source: `manifest.xml`, `OfficeAuthService.ts`, `AUTH_FLOW_IMPLEMENTATION.md`, `defaults.ts` (as of 2026-08-05).

## Why this document exists

The add-in signs users in using **Office SSO** (`OfficeRuntime.auth.getAccessToken()`), not a
separate login screen. This is convenient when it works, but it quietly depends on two things
that are *not* true for every Outlook user:

1. The user is signed into Outlook with a **Microsoft Entra ID (Azure AD) work or school account** —
   not a personal Microsoft account, and not a mailbox with no Microsoft identity at all.
2. The mailbox is hosted on **Exchange Online**, or an **on-premises Exchange server configured for
   Hybrid Modern Authentication** against that same Entra ID tenant.

If either condition is false, `getAccessToken()` fails outright — there is no Microsoft identity
token for the add-in to request, regardless of add-in configuration. This is the technical
reason behind both points raised: account type, and on-prem vs. online Exchange.

---

## 1. Account type: Entra ID (work/school) required

Office Add-in SSO can only issue a token when Outlook itself is signed in with an **organizational
account** (`user@company.com` backed by Microsoft Entra ID / Azure AD). Two other cases exist and
both fail:

| Account type | Example | SSO result |
|---|---|---|
| Work or school account (Entra ID) | `jsmith@lawfirm.com` on a Microsoft 365 / Entra ID tenant | ✅ Works |
| Personal Microsoft account | `jsmith@outlook.com`, `jsmith@hotmail.com` | ❌ Fails — error `13003` (unsupported user type) |
| Non-Microsoft identity (e.g. plain IMAP/POP account added to Outlook, no Microsoft sign-in) | A mailbox added to Outlook without ever signing into a Microsoft account | ❌ No token issuer exists at all |

**Takeaway:** the add-in needs the *Outlook client* itself to be signed in against Entra ID —
this is a property of how the customer's Outlook profile was set up, independent of which mail
server actually stores the messages.

---

## 2. Mailbox backend: Exchange Online or Hybrid Modern Auth

Even with a valid Entra ID sign-in, the mailbox backend has to be able to participate in modern
(OAuth) authentication for SSO to succeed:

| Backend | SSO support | Notes |
|---|---|---|
| **Exchange Online** (Microsoft 365) | ✅ Works | Standard case — tenant is already Entra ID-native. |
| **On-premises Exchange, Hybrid Modern Authentication (HMA) configured** | ✅ Works | Requires the customer's on-prem Exchange to be federated with Entra ID via Hybrid Modern Auth (Azure AD Connect + HMA enabled). This is an IT-side configuration project, not a toggle in Outlook. |
| **On-premises Exchange, Basic/NTLM auth only, no Entra ID tie-in** | ❌ Fails | This is the "pure domain user" case: Outlook connects with a Windows domain identity against on-prem Exchange, and there is no Microsoft Entra ID token issuer involved anywhere. `getAccessToken()` has nothing to call. |

**Takeaway:** "domain user on an on-premises Exchange server" is only a blocker if that on-prem
environment has *not* been hybrid-joined to Entra ID with Modern Authentication. Many on-prem
shops never set this up, since it's an optional hybrid identity project — so this should be
treated as a genuine prerequisite, not an edge case.

---

## 3. Outlook client / host requirements

The manifest declares Requirement Set `Mailbox 1.7` (`manifest.xml`), which sets a floor on
supported Outlook clients:

- Outlook on Windows: 2016 or later (Click-to-Run recommended; some older MSI/volume-license
  builds lag behind on requirement-set support and should be verified against Microsoft's
  [requirement set support matrix](https://learn.microsoft.com/office/dev/add-ins/reference/requirement-sets/outlook-api-requirement-sets)).
- New Outlook for Windows: supported.
- Outlook on the web: supported (mailbox must still meet the backend requirement above).
- Outlook on Mac: 2016 or later; SSO specifically requires Outlook for Mac 16.x+ (older Mac builds
  do not support `getAccessToken()` at all — error `13012`).
- Outlook mobile (iOS/Android): supported, subject to the same account/backend prerequisites.

---

## 4. Tenant admin step (one-time, per customer)

Because the add-in uses `WebApplicationInfo` (Office SSO / nested app auth) with an Entra ID app
registration, a tenant admin at the customer needs to **consent** to the add-in's Azure app the
first time it's used org-wide (or an end user needs to consent individually, if the tenant allows
user consent). Without this consent, sign-in will prompt repeatedly or fail with a permissions
error. This is a one-time step per customer tenant, done by their IT admin.

---

## 5. Compatibility summary

| | Entra ID (work/school) account | Personal MS account / no MS identity |
|---|---|---|
| **Exchange Online** | ✅ Fully supported | ❌ Not supported |
| **On-prem Exchange + Hybrid Modern Auth** | ✅ Fully supported | ❌ Not supported |
| **On-prem Exchange, legacy auth only** | ❌ Not supported (no Entra ID token issuer) | ❌ Not supported |

Only the top-left cell works out of the box. The middle-left cell works, but requires the
customer's IT team to have Hybrid Modern Authentication set up — this is worth confirming
*before* onboarding a customer with an on-prem mail environment.

---

## 6. What the customer sees when a prerequisite is missing

The add-in surfaces the underlying Office error code; the most common ones map like this:

| Code | Meaning | Root cause |
|---|---|---|
| `13001` | User not signed into Office | Outlook not signed in with any Microsoft account |
| `13002` | Consent required | Tenant/user hasn't approved the add-in's permissions yet — see §4 |
| `13003` | Unsupported user type | Personal Microsoft account, not a work/school account |
| `13004` | App not registered in Entra ID | Config issue on our side, not the customer's — should not occur in production |
| `13012` | Environment doesn't support SSO | Old Outlook build (e.g. legacy Outlook for Mac), or backend without modern auth |

Support/onboarding should use this table to distinguish "customer environment isn't eligible yet"
from "something is actually broken."

---

## 7. Network / firewall requirements

Entra ID sign-in and Exchange Online are necessary but not sufficient — the add-in also opens a
**WebRTC tunnel** from the user's machine to the customer's ADVOKAT Server (via a relay), separate
from the identity check. Even a user who passes every check in §1–§5 will fail to connect if the
network blocks the traffic this requires:

| Destination | Purpose | Protocol |
|---|---|---|
| `addin.advokat.at` | Hosts the task pane itself (`taskpane.html`, `commands.html`, icons) | HTTPS (443) |
| Pairing API (`advokat-addin-pairing.azurewebsites.net`) | Device/server-id lookup, OTP pairing, Office-token exchange | HTTPS (443) |
| SIP signaling server | WebSocket signaling for the WebRTC handshake | WSS (443) |
| STUN server (`stun.l.google.com:19302`) | ICE candidate discovery for peer-to-peer WebRTC | STUN/UDP |
| TURN server (Advokat Azure relay) | Fallback relay when direct peer-to-peer fails | TURN/UDP+TCP |

**Why this matters:** many corporate firewalls and web-filtering proxies (Zscaler, Netskope, and
similar) restrict outbound traffic to HTTP(S) only and block arbitrary UDP — which breaks STUN/TURN
and therefore WebRTC, even though the HTTPS calls to the same customer succeed fine. This failure
mode looks nothing like an SSO error: identity checks pass, but the connection to the ADVOKAT
Server never establishes. TLS-inspecting proxies can also cause failures if `addin.advokat.at` and
the Pairing API domain aren't allow-listed.

**Client-side note:** desktop Outlook's task pane renders via the WebView2 runtime on Windows.
Locked-down corporate images that lack WebView2 (or block its installation) will fail to load the
task pane at all, independent of any auth or network issue above.

**Takeaway:** this is a distinct failure category from account type / mailbox backend — a network
question, not an identity question. It should be checked separately during onboarding, since it is
otherwise very difficult to diagnose from the customer's side (nothing points at "firewall").

---

## 8. Admin checklist — questions to ask before onboarding a customer

Before rolling out the add-in to a new customer, the Admin department must get answers to the
following questions and record them per customer:

1. **"Does your organization use Microsoft 365 (Exchange Online), or is your mailbox hosted on
   your own Exchange server?"**
   - If on-premises → follow up: **"Has your IT team set up Hybrid Modern Authentication /
     Azure AD Connect for your Exchange environment?"**

2. **"When you open Outlook, do you sign in with your work email through your company, or is it
   a personal @outlook.com / @hotmail.com account?"**
   - Only company (Entra ID) accounts work.

3. **"Does your organization's firewall or proxy restrict outbound network traffic — for example,
   allowing only HTTP/HTTPS and blocking other protocols like UDP or WebRTC?"**
   - If yes, or unsure → flag to IT to allow-list `addin.advokat.at`, the Pairing API domain, and
     outbound STUN/TURN traffic (see §7) before rollout.

If the answer to any question is **"no"** or **"not sure,"** flag the account to IT before
rollout — the add-in will not authenticate or connect for that user until the prerequisite is met.
