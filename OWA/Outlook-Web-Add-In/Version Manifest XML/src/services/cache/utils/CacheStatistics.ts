/**
 * Cache Statistics Manager
 * Tracks cache performance metrics in real-time
 */

export interface CacheOperationStats {
  hits: number;
  misses: number;
  writes: number;
  evictions: number;
  errors: number;
}

export interface CompressionStats {
  compressions: number;
  decompressions: number;
  bytesBeforeCompression: number;
  bytesAfterCompression: number;
  totalCompressionTime: number;
  totalDecompressionTime: number;
  expansions: number; // times compression increased size
}

export interface StorageStats {
  [storageType: string]: {
    entryCount: number;
    bytesUsed: number;
    bytesQuota: number;
  };
}

export interface CacheTypeStats {
  [cacheKey: string]: {
    hits: number;
    misses: number;
    writes: number;
    lastAccessed: number | null;
    lastUpdated: number | null;
  };
}

export interface CacheStats {
  operations: CacheOperationStats;
  compression: CompressionStats;
  storage: StorageStats;
  perType: CacheTypeStats;
  startTime: number;
  lastResetTime: number;
  totalOperations: number;
}

/**
 * Singleton Cache Statistics Manager
 */
export class CacheStatisticsManager {
  private static instance: CacheStatisticsManager;
  private stats: CacheStats;
  private listeners: Array<(stats: CacheStats) => void> = [];

  private constructor() {
    this.stats = this.createInitialStats();
  }

  static getInstance(): CacheStatisticsManager {
    if (!CacheStatisticsManager.instance) {
      CacheStatisticsManager.instance = new CacheStatisticsManager();
    }
    return CacheStatisticsManager.instance;
  }

  private createInitialStats(): CacheStats {
    const now = Date.now();
    return {
      operations: {
        hits: 0,
        misses: 0,
        writes: 0,
        evictions: 0,
        errors: 0
      },
      compression: {
        compressions: 0,
        decompressions: 0,
        bytesBeforeCompression: 0,
        bytesAfterCompression: 0,
        totalCompressionTime: 0,
        totalDecompressionTime: 0,
        expansions: 0
      },
      storage: {},
      perType: {},
      startTime: now,
      lastResetTime: now,
      totalOperations: 0
    };
  }

  /**
   * Record a cache hit
   */
  recordHit(cacheKey: string): void {
    this.stats.operations.hits++;
    this.stats.totalOperations++;
    this.updateCacheType(cacheKey, 'hit');
    this.notifyListeners();
  }

  /**
   * Record a cache miss
   */
  recordMiss(cacheKey: string): void {
    this.stats.operations.misses++;
    this.stats.totalOperations++;
    this.updateCacheType(cacheKey, 'miss');
    this.notifyListeners();
  }

  /**
   * Record a cache write
   */
  recordWrite(cacheKey: string, _bytesWritten: number): void {
    this.stats.operations.writes++;
    this.stats.totalOperations++;
    this.updateCacheType(cacheKey, 'write');
    this.notifyListeners();
  }

  /**
   * Record a cache eviction
   */
  recordEviction(): void {
    this.stats.operations.evictions++;
    this.notifyListeners();
  }

  /**
   * Record a cache error
   */
  recordError(): void {
    this.stats.operations.errors++;
    this.notifyListeners();
  }

  /**
   * Record compression operation
   */
  recordCompression(
    originalSize: number,
    compressedSize: number,
    timeMs: number,
    wasExpansion: boolean
  ): void {
    this.stats.compression.compressions++;
    this.stats.compression.bytesBeforeCompression += originalSize;
    this.stats.compression.bytesAfterCompression += compressedSize;
    this.stats.compression.totalCompressionTime += timeMs;
    if (wasExpansion) {
      this.stats.compression.expansions++;
    }
    this.notifyListeners();
  }

  /**
   * Record decompression operation
   */
  recordDecompression(timeMs: number): void {
    this.stats.compression.decompressions++;
    this.stats.compression.totalDecompressionTime += timeMs;
    this.notifyListeners();
  }

  /**
   * Update storage statistics
   */
  updateStorageStats(storageType: string, entryCount: number, bytesUsed: number, bytesQuota: number): void {
    this.stats.storage[storageType] = {
      entryCount,
      bytesUsed,
      bytesQuota
    };
    this.notifyListeners();
  }

  /**
   * Update cache type statistics
   */
  private updateCacheType(cacheKey: string, operation: 'hit' | 'miss' | 'write'): void {
    if (!this.stats.perType[cacheKey]) {
      this.stats.perType[cacheKey] = {
        hits: 0,
        misses: 0,
        writes: 0,
        lastAccessed: null,
        lastUpdated: null
      };
    }

    const now = Date.now();
    if (operation === 'hit') {
      this.stats.perType[cacheKey].hits++;
      this.stats.perType[cacheKey].lastAccessed = now;
    } else if (operation === 'miss') {
      this.stats.perType[cacheKey].misses++;
    } else if (operation === 'write') {
      this.stats.perType[cacheKey].writes++;
      this.stats.perType[cacheKey].lastUpdated = now;
    }
  }

  /**
   * Get current statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get hit rate percentage
   */
  getHitRate(): number {
    const total = this.stats.operations.hits + this.stats.operations.misses;
    if (total === 0) return 0;
    return (this.stats.operations.hits / total) * 100;
  }

  /**
   * Get compression effectiveness (bytes saved percentage)
   */
  getCompressionEffectiveness(): number {
    const before = this.stats.compression.bytesBeforeCompression;
    const after = this.stats.compression.bytesAfterCompression;
    if (before === 0) return 0;
    return ((before - after) / before) * 100;
  }

  /**
   * Get average compression time
   */
  getAvgCompressionTime(): number {
    const count = this.stats.compression.compressions;
    if (count === 0) return 0;
    return this.stats.compression.totalCompressionTime / count;
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return (Date.now() - this.stats.startTime) / 1000;
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.stats = this.createInitialStats();
    console.log('📊 [CacheStatistics] Statistics reset');
    this.notifyListeners();
  }

  /**
   * Subscribe to statistics changes
   */
  subscribe(listener: (stats: CacheStats) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of statistics change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getStats());
      } catch (error) {
        console.error('❌ [CacheStatistics] Listener error:', error);
      }
    });
  }

  /**
   * Log statistics summary
   */
  logSummary(): void {
    const hitRate = this.getHitRate();
    const compressionEffectiveness = this.getCompressionEffectiveness();
    const uptime = this.getUptime();

    console.group('📊 Cache Statistics Summary');
    console.log(`⏱️  Uptime: ${uptime.toFixed(1)}s`);
    console.log(`🎯 Hit Rate: ${hitRate.toFixed(1)}% (${this.stats.operations.hits} hits, ${this.stats.operations.misses} misses)`);
    console.log(`✍️  Writes: ${this.stats.operations.writes}`);
    console.log(`🗑️  Evictions: ${this.stats.operations.evictions}`);
    console.log(`❌ Errors: ${this.stats.operations.errors}`);
    console.log(`🗜️  Compressions: ${this.stats.compression.compressions} (${compressionEffectiveness.toFixed(1)}% saved, ${this.stats.compression.expansions} expansions)`);
    console.log(`📦 Decompressions: ${this.stats.compression.decompressions}`);
    console.log(`⚡ Avg Compression Time: ${this.getAvgCompressionTime().toFixed(2)}ms`);
    
    // Storage breakdown
    Object.entries(this.stats.storage).forEach(([type, storage]) => {
      const usagePercent = (storage.bytesUsed / storage.bytesQuota) * 100;
      console.log(`💾 ${type}: ${storage.entryCount} entries, ${(storage.bytesUsed / 1024).toFixed(1)}KB / ${(storage.bytesQuota / 1024).toFixed(0)}KB (${usagePercent.toFixed(1)}%)`);
    });

    // Per-type breakdown
    const topTypes = Object.entries(this.stats.perType)
      .sort((a, b) => (b[1].hits + b[1].writes) - (a[1].hits + a[1].writes))
      .slice(0, 5);
    
    if (topTypes.length > 0) {
      console.log('\n📋 Top Cache Types:');
      topTypes.forEach(([key, stats]) => {
        const typeHitRate = stats.hits + stats.misses > 0 
          ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(1)
          : '0.0';
        console.log(`  ${key}: ${stats.hits}H / ${stats.misses}M / ${stats.writes}W (${typeHitRate}% hit rate)`);
      });
    }

    console.groupEnd();
  }
}

// Export singleton instance
export const cacheStatistics = CacheStatisticsManager.getInstance();
