/**
 * Compression Manager
 * Handles data compression/decompression for cache entries
 */

import { compress, decompress } from 'lz-string';
import { cacheStatistics } from './CacheStatistics';
import { getLogger } from '../../logger';

const logger = getLogger();

export class CompressionManager {
  private static readonly COMPRESSION_MARKER = '__LZ__';
  private static readonly DEFAULT_THRESHOLD = 1024; // 1KB

  /**
   * Compress data using LZ-string
   */
  static compress(data: string): string {
    if (!data || typeof data !== 'string') {
      logger.warn('Invalid input for compression', 'CompressionManager');
      return data;
    }

    const originalLength = data.length;
    const originalSize = originalLength * 2; // UTF-16 estimation
    logger.debug(`Starting compression (${originalLength} chars, ~${originalSize} bytes)`, 'CompressionManager');

    const startTime = performance.now();
    try {
      const compressed = compress(data);
      
      if (!compressed) {
        logger.warn('Compression returned null/empty', 'CompressionManager');
        return data;
      }

      const result = this.COMPRESSION_MARKER + compressed;
      const compressedSize = result.length * 2;
      const timeMs = performance.now() - startTime;
      
      // Record statistics (will check for expansion in CacheService)
      cacheStatistics.recordCompression(originalSize, compressedSize, timeMs, false);
      
      logger.debug(`Compression successful (${originalLength} → ${result.length} chars, ${timeMs.toFixed(2)}ms)`, 'CompressionManager');
      return result;
    } catch (error) {
      logger.error('Compression failed: ' + String(error), 'CompressionManager');
      return data; // Return uncompressed on error
    }
  }

  /**
   * Decompress data using LZ-string
   */
  static decompress(data: string): string | null {
    if (!data || typeof data !== 'string') {
      logger.warn('Invalid input for decompression', 'CompressionManager');
      return null;
    }

    try {
      if (!this.isCompressed(data)) {
        logger.debug('Data not compressed, returning as-is', 'CompressionManager');
        return data; // Already uncompressed
      }
      
      logger.debug(`Starting decompression (${data.length} chars)`, 'CompressionManager');
      
      const startTime = performance.now();
      // Remove marker and decompress
      const compressedData = data.substring(this.COMPRESSION_MARKER.length);
      const decompressed = decompress(compressedData);
      const timeMs = performance.now() - startTime;
      
      if (decompressed === null || decompressed === undefined) {
        logger.error(`Decompression returned null - data may be corrupted (dataLength: ${data.length}, compressedLength: ${compressedData.length})`, 'CompressionManager');
        return null;
      }
      
      cacheStatistics.recordDecompression(timeMs);
      logger.debug(`Decompression successful (${data.length} → ${decompressed.length} chars, ${timeMs.toFixed(2)}ms)`, 'CompressionManager');
      return decompressed;
    } catch (error) {
      logger.error(`Decompression failed - data corrupted or invalid format: ${String(error)} (dataLength: ${data?.length})`, 'CompressionManager');
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
    logger.debug(`shouldCompress: ${should} (estimated: ${estimatedSize}B, threshold: ${minSize}B)`, 'CompressionManager');
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
