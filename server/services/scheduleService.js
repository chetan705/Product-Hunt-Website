const dbService = require('./dbService');

class ScheduleService {
  constructor() {
    this.inMemorySchedule = new Map();
    this.defaultIntervalHours = parseFloat(process.env.CRON_INTERVAL_HOURS || '0.05'); // Default 3 minutes (0.05 hours)
  }

  /**
   * Check if a cron job should run based on last execution time
   * @param {string} jobName - Name of the cron job
   * @param {number} intervalHours - Minimum hours between runs (optional)
   * @returns {Promise<Object>} - Object with shouldRun boolean and lastRun info
   */
  async shouldJobRun(jobName, intervalHours = null) {
    const interval = intervalHours || this.defaultIntervalHours;
    const intervalMs = interval * 60 * 60 * 1000;
    
    try {
      // Get last run time
      const lastRun = await this.getLastRun(jobName);
      
      if (!lastRun) {
        return {
          shouldRun: true,
          reason: 'Job has never been run',
          lastRun: null,
          nextRunAllowed: new Date().toISOString()
        };
      }

      const lastRunTime = new Date(lastRun.timestamp).getTime();
      const now = Date.now();
      const timeSinceLastRun = now - lastRunTime;
      const nextRunTime = new Date(lastRunTime + intervalMs).toISOString();

      if (timeSinceLastRun >= intervalMs) {
        return {
          shouldRun: true,
          reason: `Interval of ${interval} hours has passed`,
          lastRun: lastRun,
          timeSinceLastRun: Math.round(timeSinceLastRun / (60 * 60 * 1000) * 100) / 100, // Hours with 2 decimals
          nextRunAllowed: new Date().toISOString()
        };
      } else {
        const timeUntilNext = intervalMs - timeSinceLastRun;
        return {
          shouldRun: false,
          reason: `Job ran too recently. Next run allowed in ${Math.round(timeUntilNext / (60 * 1000))} minutes`,
          lastRun: lastRun,
          timeSinceLastRun: Math.round(timeSinceLastRun / (60 * 60 * 1000) * 100) / 100,
          nextRunAllowed: nextRunTime
        };
      }
    } catch (error) {
      console.error(`Error checking schedule for ${jobName}:`, error.message);
      // If we can't check, allow the job to run
      return {
        shouldRun: true,
        reason: 'Error checking schedule, allowing run',
        lastRun: null,
        error: error.message
      };
    }
  }

  /**
   * Record that a job has been executed
   * @param {string} jobName - Name of the cron job
   * @param {Object} results - Results of the job execution
   * @returns {Promise<void>}
   */
  async recordJobRun(jobName, results = {}) {
    const runData = {
      jobName,
      timestamp: new Date().toISOString(),
      results: results,
      recordedAt: new Date().toISOString()
    };

    try {
      // Save to database
      const scheduleKey = `schedule:${jobName}`;
      await dbService.setItem(scheduleKey, runData);
      
      // Update in-memory cache
      this.inMemorySchedule.set(jobName, runData);
      
      console.log(`Recorded job run: ${jobName} at ${runData.timestamp}`);
    } catch (error) {
      console.error(`Error recording job run for ${jobName}:`, error.message);
    }
  }

  /**
   * Get last run information for a job
   * @param {string} jobName - Name of the cron job
   * @returns {Promise<Object|null>} - Last run data or null
   */
  async getLastRun(jobName) {
    // Check in-memory cache first
    if (this.inMemorySchedule.has(jobName)) {
      return this.inMemorySchedule.get(jobName);
    }

    try {
      // Check database
      const scheduleKey = `schedule:${jobName}`;
      const lastRun = await dbService.getItem(scheduleKey);
      
      if (lastRun) {
        // Cache in memory for future quick access
        this.inMemorySchedule.set(jobName, lastRun);
      }
      
      return lastRun;
    } catch (error) {
      console.error(`Error getting last run for ${jobName}:`, error.message);
      return null;
    }
  }

  /**
   * Get schedule status for all jobs
   * @returns {Promise<Object>} - Schedule status for all jobs
   */
  async getScheduleStatus() {
    const status = {
      jobs: {},
      settings: {
        defaultIntervalHours: this.defaultIntervalHours,
        inMemoryCacheSize: this.inMemorySchedule.size
      }
    };

    try {
      // Get all schedule entries
      const allKeys = await dbService.getKeysByPattern('schedule:*');
      
      for (const key of allKeys) {
        try {
          const jobName = key.replace('schedule:', '');
          const lastRun = await this.getLastRun(jobName);
          const shouldRunCheck = await this.shouldJobRun(jobName);
          
          status.jobs[jobName] = {
            lastRun: lastRun,
            shouldRun: shouldRunCheck.shouldRun,
            reason: shouldRunCheck.reason,
            nextRunAllowed: shouldRunCheck.nextRunAllowed,
            timeSinceLastRun: shouldRunCheck.timeSinceLastRun
          };
        } catch (error) {
          status.jobs[key] = {
            error: error.message
          };
        }
      }
    } catch (error) {
      console.error('Error getting schedule status:', error.message);
      status.error = error.message;
    }

    return status;
  }

  /**
   * Force a job to be runnable by clearing its last run record
   * @param {string} jobName - Name of the cron job
   * @returns {Promise<boolean>} - Success status
   */
  async forceJobRunnable(jobName) {
    try {
      const scheduleKey = `schedule:${jobName}`;
      await dbService.deleteItem(scheduleKey);
      this.inMemorySchedule.delete(jobName);
      
      console.log(`Forced job ${jobName} to be runnable by clearing schedule`);
      return true;
    } catch (error) {
      console.error(`Error forcing job ${jobName} runnable:`, error.message);
      return false;
    }
  }

  /**
   * Clean up old schedule records
   * @param {number} daysToKeep - Number of days of history to keep (default 30)
   * @returns {Promise<Object>} - Cleanup results
   */
  async cleanupOldSchedules(daysToKeep = 30) {
    const results = {
      checked: 0,
      removed: 0,
      kept: 0,
      errors: []
    };

    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    try {
      const allKeys = await dbService.getKeysByPattern('schedule:*');
      results.checked = allKeys.length;

      for (const key of allKeys) {
        try {
          const schedule = await dbService.getItem(key);
          
          if (schedule && schedule.timestamp) {
            const scheduleTime = new Date(schedule.timestamp).getTime();
            
            if (scheduleTime < cutoffTime) {
              await dbService.deleteItem(key);
              const jobName = key.replace('schedule:', '');
              this.inMemorySchedule.delete(jobName);
              results.removed++;
            } else {
              results.kept++;
            }
          } else {
            // Remove invalid entries
            await dbService.deleteItem(key);
            results.removed++;
          }
        } catch (error) {
          results.errors.push(`Failed to process ${key}: ${error.message}`);
        }
      }
    } catch (error) {
      results.errors.push(`Failed to cleanup schedules: ${error.message}`);
    }

    console.log(`Schedule cleanup: ${results.removed} old entries removed, ${results.kept} kept`);
    return results;
  }

  /**
   * Get job history for a specific job
   * @param {string} jobName - Name of the cron job
   * @param {number} limit - Maximum number of history entries to return
   * @returns {Promise<Array>} - Array of job run history
   */
  async getJobHistory(jobName, limit = 10) {
    // For now, we only store the latest run per job
    // In a more advanced implementation, you could store multiple runs with timestamps
    try {
      const lastRun = await this.getLastRun(jobName);
      return lastRun ? [lastRun] : [];
    } catch (error) {
      console.error(`Error getting job history for ${jobName}:`, error.message);
      return [];
    }
  }

  /**
   * Get all job names that have schedule records
   * @returns {Promise<Array>} - Array of job names
   */
  async getAllJobNames() {
    try {
      const allKeys = await dbService.getKeysByPattern('schedule:*');
      return allKeys.map(key => key.replace('schedule:', ''));
    } catch (error) {
      console.error('Error getting job names:', error.message);
      return [];
    }
  }

  /**
   * Check if system is healthy for scheduling
   * @returns {Promise<Object>} - Health check results
   */
  async healthCheck() {
    const health = {
      healthy: true,
      timestamp: new Date().toISOString(),
      checks: {}
    };

    try {
      // Test database connectivity
      const testKey = 'schedule:health_test';
      const testData = { test: true, timestamp: new Date().toISOString() };
      
      await dbService.setItem(testKey, testData);
      const retrieved = await dbService.getItem(testKey);
      await dbService.deleteItem(testKey);
      
      health.checks.database = {
        status: retrieved ? 'healthy' : 'error',
        message: retrieved ? 'Database read/write successful' : 'Database read/write failed'
      };
      
      if (!retrieved) {
        health.healthy = false;
      }
    } catch (error) {
      health.healthy = false;
      health.checks.database = {
        status: 'error',
        message: error.message
      };
    }

    // Check in-memory cache
    health.checks.cache = {
      status: 'healthy',
      size: this.inMemorySchedule.size,
      message: `In-memory cache has ${this.inMemorySchedule.size} entries`
    };

    return health;
  }
}

module.exports = new ScheduleService();
