# Configuration Guide

## How deployment works

The build runs in **GitHub Actions CI**. On every push to `main`, the workflow:
1. Installs dependencies (`npm ci`)
2. Builds the app (`npm run build`) with secrets injected as environment variables
3. Uploads the compiled `dist/` to Azure Static Web Apps

Azure does **not** run webpack itself — `skip_app_build: true` tells the SWA action to upload `dist/` directly.  
This means **Azure App Settings have no effect** on any of the variables below. They must be set as **GitHub Secrets**.

---

## Environment variables

All variables are consumed by webpack `DefinePlugin` at build time and baked into the JS bundle.

| Variable | Description | Example |
|---|---|---|
| `SIP_WS_URI` | WebSocket URI of the SIP signaling server. `host`, `port`, and `sipUri` are derived automatically. | `wss://4.232.250.132:443` |
| `DEVEXTREME_LICENSE_KEY` | DevExtreme UI component license key (base64 string from the DevExtreme portal). | *(base64 string)* |
| `TURN_USERNAME` | Username for TURN server authentication. | `turnuser` |
| `TURN_CREDENTIAL` | Password/credential for TURN server authentication. | `turnpassword` |
| `AZURE_TENANT_ID` | Azure tooling only — not used at runtime by the add-in. | `xxxxxxxx-...` |

The TURN server URLs (`turn:108.143.154.176:3478` and `turns:108.143.154.176:5349`) are hardcoded in `defaults.ts` — only the credentials are secrets.

The caller identity (`fromDisplayName`) is **not** configured here — it is set at runtime after the user's identity is resolved (see `runtimeConfig.ts`).

---

## GitHub Secrets (required for CI deployment)

In the GitHub repository go to **Settings → Secrets and variables → Actions** and add:

| Secret name | Value |
|---|---|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_GREEN_SEA_08A52E81E` | Deployment token from Azure Portal → Static Web App → Manage deployment token |
| `SIP_WS_URI` | e.g. `wss://4.232.250.132:443` |
| `DEVEXTREME_LICENSE_KEY` | License key from DevExtreme portal |
| `TURN_USERNAME` | TURN server username |
| `TURN_CREDENTIAL` | TURN server password |

---

## Running locally (development)

1. **Copy `.env.example` to `.env`** in the project root (`.env` is git-ignored):

   ```
   AZURE_TENANT_ID=your-tenant-id
   DEVEXTREME_LICENSE_KEY=your-key-here
   SIP_WS_URI=wss://4.232.250.132:443
   TURN_USERNAME=your-turn-username
   TURN_CREDENTIAL=your-turn-password
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the dev server:**

   ```bash
   npm start
   ```

4. **Build for production locally** (optional — CI does this automatically):

   ```bash
   npm run build
   ```

---

## How to push changes to deploy

The personal test repository (`https://github.com/tareqballanadvokat/Advokat_Connect3`) uses a separate git history. Changes must be copied from the project folder and committed there.

A temp git repo lives at `%TEMP%\addin_clean_push`. Use this workflow to push any change:

```powershell
$src = "C:\AdvokatConnect\ADVOKAT_Connect\OWA\Outlook-Web-Add-In\Version Manifest XML"
$tmp = "$env:TEMP\addin_clean_push"

# Copy the changed file(s) — add more Copy-Item lines as needed
Copy-Item "$src\src\config\defaults.ts" "$tmp\src\config\defaults.ts" -Force

# Stage, commit and push
cd $tmp
git add .
git commit -m "your commit message here"
git push personal HEAD:main
```

**Notes:**
- Every push to `main` triggers the GitHub Actions workflow automatically.
- The workflow builds the app with the GitHub Secrets and deploys to Azure.
- To push multiple changed files, add one `Copy-Item` line per file before `git add .`.
- `.env` is never copied — it contains local secrets and must stay git-ignored.

---

## How values flow through the app

```
GitHub Secrets  (injected by CI during npm run build)
      │
      ▼
webpack DefinePlugin  (baked into dist/ bundle at build time)
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
      │         ├─ getSipConfig()  → SIP client
      │         └─ runtimeConfig.setUserIdentifier(email)
      │                  patches fromDisplayName + sipUri at runtime after auth
      │
      ├─ process.env.DEVEXTREME_LICENSE_KEY
      │         ▼
      │   taskpane/index.tsx → config({ licenseKey })
      │
      └─ process.env.TURN_USERNAME / TURN_CREDENTIAL
                ▼
          defaults.ts → DEFAULT_CONFIG.webrtc.iceServers
                ▼
          WebRTC PeerConnection ICE configuration
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
