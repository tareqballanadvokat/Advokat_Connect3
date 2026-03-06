/* eslint-disable no-undef */
/**
 * SessionStorage Strategy
 * Implements IStorageStrategy using browser sessionStorage
 * Data persists only for the session duration (until tab/window is closed)
 */

import { IStorageStrategy } from "./IStorageStrategy";
import { StorageUsage } from "@infra/cache/types";
import { STORAGE_PREFIX } from "@infra/cache/config";

export class SessionStorageStrategy implements IStorageStrategy {
  readonly type = "session";
  private readonly storage = sessionStorage;

  async isAvailable(): Promise<boolean> {
    try {
      const test = "__storage_test__";
      this.storage.setItem(test, test);
      this.storage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      this.storage.setItem(`${STORAGE_PREFIX}${key}`, value);
    } catch (error) {
      if (error instanceof Error && error.name === "QuotaExceededError") {
        throw new Error("Session storage quota exceeded");
      }
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    return this.storage.getItem(`${STORAGE_PREFIX}${key}`);
  }

  async removeItem(key: string): Promise<void> {
    this.storage.removeItem(`${STORAGE_PREFIX}${key}`);
  }

  async clear(): Promise<void> {
    // Clear only keys with our prefix
    const keys = await this.getAllKeys();
    for (const key of keys) {
      this.storage.removeItem(key);
    }
  }

  async getAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    return keys;
  }

  async getUsage(): Promise<StorageUsage> {
    // SessionStorage typically has 5-10MB limit (browser-dependent)
    const estimatedQuota = 5 * 1024 * 1024; // 5MB
    let used = 0;

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        const value = this.storage.getItem(key);
        if (value) {
          used += new Blob([key, value]).size;
        }
      }
    }

    const percentage = estimatedQuota > 0 ? (used / estimatedQuota) * 100 : 0;
    return { used, quota: estimatedQuota, percentage };
  }
}
