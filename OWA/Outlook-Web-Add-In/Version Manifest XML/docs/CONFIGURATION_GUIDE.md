# Dynamic Configuration System - Implementation Guide

## Overview

The hard-coded server addresses and IPs have been removed and replaced with a centralized, dynamic configuration system. This provides flexibility for different environments (development, staging, production) and allows runtime configuration updates.

## Architecture

### Configuration Structure

```
src/config/
├── types.ts          # TypeScript interfaces and types
├── defaults.ts       # Default configuration values per environment
├── environment.ts    # Environment detection logic
└── index.ts          # Main configuration service (singleton)
```

### Key Features

✅ **Environment-based Configuration** - Automatic detection and appropriate defaults  
✅ **Runtime Configuration** - Fetch endpoints from server during initialization  
✅ **Type Safety** - Full TypeScript support with interfaces  
✅ **Fallback Mechanism** - Graceful degradation if runtime config fails  
✅ **Validation** - Configuration validation with detailed error messages  
✅ **Security** - No secrets in client code, supports token-based auth  

## Configuration Values

### SIP/WebRTC Signaling Server
- `wsUri` - WebSocket URI (e.g., `wss://signaling.example.com:8009`)
- `sipUri` - SIP URI (e.g., `sip:user@host:port`)
- `host` - Server hostname/IP
- `port` - Server port
- `fromDisplayName` - Caller display name
- `toDisplayName` - Callee display name
- `maxRetries` - Connection retry attempts
- `connectionTimeout` - Timeout in milliseconds

### API Backend Server
- `baseUrl` - Base URL for all API endpoints
- `timeout` - Request timeout in milliseconds
- `enableLogging` - Enable/disable verbose logging

## Usage

### Basic Usage

```typescript
import { configService } from './config';

// Get SIP configuration
const sipConfig = configService.getSipConfig();
console.log(sipConfig.wsUri); // wss://signaling.example.com:8009

// Get API URL
const apiUrl = configService.getApiUrl('api/service/get-services');
// Returns: https://api.example.com/api/service/get-services

// Build SIP URI for a user
const userSipUri = configService.buildSipUri('john.doe');
// Returns: sip:john.doe@host:port
```

### Runtime Configuration Loading

The configuration service can fetch runtime configuration from your server during app initialization:

```typescript
// In your app initialization (e.g., App.tsx or index.tsx)
import { configService } from './config';

async function initializeApp() {
  try {
    // Fetch runtime configuration from server
    await configService.fetchRuntimeConfig();
    
    // Validate configuration
    const errors = configService.validateConfig();
    if (errors.length > 0) {
      console.error('Configuration errors:', errors);
      // Handle configuration errors
    }
    
    // Log current configuration (for debugging)
    configService.logConfig();
    
    // Continue with app initialization
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}
```

### Custom Runtime Config Endpoint

```typescript
// Fetch from a custom endpoint
await configService.fetchRuntimeConfig('https://config.example.com/app-config');
```

## Server-Side Implementation

### Runtime Configuration Endpoint

You need to create an API endpoint that returns configuration in the following format:

**Endpoint:** `GET /api/config/endpoints`

**Response Format:**
```json
{
  "sipServer": {
    "wsUri": "wss://signaling.production.com:8009",
    "host": "signaling.production.com",
    "port": 8009,
    "maxRetries": 5,
    "connectionTimeout": 30000
  },
  "apiServer": {
    "baseUrl": "https://api.production.com",
    "timeout": 30000,
    "enableLogging": false
  },
  "features": {
    "enableWebRTC": true,
    "enableFileSharing": true
  }
}
```

### Example .NET Core Implementation

```csharp
// ConfigController.cs
[ApiController]
[Route("api/config")]
public class ConfigController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public ConfigController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("endpoints")]
    public IActionResult GetEndpoints()
    {
        var config = new
        {
            sipServer = new
            {
                wsUri = _configuration["SipServer:WsUri"],
                host = _configuration["SipServer:Host"],
                port = int.Parse(_configuration["SipServer:Port"]),
                maxRetries = int.Parse(_configuration["SipServer:MaxRetries"] ?? "5"),
                connectionTimeout = int.Parse(_configuration["SipServer:ConnectionTimeout"] ?? "30000")
            },
            apiServer = new
            {
                baseUrl = _configuration["ApiServer:BaseUrl"],
                timeout = int.Parse(_configuration["ApiServer:Timeout"] ?? "30000"),
                enableLogging = bool.Parse(_configuration["ApiServer:EnableLogging"] ?? "false")
            }
        };

        return Ok(config);
    }
}
```

### appsettings.json

```json
{
  "SipServer": {
    "WsUri": "wss://signaling.production.com:8009",
    "Host": "signaling.production.com",
    "Port": "8009",
    "MaxRetries": "5",
    "ConnectionTimeout": "30000"
  },
  "ApiServer": {
    "BaseUrl": "https://api.production.com",
    "Timeout": "30000",
    "EnableLogging": "false"
  }
}
```

## Environment Detection

The system automatically detects the environment based on:

1. **Environment Variables** - `NODE_ENV` or `APP_ENV`
2. **Hostname Patterns**:
   - Production: `advokatconnect.com`, `advokat-connect.de`, or non-localhost
   - Staging: Contains `staging`, `stage`, or `test.`
   - Development: `localhost`, `127.0.0.1`, or `.local`
3. **Default**: Falls back to development

## Security Considerations

### ✅ What We've Implemented

1. **No Hard-coded Secrets** - All sensitive values loaded at runtime
2. **Environment Separation** - Different configs for dev/staging/prod
3. **HTTPS/WSS Only** - Encrypted transport for all communications
4. **Configuration Validation** - Checks for invalid/unsafe configurations

### ⚠️ Additional Security Recommendations

#### 1. Endpoint Authentication
Protect your configuration endpoint with authentication:

```csharp
[Authorize] // Add authentication
[HttpGet("endpoints")]
public IActionResult GetEndpoints()
{
    // Return configuration only to authenticated users
}
```

#### 2. WebSocket Authentication
Add token-based authentication to WebSocket connections:

```typescript
const token = await getAuthToken();
const wsUri = `${sipConfig.wsUri}?token=${token}`;
const socket = new WebSocket(wsUri, 'sip');
```

#### 3. CORS Configuration
Restrict CORS to known origins:

```csharp
services.AddCors(options =>
{
    options.AddPolicy("AdvokatConnectPolicy", builder =>
    {
        builder.WithOrigins("https://advokatconnect.com")
               .AllowCredentials()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});
```

#### 4. Rate Limiting
Implement rate limiting on all endpoints:

```csharp
services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("api", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 60;
    });
});
```

#### 5. IP Whitelisting (Optional)
For signaling server, consider IP whitelisting:

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.Configure<IpSecurityOptions>(options =>
    {
        options.AllowedIps = new[] { "10.0.0.0/8", "172.16.0.0/12" };
    });
}
```

#### 6. Content Security Policy
Add CSP headers to manifest.xml:

```xml
<AppDomain>https://api.advokatconnect.com</AppDomain>
```

#### 7. Monitoring & Logging
Log all configuration fetches and connection attempts:

```csharp
_logger.LogInformation("Configuration requested from {IpAddress}", 
    HttpContext.Connection.RemoteIpAddress);
```

## Migration Guide

### Files Changed

1. **SIP Library** (All now use `configService`):
   - [SipClient.ts](src/taskpane/components/SIP_Library/SipClient.ts)
   - [Registration.ts](src/taskpane/components/SIP_Library/Registration.ts)
   - [MessageFactory.ts](src/taskpane/components/SIP_Library/MessageFactory.ts)
   - [EstablishingConnection.ts](src/taskpane/components/SIP_Library/EstablishingConnection.ts)

2. **API Services**:
   - [RegisteredService.tsx](src/taskpane/components/tabs/service/RegisteredService.tsx)
   - [RegisteredEmails.tsx](src/taskpane/components/tabs/email/RegisteredEmails.tsx)

3. **Configuration**:
   - [config.ts](src/config.ts) - Now re-exports from new system

### Backward Compatibility

The existing `config.ts` file continues to work for backward compatibility:

```typescript
import { API_BASE } from './config';
// Still works, but now uses configService internally
```

New code should use:

```typescript
import { configService } from './config';
const apiUrl = configService.getApiUrl('api/endpoint');
```

## Testing

### Unit Tests

```typescript
import { configService } from './config';

describe('ConfigService', () => {
  it('should build SIP URI correctly', () => {
    const uri = configService.buildSipUri('testuser');
    expect(uri).toMatch(/^sip:testuser@/);
  });

  it('should validate configuration', () => {
    const errors = configService.validateConfig();
    expect(errors).toHaveLength(0);
  });
});
```

### Manual Testing

1. **Development Environment**:
   ```bash
   npm start
   # Should use localhost defaults
   ```

2. **Production Environment**:
   ```bash
   APP_ENV=production npm start
   # Should attempt to fetch runtime config
   ```

## Troubleshooting

### Configuration Not Loading

Check browser console for:
```
🔧 [ConfigService] Initialized with development environment
🌐 [ConfigService] Fetching runtime configuration from: ...
```

### Validation Errors

Use the validation method:
```typescript
const errors = configService.validateConfig();
console.log('Configuration errors:', errors);
```

### Production Using Localhost

If you see:
```
❌ [ConfigService] CRITICAL: Production environment is using localhost
```

Ensure:
1. Runtime configuration endpoint is accessible
2. Server returns correct production URLs
3. Environment detection is working correctly

## Next Steps

1. ✅ **Deploy Configuration Endpoint** - Implement `/api/config/endpoints` on your server
2. ✅ **Add Authentication** - Secure the configuration endpoint
3. ✅ **Update Environment Variables** - Set production values in server config
4. ✅ **Test in Staging** - Verify runtime config loading works
5. ✅ **Monitor in Production** - Set up logging and alerts
6. ⚠️ **Implement Rate Limiting** - Protect against abuse
7. ⚠️ **Add IP Whitelisting** - Additional security for signaling server
8. ⚠️ **Enable Audit Logging** - Track all configuration accesses

## Support

For questions or issues:
- Check browser console for detailed logs
- Use `configService.logConfig()` to inspect current configuration
- Verify server-side endpoint is returning correct format
- Check network tab for failed configuration requests
