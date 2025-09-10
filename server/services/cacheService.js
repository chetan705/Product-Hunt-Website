const dbService = require('./dbService');

class CacheService {
  constructor() {
    this.inMemoryCache = new Map();
    this.cacheExpiry = parseInt(process.env.CACHE_EXPIRY_HOURS || '24') * 60 * 60 * 1000; // Default 24 hours
    this.maxInMemorySize = parseInt(process.env.MAX_CACHE_SIZE || '1000'); // Max items in memory
  }

  /**
   * Get cached item (LinkedIn or PH enrichment)
   * @param {string} key - Cache key
   * @returns {Promise<Object|null>} - Cached data or null
   */
  async getItem(key) {
    // Check in-memory cache first
    if (this.inMemoryCache.has(key)) {
      const cached = this.inMemoryCache.get(key);
      if (!this.isExpired(cached.timestamp)) {
        console.log(`In-memory cache hit for: ${key}`);
        return cached.data;
      } else {
        this.inMemoryCache.delete(key);
      }
    }

    // Check database cache
    try {
      const cached = await dbService.getItem(key);
      if (cached && !this.isExpired(cached.timestamp)) {
        console.log(`Database cache hit for: ${key}`);
        this.addToMemoryCache(key, cached.data, cached.timestamp);
        return cached.data;
      }
      if (cached && this.isExpired(cached.timestamp)) {
        await dbService.deleteItem(key);
      }
    } catch (error) {
      console.error(`Error reading cache for ${key}:`, error.message);
    }
    return null;
  }

  /**
   * Set cached item (LinkedIn or PH enrichment)
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   * @param {number} expiryMs - Expiry time in milliseconds
   * @returns {Promise<void>}
   */
  async setItem(key, data, expiryMs) {
    const timestamp = new Date().toISOString();
    this.addToMemoryCache(key, data, timestamp);
    try {
      const cacheData = { data, timestamp };
      await dbService.setItem(key, cacheData);
      console.log(`Cached data for: ${key}`);
    } catch (error) {
      console.error(`Error saving cache for ${key}:`, error.message);
    }
  }

  /**
   * Delete cached item
   * @param {string} key - Cache key
   * @returns {Promise<void>}
   */
  async deleteItem(key) {
    this.inMemoryCache.delete(key);
    try {
      await dbService.deleteItem(key);
      console.log(`Deleted cache item: ${key}`);
    } catch (error) {
      console.error(`Error deleting cache item ${key}:`, error.message);
    }
  }

  /**
   * Get keys matching a pattern (e.g., 'linkedin_cache:*')
   * @param {string} pattern - Pattern to match keys
   * @returns {Promise<string[]>} - Array of matching keys
   */
  async getKeysByPattern(pattern) {
    try {
      // Check in-memory cache
      const memoryKeys = Array.from(this.inMemoryCache.keys()).filter((key) =>
        pattern.endsWith('*') ? key.startsWith(pattern.slice(0, -1)) : key === pattern
      );

      // Check database cache
      const dbKeys = await dbService.getKeysByPattern(pattern);

      // Combine and deduplicate keys
      const allKeys = [...new Set([...memoryKeys, ...dbKeys])];
      console.log(`Found ${allKeys.length} keys matching pattern: ${pattern}`);
      return allKeys;
    } catch (error) {
      console.error(`Error getting keys by pattern ${pattern}:`, error.message);
      return [];
    }
  }

  /**
   * Add entry to in-memory cache with size management
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   * @param {string} timestamp - Timestamp
   */
  addToMemoryCache(key, data, timestamp) {
    if (this.inMemoryCache.size >= this.maxInMemorySize) {
      const oldestKey = this.inMemoryCache.keys().next().value;
      this.inMemoryCache.delete(oldestKey);
    }
    this.inMemoryCache.set(key, { data, timestamp });
  }

  /**
   * Check if cache entry is expired
   * @param {string} timestamp - Timestamp to check
   * @returns {boolean} - True if expired
   */
  isExpired(timestamp) {
    const cacheTime = new Date(timestamp).getTime();
    const now = Date.now();
    return now - cacheTime > this.cacheExpiry;
  }

  /**
   * Clean key for consistent caching
   * @param {string} key - Raw key
   * @returns {string} - Cleaned key
   */
  cleanKey(key) {
    return key
      .toLowerCase()
      .replace(/[^\w\s\-\.]/g, '')
      .replace(/\s+/g, '_')
      .trim()
      .substring(0, 50);
  }

  /**
   * Get LinkedIn-specific cache
   * @param {string} makerName - Maker name
   * @returns {Promise<string|null>} - Cached LinkedIn URL or null
   */
  async getLinkedInCache(makerName) {
    const key = `linkedin_cache:${this.cleanKey(makerName)}`;
    return await this.getItem(key);
  }

  /**
   * Set LinkedIn-specific cache
   * @param {string} makerName - Maker name
   * @param {string|null} linkedinUrl - LinkedIn URL or null
   * @returns {Promise<void>}
   */
  async setLinkedInCache(makerName, linkedinUrl) {
    const key = `linkedin_cache:${this.cleanKey(makerName)}`;
    await this.setItem(key, linkedinUrl, this.cacheExpiry);
  }

  /**
   * Clear all LinkedIn cache
   * @returns {Promise<Object>} - Clear results
   */
  async clearLinkedInCache() {
    const results = {
      memoryCleared: 0,
      databaseCleared: 0,
      errors: [],
    };

    // Clear in-memory cache for LinkedIn
    const linkedinKeys = Array.from(this.inMemoryCache.keys()).filter((key) =>
      key.startsWith('linkedin_cache:')
    );
    results.memoryCleared = linkedinKeys.length;
    linkedinKeys.forEach((key) => this.inMemoryCache.delete(key));

    // Clear database cache
    try {
      const allKeys = await this.getKeysByPattern('linkedin_cache:*');
      for (const key of allKeys) {
        try {
          await this.deleteItem(key);
          results.databaseCleared++;
        } catch (error) {
          results.errors.push(`Failed to delete ${key}: ${error.message}`);
        }
      }
    } catch (error) {
      results.errors.push(`Failed to clear database cache: ${error.message}`);
    }

    console.log(
      `LinkedIn cache cleared: ${results.memoryCleared} memory, ${results.databaseCleared} database`
    );
    return results;
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} - Cache statistics
   */
  async getCacheStats() {
    const stats = {
      inMemory: {
        size: this.inMemoryCache.size,
        maxSize: this.maxInMemorySize,
      },
      database: {
        totalEntries: 0,
        validEntries: 0,
        expiredEntries: 0,
      },
      settings: {
        expiryHours: this.cacheExpiry / (60 * 60 * 1000),
        maxInMemorySize: this.maxInMemorySize,
      },
    };

    try {
      const allKeys = await this.getKeysByPattern('linkedin_cache:*');
      stats.database.totalEntries = allKeys.length;

      for (const key of allKeys) {
        try {
          const cached = await dbService.getItem(key);
          if (cached && !this.isExpired(cached.timestamp)) {
            stats.database.validEntries++;
          } else {
            stats.database.expiredEntries++;
          }
        } catch (error) {
          stats.database.expiredEntries++;
        }
      }
    } catch (error) {
      console.error('Error getting cache stats:', error.message);
    }

    return stats;
  }

  /**
   * Clean up expired cache entries
   * @returns {Promise<Object>} - Cleanup results
   */
  async cleanupExpiredCache() {
    const results = {
      checked: 0,
      removed: 0,
      errors: [],
    };

    try {
      const allKeys = await this.getKeysByPattern('linkedin_cache:*');
      results.checked = allKeys.length;

      for (const key of allKeys) {
        try {
          const cached = await dbService.getItem(key);
          if (!cached || this.isExpired(cached.timestamp)) {
            await this.deleteItem(key);
            results.removed++;
          }
        } catch (error) {
          results.errors.push(`Failed to process ${key}: ${error.message}`);
        }
      }
    } catch (error) {
      results.errors.push(`Failed to cleanup cache: ${error.message}`);
    }

    console.log(
      `Cache cleanup: ${results.removed} expired entries removed from ${results.checked} total`
    );
    return results;
  }

  /**
   * Get all cached entries (for debugging)
   * @returns {Promise<Array>} - Array of cached entries
   */
  async getAllCachedEntries() {
    const entries = [];

    try {
      const allKeys = await this.getKeysByPattern('linkedin_cache:*');
      for (const key of allKeys) {
        try {
          const cached = await dbService.getItem(key);
          if (cached) {
            entries.push({
              key,
              data: cached.data,
              timestamp: cached.timestamp,
              isExpired: this.isExpired(cached.timestamp),
            });
          }
        } catch (error) {
          entries.push({ key, error: error.message });
        }
      }
    } catch (error) {
      console.error('Error getting cached entries:', error.message);
    }

    return entries;
  }
}

module.exports = new CacheService();
