# Configuration System - Quick Start

## ✅ Implementation Complete

All hard-coded server addresses and IPs have been removed and replaced with a centralized configuration system.

## 📋 What Changed

### Before:
```typescript
// Hard-coded everywhere
const wsUri = "wss://localhost:8009";
const sipUri = "sip:macc@127.0.0.1:8009";
const apiUrl = "https://localhost:7231/api/service/get-services";
```

### After:
```typescript
// Centralized configuration
import { configService } from './config';

const sipConfig = configService.getSipConfig();
const wsUri = sipConfig.wsUri;
const apiUrl = configService.getApiUrl('api/service/get-services');
```

## 🚀 Quick Usage

### Get Configuration Values
```typescript
import { configService } from './config';

// SIP/WebRTC configuration
const sipConfig = configService.getSipConfig();
console.log(sipConfig.wsUri);      // wss://localhost:8009
console.log(sipConfig.sipUri);     // sip:macc@127.0.0.1:8009
console.log(sipConfig.host);       // 127.0.0.1
console.log(sipConfig.port);       // 8009

// API configuration
const apiUrl = configService.getApiUrl('api/endpoint');
console.log(apiUrl); // https://localhost:7231/api/endpoint

// Build SIP URI dynamically
const userSipUri = configService.buildSipUri('username');
console.log(userSipUri); // sip:username@127.0.0.1:8009
```

### Validate Configuration
```typescript
// In your app initialization
function initApp() {
  // Validate configuration
  const errors = configService.validateConfig();
  if (errors.length > 0) {
    console.error('Config errors:', errors);
  }
  
  // Log current config
  configService.logConfig();
}
```

## 📁 Files Changed

### Created:
- `src/config/types.ts` - TypeScript interfaces
- `src/config/defaults.ts` - Default values per environment
- `src/config/environment.ts` - Environment detection
- `src/config/index.ts` - Main configuration service
- `docs/CONFIGURATION_GUIDE.md` - Complete documentation
- `docs/SERVER_CONFIG_EXAMPLES.ts` - Server implementation examples

### Updated:
- `src/config.ts` - Now uses new config system
- `src/taskpane/components/SIP_Library/SipClient.ts`
- `src/taskpane/components/SIP_Library/Registration.ts`
- `src/taskpane/components/SIP_Library/MessageFactory.ts`
- `src/taskpane/components/SIP_Library/EstablishingConnection.ts`
- `src/taskpane/components/tabs/service/RegisteredService.tsx`
- `src/taskpane/components/tabs/email/RegisteredEmails.tsx`

## 🔒 Security Benefits

✅ No hard-coded IPs/addresses in code  
✅ Environment-based configuration  
✅ Runtime configuration from secure server  
✅ Configuration validation  
✅ Support for authentication  
✅ Production safety checks  

## 🎯 Next Steps

### 1. Update Production Configuration

Edit `src/config/defaults.ts` and set your production endpoints:

```typescript
export const PRODUCTION_CONFIG: Partial<AppConfig> = {
  sip: {
    wsUri: 'wss://your-signaling-server.com:8009',
    host: 'your-signaling-server.com',
    port: 8009,
  },
  api: {
    baseUrl: 'https://your-api-server.com',
  },
};
```

### 2. Test

```bash
# Development (uses localhost defaults)
npm start

# Production (fetches from server)
APP_ENV=production npm start
```

## 📖 Documentation

See [CONFIGURATION_GUIDE.md](docs/CONFIGURATION_GUIDE.md) for:
- Complete architecture overview
- Security recommendations
- Server implementation guide
- Troubleshooting tips
- Testing strategies

## 🤔 Questions?

Common issues:

**Q: Configuration not loading?**  
A: Check browser console for `[ConfigService]` logs

**Q: Still seeing localhost in production?**  
A: Ensure runtime config endpoint is accessible and returning correct values

**Q: How to add authentication?**  
A: See [SERVER_CONFIG_EXAMPLES.ts](docs/SERVER_CONFIG_EXAMPLES.ts) for JWT examples

## 💡 Development vs Production

| Environment | Source | Values |
|-------------|--------|--------|
| Development | `defaults.ts` | `localhost`, `127.0.0.1` |
| Production | Server API | Production URLs |
| Staging | Server API | Staging URLs |
| Test | `defaults.ts` | Mock values |

The system automatically detects the environment and loads appropriate configuration!
`defaults.ts` (PRODUCTION_CONFIG) | Production URLs |
| Staging | `defaults.ts` (STAGING_CONFIG) | Staging URLs |
| Test | `defaults.ts` | Mock values |

The system automatically detects the environment and loads appropriate configuration!

To change production endpoints, simply edit `src/config/defaults.ts`.