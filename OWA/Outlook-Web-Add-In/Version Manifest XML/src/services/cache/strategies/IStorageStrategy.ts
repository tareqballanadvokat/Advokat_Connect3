/**
 * Storage Strategy Interface
 * All storage implementations must conform to this interface
 */

import { StorageUsage } from '../types';

export interface IStorageStrategy {
  readonly type: string;
  
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
  getAllKeys(): Promise<string[]>;
  getUsage(): Promise<StorageUsage>;
  isAvailable(): Promise<boolean>;
}
