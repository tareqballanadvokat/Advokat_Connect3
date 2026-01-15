/**
 * Environment Detection and Management
 * Determines the current environment and loads appropriate configuration
 */

import { Environment, AppConfig } from './types';
import { DEFAULT_CONFIG, PRODUCTION_CONFIG, STAGING_CONFIG, TEST_CONFIG } from './defaults';

/**
 * Detect current environment based on various indicators
 * Priority: ENV variable > hostname > default
 */
export function detectEnvironment(): Environment {
  // Check if running in test environment
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return Environment.TEST;
  }

  // Check for explicit environment variable
  if (typeof process !== 'undefined' && process.env?.APP_ENV) {
    const env = process.env.APP_ENV.toLowerCase();
    if (env === 'production' || env === 'prod') return Environment.PRODUCTION;
    if (env === 'staging' || env === 'stage') return Environment.STAGING;
    if (env === 'development' || env === 'dev') return Environment.DEVELOPMENT;
  }

  // Check hostname patterns
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    
    // Development patterns (check first for safety)
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.includes('.local')) {
      return Environment.DEVELOPMENT;
    }
    
    // Staging patterns (check before production)
    if (hostname.includes('staging') || hostname.includes('stage') || hostname.includes('test.')) {
      return Environment.STAGING;
    }
    
    // Production patterns (explicit domains only)
    if (hostname.includes('advokatconnect.com') || hostname.includes('advokat-connect.de')) {
      return Environment.PRODUCTION;
    }
  }

  // Default to development for safety
  return Environment.DEVELOPMENT;
}

/**
 * Get base configuration for the detected environment
 * This provides the starting configuration before runtime overrides
 */
export function getEnvironmentConfig(): AppConfig {
  const env = detectEnvironment();
  
  switch (env) {
    case Environment.PRODUCTION:
      return { 
        ...DEFAULT_CONFIG, 
        ...PRODUCTION_CONFIG,
        environment: Environment.PRODUCTION 
      } as AppConfig;
      
    case Environment.STAGING:
      return { 
        ...DEFAULT_CONFIG, 
        ...STAGING_CONFIG,
        environment: Environment.STAGING 
      } as AppConfig;
      
    case Environment.TEST:
      return TEST_CONFIG;
      
    case Environment.DEVELOPMENT:
    default:
      return DEFAULT_CONFIG;
  }
}

/**
 * Check if we're in a development environment
 */
export function isDevelopment(): boolean {
  return detectEnvironment() === Environment.DEVELOPMENT;
}

/**
 * Check if we're in a production environment
 */
export function isProduction(): boolean {
  return detectEnvironment() === Environment.PRODUCTION;
}

/**
 * Check if we're in a staging environment
 */
export function isStaging(): boolean {
  return detectEnvironment() === Environment.STAGING;
}

/**
 * Check if we're in a test environment
 */
export function isTest(): boolean {
  return detectEnvironment() === Environment.TEST;
}
