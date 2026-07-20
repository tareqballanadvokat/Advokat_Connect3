# Logging System - Complete Implementation

## Overview
Environment-based logging system with runtime toggle via Redux and keyboard shortcut.

## Configuration

### Environment Defaults
- **Development**: Enabled, DEBUG level
- **Staging**: Enabled, INFO level  
- **Production**: Disabled, ERROR level
- **Test**: Disabled, ERROR level

## Usage

### Basic Logging
```typescript
import { getLogger } from '@/services/logger';

const logger = getLogger();

// Log at different levels
logger.debug('ComponentName', 'Debug message', { data: 123 });
logger.info('ServiceName', 'Info message');
logger.warn('ValidationService', 'Warning message', { field: 'email' });
logger.error('ApiService', 'Error message', { error: 'details' });
```

### Runtime Control

#### Keyboard Shortcut
**Ctrl+Shift+L** - Toggle logging on/off (shows notification)

#### Programmatically via Redux
```typescript
import { useAppDispatch } from '@/store/hooks';
import { toggleLogging, setLogLevel } from '@/store/slices/loggingSlice';
import { LogLevel } from '@/config/types';

const dispatch = useAppDispatch();

// Toggle on/off
dispatch(toggleLogging());

// Set log level
dispatch(setLogLevel(LogLevel.WARN));
```

#### Directly via Logger
```typescript
const logger = getLogger();

// Enable/disable
logger.enable();
logger.disable();

// Set level
logger.setLevel(LogLevel.INFO);

// Check status
const isEnabled = logger.isEnabled();
const currentLevel = logger.getLevel();
```

## Implementation Files

### Core Logger
- [src/services/logger/types.ts](src/services/logger/types.ts) - Types and enums
- [src/services/logger/Logger.ts](src/services/logger/Logger.ts) - Logger class
- [src/services/logger/index.ts](src/services/logger/index.ts) - Public API

### Configuration
- [src/config/types.ts](src/config/types.ts) - LogLevel enum, LoggingConfig
- [src/config/defaults.ts](src/config/defaults.ts) - Environment defaults

### State Management
- [src/store/slices/loggingSlice.ts](src/store/slices/loggingSlice.ts) - Redux slice
- [src/store/index.ts](src/store/index.ts) - Store registration

### Integration
- [src/taskpane/index.tsx](src/taskpane/index.tsx) - Logger initialization
- [src/taskpane/components/App.tsx](src/taskpane/components/App.tsx) - Keyboard shortcut

## Features
✅ Environment-based enable/disable (dev=on, prod=off)  
✅ 5 log levels: DEBUG, INFO, WARN, ERROR, NONE  
✅ Runtime toggle via keyboard shortcut (Ctrl+Shift+L)  
✅ Redux state management  
✅ Contextual logging with emojis (🔍📍⚠️❌)  
✅ Optional timestamps  
✅ Optional stack traces for errors  
✅ No localStorage persistence (simplified)  
✅ Singleton pattern for consistency  

## Example Output
```
🔍 [2026-02-19T10:30:45.123Z] [ConnectionManager] Connection established { timestamp: 1708337445123 }
ℹ️ [2026-02-19T10:30:46.456Z] [AuthService] User logged in successfully
⚠️ [2026-02-19T10:30:47.789Z] [ValidationService] Invalid email format { field: 'email', value: 'test' }
❌ [2026-02-19T10:30:48.012Z] [ApiService] Network request failed { error: 'timeout' }
```

