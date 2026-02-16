/**
 * Compression Manager
 * Handles data compression/decompression for cache entries
 */

import { compress, decompress } from 'lz-string';
import { cacheStatistics } from './CacheStatistics';

export class CompressionManager {
  private static readonly COMPRESSION_MARKER = '__LZ__';
  private static readonly DEFAULT_THRESHOLD = 1024; // 1KB

  /**
   * Compress data using LZ-string
   */
  static compress(data: string): string {
    if (!data || typeof data !== 'string') {
      console.warn('⚠️ [CompressionManager] Invalid input for compression');
      return data;
    }

    const originalLength = data.length;
    const originalSize = originalLength * 2; // UTF-16 estimation
    console.log(`🔄 [CompressionManager] Starting compression (${originalLength} chars, ~${originalSize} bytes)`);

    const startTime = performance.now();
    try {
      const compressed = compress(data);
      
      if (!compressed) {
        console.warn('⚠️ [CompressionManager] Compression returned null/empty');
        return data;
      }

      const result = this.COMPRESSION_MARKER + compressed;
      const compressedSize = result.length * 2;
      const timeMs = performance.now() - startTime;
      
      // Record statistics (will check for expansion in CacheService)
      cacheStatistics.recordCompression(originalSize, compressedSize, timeMs, false);
      
      console.log(`✅ [CompressionManager] Compression successful (${originalLength} → ${result.length} chars, ${timeMs.toFixed(2)}ms)`);
      return result;
    } catch (error) {
      console.error('❌ [CompressionManager] Compression failed:', error);
      return data; // Return uncompressed on error
    }
  }

  /**
   * Decompress data using LZ-string
   */
  static decompress(data: string): string | null {
    if (!data || typeof data !== 'string') {
      console.warn('⚠️ [CompressionManager] Invalid input for decompression');
      return null;
    }

    try {
      if (!this.isCompressed(data)) {
        console.log('ℹ️ [CompressionManager] Data not compressed, returning as-is');
        return data; // Already uncompressed
      }
      
      console.log(`🔄 [CompressionManager] Starting decompression (${data.length} chars)`);
      
      const startTime = performance.now();
      // Remove marker and decompress
      const compressedData = data.substring(this.COMPRESSION_MARKER.length);
      const decompressed = decompress(compressedData);
      const timeMs = performance.now() - startTime;
      
      if (decompressed === null || decompressed === undefined) {
        console.error('❌ [CompressionManager] Decompression returned null - data may be corrupted', {
          dataLength: data.length,
          compressedLength: compressedData.length
        });
        return null;
      }
      
      cacheStatistics.recordDecompression(timeMs);
      console.log(`✅ [CompressionManager] Decompression successful (${data.length} → ${decompressed.length} chars, ${timeMs.toFixed(2)}ms)`);
      return decompressed;
    } catch (error) {
      console.error('❌ [CompressionManager] Decompression failed - data corrupted or invalid format:', error, {
        dataLength: data?.length
      });
      return null;
    }
  }

  /**
   * Check if data is compressed
   */
  static isCompressed(data: string): boolean {
    return !!data && typeof data === 'string' && data.startsWith(this.COMPRESSION_MARKER);
  }

  /**
   * Check if data should be compressed based on size threshold
   * Uses string length estimation (UTF-16: 2 bytes per char) for performance
   */
  static shouldCompress(data: string, threshold?: number): boolean {
    const minSize = threshold || this.DEFAULT_THRESHOLD;
    // Estimate size: UTF-16 uses 2 bytes per character
    const estimatedSize = data.length * 2;
    const should = estimatedSize >= minSize;
    console.log(`📊 [CompressionManager] shouldCompress: ${should} (estimated: ${estimatedSize}B, threshold: ${minSize}B)`);
    return should;
  }

  /**
   * Calculate compression ratio for monitoring
   * Returns percentage saved (positive) or expansion (negative)
   * @param originalSize - Original data size in bytes
   * @param compressedSize - Compressed data size in bytes
   */
  static getCompressionRatio(originalSize: number, compressedSize: number): number {
    if (originalSize === 0) return 0;
    return ((originalSize - compressedSize) / originalSize) * 100;
  }
}
