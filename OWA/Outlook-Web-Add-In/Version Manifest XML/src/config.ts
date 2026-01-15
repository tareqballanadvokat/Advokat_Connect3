/**
 * Legacy Configuration Exports
 * 
 * This file re-exports configuration values from the centralized config service
 * for backward compatibility with existing code.
 * 
 * New code should import directly from 'src/config/index' instead.
 */

import { configService } from './config';

export const API_BASE = configService.getApiBaseUrl();
export const DEVEXPRESS_THEME = configService.getConfig().theme.name;
export const COMPACT = configService.getConfig().theme.compact ? '.compact' : '';

// Re-export the configuration service for direct access
export { configService };


