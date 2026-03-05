/**
 * Cache Statistics Panel
 * Real-time monitoring of cache performance metrics
 */

import React, { useState, useEffect, useMemo } from 'react';
import { cacheStatistics } from '@services/cache/utils/CacheStatistics';
import type { CacheStats } from '@services/cache/utils/CacheStatistics';
import { cacheService } from '@services/cache';
import './CacheStatsPanel.css';

const CacheStatsPanel: React.FC = () => {
  const [stats, setStats] = useState<CacheStats>(cacheStatistics.getStats());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    // Subscribe to real-time updates
    const unsubscribe = cacheStatistics.subscribe((newStats) => {
      if (autoRefresh) {
        setStats(newStats);
      }
    });

    return unsubscribe;
  }, [autoRefresh]);

  // Memoize expensive calculations
  const hitRate = useMemo(() => cacheStatistics.getHitRate(), [stats]);
  const compressionEffectiveness = useMemo(() => cacheStatistics.getCompressionEffectiveness(), [stats]);
  const avgCompressionTime = useMemo(() => cacheStatistics.getAvgCompressionTime(), [stats]);
  const uptime = useMemo(() => cacheStatistics.getUptime(), [stats]);
  const totalOps = useMemo(
    () => stats.operations.hits + stats.operations.misses + stats.operations.writes,
    [stats]
  );
  const bytesSaved = useMemo(() => {
    const saved = stats.compression.bytesBeforeCompression - stats.compression.bytesAfterCompression;
    return saved > 0 ? (saved / 1024).toFixed(1) : '0.0';
  }, [stats]);

  const handleReset = () => {
    if (window.confirm('Reset all cache statistics?')) {
      cacheStatistics.reset();
      setStats(cacheStatistics.getStats());
    }
  };

  const handleLogStats = () => {
    cacheService.logStatistics();
  };

  const handleRefresh = () => {
    setStats(cacheStatistics.getStats());
  };

  return (
    <div className="cache-stats-panel">
      <div className="cache-stats-header">
        <h4>📊 Cache Statistics</h4>
        <div className="cache-stats-controls">
          <button 
            className="cache-stats-btn" 
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            {autoRefresh ? '⏸️' : '▶️'}
          </button>
          <button className="cache-stats-btn" onClick={handleRefresh} title="Refresh now">
            🔄
          </button>
          <button className="cache-stats-btn" onClick={handleLogStats} title="Log to console">
            📝
          </button>
          <button className="cache-stats-btn" onClick={handleReset} title="Reset statistics">
            🔁
          </button>

        </div>
      </div>

      <div className="cache-stats-body">
        {/* Performance Metrics */}
        <div className="cache-stats-section">
          <h5>⚡ Performance</h5>
          <div className="cache-stats-grid">
            <div className="cache-stat">
              <span className="stat-label">Hit Rate</span>
              <span className={`stat-value ${hitRate >= 70 ? 'good' : hitRate >= 40 ? 'warning' : 'bad'}`}>
                {hitRate.toFixed(1)}%
              </span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Total Operations</span>
              <span className="stat-value">{totalOps}</span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Uptime</span>
              <span className="stat-value">{uptime.toFixed(0)}s</span>
            </div>
          </div>
        </div>

        {/* Operations */}
        <div className="cache-stats-section">
          <h5>📈 Operations</h5>
          <div className="cache-stats-grid">
            <div className="cache-stat">
              <span className="stat-label">Hits</span>
              <span className="stat-value good">{stats.operations.hits}</span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Misses</span>
              <span className="stat-value warning">{stats.operations.misses}</span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Writes</span>
              <span className="stat-value">{stats.operations.writes}</span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Evictions</span>
              <span className="stat-value bad">{stats.operations.evictions}</span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Errors</span>
              <span className="stat-value bad">{stats.operations.errors}</span>
            </div>
          </div>
        </div>

        {/* Compression */}
        <div className="cache-stats-section">
          <h5>🗜️ Compression</h5>
          <div className="cache-stats-grid">
            <div className="cache-stat">
              <span className="stat-label">Effectiveness</span>
              <span className={`stat-value ${compressionEffectiveness >= 50 ? 'good' : 'warning'}`}>
                {compressionEffectiveness.toFixed(1)}%
              </span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Compressions</span>
              <span className="stat-value">{stats.compression.compressions}</span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Decompressions</span>
              <span className="stat-value">{stats.compression.decompressions}</span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Expansions</span>
              <span className="stat-value bad">{stats.compression.expansions}</span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Avg Time</span>
              <span className="stat-value">{avgCompressionTime.toFixed(2)}ms</span>
            </div>
            <div className="cache-stat">
              <span className="stat-label">Bytes Saved</span>
              <span className="stat-value good">
                {bytesSaved}KB
              </span>
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="cache-stats-section">
          <h5>💾 Storage</h5>
          {Object.entries(stats.storage).map(([type, storage]) => {
            const usagePercent = (storage.bytesUsed / storage.bytesQuota) * 100;
            return (
              <div key={type} className="storage-item">
                <div className="storage-header">
                  <span className="storage-type">{type}</span>
                  <span className="storage-entries">{storage.entryCount} entries</span>
                </div>
                <div className="storage-bar-container">
                  <div 
                    className={`storage-bar ${usagePercent >= 90 ? 'bad' : usagePercent >= 70 ? 'warning' : 'good'}`}
                    style={{ width: `${Math.min(usagePercent, 100)}%` }}
                  />
                </div>
                <div className="storage-details">
                  <span>{(storage.bytesUsed / 1024).toFixed(1)}KB / {(storage.bytesQuota / 1024).toFixed(0)}KB</span>
                  <span>{usagePercent.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top Cache Types */}
        <div className="cache-stats-section">
          <h5>📋 Top Cache Types</h5>
          <div className="cache-types-list">
            {Object.entries(stats.perType)
              .sort((a, b) => (b[1].hits + b[1].writes) - (a[1].hits + a[1].writes))
              .slice(0, 5)
              .map(([key, typeStats]) => {
                const typeHitRate = typeStats.hits + typeStats.misses > 0 
                  ? (typeStats.hits / (typeStats.hits + typeStats.misses) * 100)
                  : 0;
                return (
                  <div key={key} className="cache-type-item">
                    <div className="cache-type-name">{key}</div>
                    <div className="cache-type-stats">
                      <span className="type-stat good">{typeStats.hits}H</span>
                      <span className="type-stat warning">{typeStats.misses}M</span>
                      <span className="type-stat">{typeStats.writes}W</span>
                      <span className={`type-stat ${typeHitRate >= 70 ? 'good' : typeHitRate >= 40 ? 'warning' : 'bad'}`}>
                        {typeHitRate.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CacheStatsPanel;
