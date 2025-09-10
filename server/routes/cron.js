const express = require('express');
const router = express.Router();
const rssService = require('../services/rssService');
const dbService = require('../services/dbService');
const linkedinEnrichmentService = require('../services/linkedinEnrichmentService');
const scheduleService = require('../services/scheduleService');
const cacheService = require('../services/cacheService');
const phEnrichmentService = require('../services/phEnrichmentService');

/**
 * POST /cron/fetch
 * Trigger RSS feed fetching for all configured categories
 */
router.post('/fetch', async (req, res) => {
  const startTime = Date.now();
  const jobName = 'rss-fetch';

  console.log('=== RSS Fetch Cron Job Started ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const scheduleCheck = await scheduleService.shouldJobRun(jobName);

    if (!scheduleCheck.shouldRun) {
      console.log(`Skipping RSS fetch: ${scheduleCheck.reason}`);
      return res.json({
        success: true,
        skipped: true,
        reason: scheduleCheck.reason,
        schedule: scheduleCheck,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`RSS fetch allowed: ${scheduleCheck.reason}`);

    const rssResults = await rssService.fetchAllCategories();

    console.log('=== RSS Fetch Completed ===');
    console.log(`Total processed: ${rssResults.totalProcessed}`);
    console.log(`New products: ${rssResults.totalNew}`);
    console.log(`Duplicates: ${rssResults.totalDuplicates}`);
    console.log(`Errors: ${rssResults.errors.length}`);

    let enrichmentResults = null;
    try {
      console.log('=== Starting LinkedIn Enrichment ===');
      enrichmentResults = await linkedinEnrichmentService.enrichProducts();
    } catch (enrichmentError) {
      console.error(
        'LinkedIn enrichment failed, but continuing:',
        enrichmentError.message
      );
      enrichmentResults = {
        totalProcessed: 0,
        successfulEnrichments: 0,
        failedEnrichments: 0,
        cacheHits: 0,
        errors: [{ error: enrichmentError.message }],
      };
    }

    let phEnrichmentResults = null;
    try {
      console.log('=== Starting Product Hunt Enrichment for New Products ===');
      phEnrichmentResults = await phEnrichmentService.enrichNewProducts(
        rssResults.newItems || []
      );
    } catch (phError) {
      console.error(
        'Product Hunt enrichment failed, but continuing:',
        phError.message
      );
      phEnrichmentResults = {
        totalEnriched: 0,
        errors: [{ error: phError.message }],
      };
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('=== Combined Cron Job Completed ===');
    console.log(`Total Duration: ${duration}ms`);
    console.log(
      `RSS - Processed: ${rssResults.totalProcessed}, New: ${rssResults.totalNew}`
    );
    console.log(
      `LinkedIn - Processed: ${enrichmentResults.totalProcessed}, Successful: ${enrichmentResults.successfulEnrichments}`
    );
    console.log(`PH Enrichment - Enriched: ${phEnrichmentResults.totalEnriched}`);

    const jobResults = {
      rss: rssResults,
      enrichment: enrichmentResults,
      phEnrichment: phEnrichmentResults,
      duration: `${duration}ms`,
    };

    await scheduleService.recordJobRun(jobName, jobResults);

    const stats = await dbService.getStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      schedule: scheduleCheck,
      results: {
        rss: {
          categories: rssResults.categories,
          summary: {
            totalProcessed: rssResults.totalProcessed,
            totalNew: rssResults.totalNew,
            totalDuplicates: rssResults.totalDuplicates,
            errorCount: rssResults.errors.length,
          },
          errors: rssResults.errors,
        },
        linkedinEnrichment: {
          summary: {
            totalProcessed: enrichmentResults.totalProcessed,
            successfulEnrichments: enrichmentResults.successfulEnrichments,
            failedEnrichments: enrichmentResults.failedEnrichments,
            cacheHits: enrichmentResults.cacheHits,
            errorCount: enrichmentResults.errors.length,
          },
          errors: enrichmentResults.errors,
        },
        phEnrichment: {
          summary: {
            totalEnriched: phEnrichmentResults.totalEnriched,
            errorCount: phEnrichmentResults.errors.length,
          },
          errors: phEnrichmentResults.errors,
        },
      },
      database: stats,
    });
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.error('=== RSS Fetch Cron Job Failed ===');
    console.error('Error:', error.message);
    console.error('Duration:', `${duration}ms`);
    console.error('Stack:', error.stack);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

/**
 * POST /cron/fetch/:category
 * Trigger RSS feed fetching for a specific category
 */
router.post('/fetch/:category', async (req, res) => {
  const { category } = req.params;
  const startTime = Date.now();

  console.log(`=== RSS Fetch for Category: ${category} ===`);
  console.log('Timestamp:', new Date().toISOString());

  try {
    const rssCategories = require('../config/rssCategories');
    if (!rssCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid category: ${category}`,
          validCategories: rssCategories,
        },
      });
    }

    const result = await rssService.fetchCategory(category);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`=== Category ${category} Fetch Completed ===`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Processed: ${result.processed}`);
    console.log(`New: ${result.newProducts}`);
    console.log(`Duplicates: ${result.duplicates}`);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      category,
      result,
    });
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.error(`=== Category ${category} Fetch Failed ===`);
    console.error('Error:', error.message);
    console.error('Duration:', `${duration}ms`);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      category,
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

/**
 * GET /cron/status
 * Get current status and statistics
 */
router.get('/status', async (req, res) => {
  try {
    const stats = await dbService.getStats();
    const rssCategories = require('../config/rssCategories');

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      status: 'healthy',
      configuration: {
        categories: rssCategories,
        database: stats.totalProducts > 0 ? 'connected' : 'empty',
      },
      database: stats,
    });
  } catch (error) {
    console.error('Status check failed:', error.message);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      status: 'unhealthy',
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

/**
 * POST /cron/test/:category
 * Test RSS parsing for a specific category without saving to database
 */
router.post('/test/:category', async (req, res) => {
  const { category } = req.params;

  console.log(`=== RSS Test for Category: ${category} ===`);

  try {
    const result = await rssService.testCategory(category);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      test: result,
    });
  } catch (error) {
    console.error(`Test failed for ${category}:`, error.message);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      category,
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

/**
 * POST /cron/enrich
 * Trigger LinkedIn enrichment for pending products
 */
router.post('/enrich', async (req, res) => {
  const startTime = Date.now();
  console.log('=== LinkedIn Enrichment Job Started ===');
  console.log('Timestamp:', new Date().toISOString());

  try {
    const results = await linkedinEnrichmentService.enrichProducts();

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log('=== LinkedIn Enrichment Job Completed ===');
    console.log(`Duration: ${duration}ms`);
    console.log(`Total processed: ${results.totalProcessed}`);
    console.log(`Successful: ${results.successfulEnrichments}`);
    console.log(`Failed: ${results.failedEnrichments}`);

    const stats = await dbService.getStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      results: {
        summary: {
          totalProcessed: results.totalProcessed,
          successfulEnrichments: results.successfulEnrichments,
          failedEnrichments: results.failedEnrichments,
          cacheHits: results.cacheHits,
          errorCount: results.errors.length,
        },
        errors: results.errors,
      },
      database: stats,
    });
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.error('=== LinkedIn Enrichment Job Failed ===');
    console.error('Error:', error.message);
    console.error('Duration:', `${duration}ms`);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

/**
 * POST /cron/enrich/:productId
 * Trigger PH enrichment for a specific product
 */
router.post('/enrich/:productId', async (req, res) => {
  const { productId } = req.params;
  console.log(`=== Manual PH Enrichment for Product ID: ${productId} ===`);

  try {
    const product = await dbService.getItem(`product:${productId}`);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: { message: `Product not found: ${productId}` },
      });
    }

    const enrichedProduct = await phEnrichmentService.enrichProduct(product);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      product: enrichedProduct,
    });
  } catch (error) {
    console.error(`Failed to enrich product ${productId}:`, error.message);
    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: { message: error.message },
    });
  }
});

/**
 * GET /cron/enrich/status
 * Get LinkedIn enrichment cache status and statistics
 */
router.get('/enrich/status', async (req, res) => {
  try {
    const cacheStats = await linkedinEnrichmentService.getCacheStats();
    const dbStats = await dbService.getStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      enrichment: {
        cache: cacheStats,
        database: {
          totalProducts: dbStats.totalProducts,
          enrichedProducts: dbStats.enrichedProducts,
          needingEnrichment: dbStats.needingEnrichment,
        },
      },
    });
  } catch (error) {
    console.error('Enrichment status check failed:', error.message);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

/**
 * POST /cron/enrich/clear-cache
 * Clear the LinkedIn search cache
 */
router.post('/enrich/clear-cache', async (req, res) => {
  try {
    const results = await linkedinEnrichmentService.clearCache();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'LinkedIn search cache cleared successfully',
      results: results,
    });
  } catch (error) {
    console.error('Failed to clear cache:', error.message);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

/**
 * GET /cron/schedule/status
 * Get schedule status for all jobs
 */
router.get('/schedule/status', async (req, res) => {
  try {
    const scheduleStatus = await scheduleService.getScheduleStatus();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      schedule: scheduleStatus,
    });
  } catch (error) {
    console.error('Schedule status check failed:', error.message);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

/**
 * POST /cron/schedule/force/:jobName
 * Force a job to be runnable by clearing its schedule
 */
router.post('/schedule/force/:jobName', async (req, res) => {
  try {
    const { jobName } = req.params;
    const success = await scheduleService.forceJobRunnable(jobName);

    if (success) {
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        message: `Job ${jobName} has been forced runnable`,
        jobName: jobName,
      });
    } else {
      res.status(500).json({
        success: false,
        timestamp: new Date().toISOString(),
        error: {
          message: `Failed to force job ${jobName} runnable`,
        },
      });
    }
  } catch (error) {
    console.error('Failed to force job runnable:', error.message);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

/**
 * POST /cron/cache/cleanup
 * Clean up expired cache entries
 */
router.post('/cache/cleanup', async (req, res) => {
  try {
    const cacheResults = await cacheService.cleanupExpiredCache();
    const scheduleResults = await scheduleService.cleanupOldSchedules();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Cache cleanup completed',
      results: {
        cache: cacheResults,
        schedule: scheduleResults,
      },
    });
  } catch (error) {
    console.error('Cache cleanup failed:', error.message);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

/**
 * GET /cron/cache/stats
 * Get detailed cache statistics
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const cacheStats = await cacheService.getCacheStats();
    const scheduleStats = await scheduleService.getScheduleStatus();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      cache: cacheStats,
      schedule: scheduleStats,
    });
  } catch (error) {
    console.error('Cache stats failed:', error.message);

    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        type: error.name || 'UnknownError',
      },
    });
  }
});

module.exports = router;
