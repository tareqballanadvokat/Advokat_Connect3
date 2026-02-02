/**
 * LocalStorage Strategy
 * Persistent storage with ~5-10 MB limit
 */

import { IStorageStrategy } from './IStorageStrategy';
import { StorageUsage } from '../types';

export class LocalStorageStrategy implements IStorageStrategy {
  public readonly type = 'local';
  private readonly prefix = 'advokat_connect_';

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(this.prefix + key, value);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new Error('LocalStorage quota exceeded');
      }
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(this.prefix + key);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    const keys = await this.getAllKeys();
    keys.forEach(key => localStorage.removeItem(key));
  }

  /**
   * Get all keys for this strategy
   * @returns Array of keys WITH prefix (e.g., 'advokat_connect_username:favorites')
   */
  async getAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    return keys;
  }

  async getUsage(): Promise<StorageUsage> {
    const keys = await this.getAllKeys();
    let used = 0;
    
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        used += (key.length + value.length) * 2; // UTF-16
      }
    });

    const quota = 5 * 1024 * 1024; // 5 MB conservative estimate

    return {
      used,
      quota,
      percentage: (used / quota) * 100
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const testKey = this.prefix + '__test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }
}
