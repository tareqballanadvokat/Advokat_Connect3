# Configuration Guide

## How deployment works

> **Important:** The build runs **locally**. The compiled `dist/` folder is committed and pushed to the repository. Azure Static Web Apps simply uploads this pre-built output — it does **not** run `npm run build`. This means Azure App Settings have **no effect** on `SIP_WS_URI` or `DEVEXTREME_LICENSE_KEY`. Both must be present in your local `.env` at the time you build.

---

## Environment variables

All variables are consumed by webpack `DefinePlugin` **at local build time** and baked into the JS bundle:

| Variable | Used by | Description |
|---|---|---|
| `SIP_WS_URI` | `defaults.ts` | WebSocket URI of the SIP signaling server. `host`, `port`, and `sipUri` are derived from this automatically. e.g. `wss://your-server.com:443` |
| `DEVEXTREME_LICENSE_KEY` | `taskpane/index.tsx` | DevExtreme UI component license key (base64 string from the DevExtreme portal). |
| `AZURE_TENANT_ID` | Azure tooling only | Not used at runtime. Required by the Azure CLI / pipeline for authentication. |

The caller identity (`fromDisplayName`) is **not** configured here — it is set at runtime after the user's identity is resolved (see `runtimeConfig.ts`).

---

## Running locally (development or building for deployment)

1. **Copy `.env.example` to `.env`** in the project root (`.env` is git-ignored; `.env.example` is committed and safe to read):

   ```
   AZURE_TENANT_ID=your-tenant-id
   DEVEXTREME_LICENSE_KEY=your-key-here
   SIP_WS_URI=wss://your-signaling-server.com:443
   ```

   > For a local signaling server use e.g. `wss://localhost:8009`.

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the dev server** (development only):

   ```bash
   npm start
   ```

4. **Build for deployment:**

   ```bash
   npm run build
   ```

   Webpack reads `.env` via `dotenv` and bakes `SIP_WS_URI` and `DEVEXTREME_LICENSE_KEY` into the bundle. The output goes to `dist/`.

5. **Commit and push `dist/`** — the GitHub Actions workflow uploads it to Azure as-is.

6. **Sideload the add-in** in Outlook using `manifest.xml`.  
   Follow the [Microsoft sideloading guide](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing).

---

## Deploying to Azure Static Web Apps

Because the build is local, Azure App Settings are **not** used for `SIP_WS_URI` or `DEVEXTREME_LICENSE_KEY`. The only secret Azure needs is the deployment token used by the GitHub Actions workflow.

### GitHub Actions secret required

In the GitHub repository go to `Settings → Secrets and variables → Actions` and ensure the following secret exists:

| Secret name | Value |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_GREEN_SEA_08A52E81E` | *(deployment token from Azure Portal → Static Web App → Manage deployment token)* |

The workflow (`.github/workflows/azure-static-web-apps.yml`) already references this token and uploads the pre-built `dist/` folder with `skip_app_build: true`.

---

## How values flow through the app

```
Local .env  (present when developer runs npm run build)
      │
      ▼
webpack DefinePlugin  (build time — values baked into dist/ bundle)
      │
      ├─ process.env.SIP_WS_URI
      │         ▼
      │   defaults.ts → parseSipWsUri()
      │         │  derives: host, port, sipUri
      │         ▼
      │   DEFAULT_CONFIG.sip
      │         ▼
      │   environment.ts → getEnvironmentConfig()
      │         │  stamps detected environment (dev / staging / production)
      │         ▼
      │   ConfigService singleton
      │         │
      │         ├─ getSipConfig()  → SIP client: wsUri, host, port
      │         └─ runtimeConfig.setUserIdentifier(email)
      │                  patches fromDisplayName + sipUri at runtime
      │
      └─ process.env.DEVEXTREME_LICENSE_KEY
                ▼
          taskpane/index.tsx → config({ licenseKey })
```

---

## Notes

- If `SIP_WS_URI` is missing from `.env` at build time, all derived SIP values will be empty strings and the app will log `SIP WebSocket URI is not configured` on startup.
- The add-in communicates with the Advokat backend **peer-to-peer over a WebRTC DataChannel** — no backend URL is needed in the config.
- TURN server credentials must **never** be stored in source code. When needed, implement a backend endpoint that returns short-lived credentials generated from the TURN shared secret.


| Variable | Used by | Description | Example |
|---|---|---|---|
| `SIP_WS_URI` | `defaults.ts` | WebSocket URI of the SIP signaling server. `host`, `port`, and `sipUri` are derived from this automatically. | `wss://your-server.com:443` |
| `DEVEXTREME_LICENSE_KEY` | `taskpane/index.tsx` | DevExtreme UI component license key. | *(base64 string from DevExtreme portal)* |
| `AZURE_SUBSCRIPTION_ID` | Azure tooling / CI only | Not used at runtime by the add-in. Required for Azure CLI/pipeline deployments. | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_TENANT_ID` | Azure tooling / CI only | Not used at runtime by the add-in. Required for Azure CLI/pipeline deployments. | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

The caller identity (`fromDisplayName`) is **not** configured here — it is set at runtime after the user's identity is resolved (see `runtimeConfig.ts`).

---

## Running locally

1. **Copy `.env.example` to `.env`** in the project root (`.env` is git-ignored; `.env.example` is committed and safe to read):

   ```
   AZURE_SUBSCRIPTION_ID=your-subscription-id
   AZURE_TENANT_ID=your-tenant-id
   DEVEXTREME_LICENSE_KEY=your-key-here
   SIP_WS_URI=wss://your-signaling-server.com:443
   ```

   > For a local signaling server, use `wss://localhost:8009` (or the port you configured).

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the dev server:**

   ```bash
   npm start
   ```

   Webpack reads `.env` via `dotenv` and injects `SIP_WS_URI` into the bundle through `DefinePlugin`.

4. **Sideload the add-in** in Outlook using the manifest (`manifest.xml`).  
   Follow the [Microsoft sideloading guide](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing).

---

## Deploying to Azure Static Web Apps

Environment variables are set in the Azure Portal — **never committed to source control**.

### Via Azure Portal

1. Open your **Static Web App** resource.
2. Go to **Settings → Environment Variables**.
3. Add the following entries:

   | Name | Value |
   |---|---|
   | `SIP_WS_URI` | `wss://your-signaling-server.com:443` |
   | `DEVEXTREME_LICENSE_KEY` | *(your license key)* |

   > `AZURE_SUBSCRIPTION_ID` and `AZURE_TENANT_ID` are only needed for CI/CD tooling, not for the SWA runtime.

4. Click **Save**. The next deployment will pick up the values.

### Via Azure CLI

```bash
az staticwebapp appsettings set \
  --name <your-swa-name> \
  --resource-group <your-rg> \
  --setting-names \
      SIP_WS_URI="wss://your-signaling-server.com:443" \
      DEVEXTREME_LICENSE_KEY="your-key-here"
```

> `AZURE_SUBSCRIPTION_ID` / `AZURE_TENANT_ID` are used by the Azure CLI itself (via `az login`), not as `appsettings`.

### Via GitHub Actions (CI/CD pipeline)

Add the variables as **repository secrets** in GitHub:  
`Settings → Secrets and variables → Actions → New repository secret`

| Secret name | Value |
|---|---|
| `SIP_WS_URI` | `wss://your-signaling-server.com:443` |
| `DEVEXTREME_LICENSE_KEY` | *(your license key)* |
| `AZURE_SUBSCRIPTION_ID` | *(your Azure subscription ID)* |
| `AZURE_TENANT_ID` | *(your Azure tenant ID)* |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | *(deployment token from Azure Portal)* |

Then reference them in `.github/workflows/azure-static-web-apps.yml`:

```yaml
- name: Build and Deploy
  uses: Azure/static-web-apps-deploy@v1
  with:
    azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
    app_location: "/"
    output_location: "dist"
  env:
    SIP_WS_URI: ${{ secrets.SIP_WS_URI }}
    DEVEXTREME_LICENSE_KEY: ${{ secrets.DEVEXTREME_LICENSE_KEY }}
```

---

## How the value flows through the app

```
.env / Azure App Settings
        │
        ▼
webpack DefinePlugin (build time)
        │  process.env.SIP_WS_URI → baked into JS bundle
        ▼
defaults.ts → parseSipWsUri()
        │  derives: host, port, sipUri
        ▼
DEFAULT_CONFIG.sip   (used by ConfigService)
        │
        ▼
environment.ts → getEnvironmentConfig()
        │  stamps the detected environment (dev / staging / production)
        ▼
ConfigService (singleton)
        │
        ├─ getSipConfig()       → SIP client uses wsUri, host, port
        └─ runtimeConfig.ts
              └─ setUserIdentifier(email)
                    patches fromDisplayName + sipUri with real user identity
```

---

## Notes

- If `SIP_WS_URI` is not set, all derived SIP values will be empty strings and the app will log a validation error on startup (`SIP WebSocket URI is not configured`).
- The add-in communicates with the Advokat backend **peer-to-peer over a WebRTC DataChannel** — no backend URL is needed in the config.
- TURN server credentials should **never** be stored in source code. Implement a `/api/turn-credentials` endpoint that returns short-lived credentials generated from the TURN shared secret.
