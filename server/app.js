const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import routes
const cronRoutes = require('./routes/cron');

// Import services
const dbService = require('./services/dbService');
const googleSheetsService = require('./services/googleSheetsService');
const scheduleService = require('./services/scheduleService');
const cacheService = require('./services/cacheService');

// Import middleware
const { auth, logAuthAttempt } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for React development
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL || true 
    : ['http://localhost:5173', 'http://localhost:5000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuildPath));
  console.log(`Serving static files from: ${clientBuildPath}`);
}

// API Routes
app.use('/api/cron', cronRoutes);

// Products API routes
app.get('/api/products', async (req, res) => {
  try {
    const { category, status, sort, limit } = req.query;
    let products;

    if (category) {
      products = await dbService.getProductsByCategory(category);
    } else if (status) {
      products = await dbService.getProductsByStatus(status);
    } else {
      products = await dbService.getAllProducts();
    }

    // Apply sorting
    if (sort === 'votes') {
      products.sort((a, b) => {
        const votesA = a.upvotes || 0;
        const votesB = b.upvotes || 0;
        if (votesA !== votesB) {
          return votesB - votesA; // Highest votes first
        }
        // If votes are equal, sort by newest first
        return new Date(b.publishedAt) - new Date(a.publishedAt);
      });
    }

    // Apply limit
    if (limit && !isNaN(limit)) {
      products = products.slice(0, parseInt(limit));
    }

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch products',
        details: error.message
      }
    });
  }
});

// Upvote product endpoint
app.post('/api/products/:id/upvote', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbService.upvoteProduct(id);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Product upvoted successfully',
        upvotes: result.upvotes
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          details: result.error
        }
      });
    }
  } catch (error) {
    console.error('Error upvoting product:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to upvote product',
        details: error.message
      }
    });
  }
});

// Unvote (remove upvote) endpoint
app.post('/api/products/:id/unvote', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await dbService.unvoteProduct(id);

    if (result.success) {
      res.json({
        success: true,
        message: 'Product unvoted successfully',
        upvotes: result.upvotes
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          details: result.error
        }
      });
    }
  } catch (error) {
    console.error('Error unvoting product:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to unvote product',
        details: error.message
      }
    });
  }
});

// Get products by category
app.get('/api/products/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const products = await dbService.getProductsByCategory(category);
    
    res.json({
      success: true,
      category,
      count: products.length,
      products
    });
  } catch (error) {
    console.error(`Error fetching products for category ${req.params.category}:`, error);
    res.status(500).json({
      success: false,
      error: {
        message: `Failed to fetch products for category: ${req.params.category}`,
        details: error.message
      }
    });
  }
});

// Get database statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await dbService.getStats();
    const rssCategories = require('./config/rssCategories');
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      configuration: {
        categories: rssCategories
      },
      database: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch statistics',
        details: error.message
      }
    });
  }
});

// Status endpoint (with optional light authentication)
app.get('/api/status', async (req, res) => {
  try {
    const stats = await dbService.getStats();
    const scheduleStatus = await scheduleService.getScheduleStatus();
    const cacheStats = await cacheService.getCacheStats();
    
    // Get last cron run info
    const lastCronRun = scheduleStatus.jobs['rss-fetch']?.lastRun || null;
    
    const statusInfo = {
      success: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      system: {
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        platform: process.platform
      },
      lastCronRun: lastCronRun ? {
        timestamp: lastCronRun.timestamp,
        duration: lastCronRun.results?.duration,
        rssNewProducts: lastCronRun.results?.rss?.totalNew || 0,
        enrichmentSuccessful: lastCronRun.results?.enrichment?.successfulEnrichments || 0
      } : null,
      makers: {
        pending: stats.byStatus.pending || 0,
        approved: stats.byStatus.approved || 0,
        rejected: stats.byStatus.rejected || 0,
        total: stats.totalProducts
      },
      enrichment: {
        totalEnriched: stats.enrichedProducts,
        needingEnrichment: stats.needingEnrichment,
        linkedinFound: stats.linkedinFound
      },
      cache: {
        linkedinCacheSize: cacheStats.inMemory?.size || 0,
        databaseCacheEntries: cacheStats.database?.validEntries || 0
      },
      schedule: {
        nextCronAllowed: scheduleStatus.jobs['rss-fetch']?.nextRunAllowed || null,
        defaultIntervalHours: scheduleStatus.settings?.defaultIntervalHours || 4
      }
    };

    res.json(statusInfo);
  } catch (error) {
    console.error('Error fetching status:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch status',
        details: error.message
      }
    });
  }
});

// Admin API routes for maker approval/rejection (protected)
app.get('/api/makers', logAuthAttempt, auth, async (req, res) => {
  try {
    const { status } = req.query;
    let products;

    if (status) {
      products = await dbService.getProductsByStatus(status);
    } else {
      products = await dbService.getAllProducts();
    }

    res.json({
      success: true,
      count: products.length,
      makers: products
    });
  } catch (error) {
    console.error('Error fetching makers:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch makers',
        details: error.message
      }
    });
  }
});

app.post('/api/makers/:id/approve', logAuthAttempt, auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the product data before approval
    const productIds = await dbService.getProductList();
    const product = await dbService.getItem(`product:${id}`);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Maker not found'
        }
      });
    }

    // Update the product status to approved
    const success = await dbService.updateProductStatus(id, 'approved');
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to update product status'
        }
      });
    }

    // Try to sync to Google Sheets (don't block approval if this fails)
    let sheetsResult = { synced: false, error: null };
    
    try {
      const syncSuccess = await googleSheetsService.addApprovedMaker(product);
      if (syncSuccess) {
        await dbService.updateProductSheetsSyncStatus(id, true);
        sheetsResult.synced = true;
        console.log(`Successfully synced approved maker to Google Sheets: ${product.name}`);
      } else {
        sheetsResult.error = 'Google Sheets service not available';
        console.log('Google Sheets service not available, approval completed without sync');
      }
    } catch (sheetsError) {
      console.error('Failed to sync to Google Sheets:', sheetsError.message);
      sheetsResult.error = sheetsError.message;
      // Don't update sync status to true on failure - will be retried later
    }

    res.json({
      success: true,
      message: 'Maker approved successfully',
      sheets: sheetsResult
    });
  } catch (error) {
    console.error('Error approving maker:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to approve maker',
        details: error.message
      }
    });
  }
});

app.post('/api/makers/:id/reject', logAuthAttempt, auth, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await dbService.updateProductStatus(id, 'rejected');
    
    if (success) {
      res.json({
        success: true,
        message: 'Maker rejected successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: {
          message: 'Maker not found'
        }
      });
    }
  } catch (error) {
    console.error('Error rejecting maker:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to reject maker',
        details: error.message
      }
    });
  }
});

// Google Sheets resync endpoint (for cron or manual retry) - protected
app.post('/api/cron/resync-sheets', logAuthAttempt, auth, async (req, res) => {
  try {
    // Get all approved products that haven't been synced to sheets yet
    const needingSyncProducts = await dbService.getApprovedProductsNeedingSync();
    
    if (needingSyncProducts.length === 0) {
      return res.json({
        success: true,
        message: 'No products need syncing to Google Sheets',
        processed: 0,
        results: []
      });
    }

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const product of needingSyncProducts) {
      try {
        const syncSuccess = await googleSheetsService.addApprovedMaker(product);
        if (syncSuccess) {
          await dbService.updateProductSheetsSyncStatus(product.id, true);
          
          results.push({
            productId: product.id,
            productName: product.name,
            success: true
          });
          successCount++;
          
          console.log(`Successfully synced to Google Sheets: ${product.name}`);
        } else {
          results.push({
            productId: product.id,
            productName: product.name,
            success: false,
            error: 'Google Sheets service not available'
          });
          failureCount++;
          
          console.log(`Google Sheets service not available for: ${product.name}`);
        }
      } catch (error) {
        results.push({
          productId: product.id,
          productName: product.name,
          success: false,
          error: error.message
        });
        failureCount++;
        
        console.error(`Failed to sync ${product.name} to Google Sheets:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `Processed ${needingSyncProducts.length} products`,
      processed: needingSyncProducts.length,
      successCount,
      failureCount,
      results
    });
  } catch (error) {
    console.error('Error during sheets resync:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to resync to Google Sheets',
        details: error.message
      }
    });
  }
});

// Google Sheets status endpoint
app.get('/api/sheets/status', async (req, res) => {
  try {
    const sheetsStatus = await googleSheetsService.getSyncStatus();
    const dbStats = await dbService.getStats();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      googleSheets: sheetsStatus,
      database: {
        approvedProducts: dbStats.approvedProducts,
        syncedToSheets: dbStats.syncedToSheets,
        needingSheetsSync: dbStats.needingSheetsSync
      }
    });
  } catch (error) {
    console.error('Error fetching sheets status:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch sheets status',
        details: error.message
      }
    });
  }
});

// Debug route for enriched entries
app.get('/api/debug/enriched', async (req, res) => {
  try {
    const allProducts = await dbService.getAllProducts();
    const enrichedProducts = allProducts.filter(product => product.linkedin !== null);
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: enrichedProducts.length,
      products: enrichedProducts.map(product => ({
        id: product.id,
        name: product.name,
        category: product.category,
        makerName: product.makerName,
        linkedin: product.linkedin,
        publishedAt: product.publishedAt,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching enriched products:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch enriched products',
        details: error.message
      }
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// API info page for development
app.get('/', (req, res) => {
  res.json({
    name: 'Product Hunt Finder API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    note: 'Frontend is served by Vite on a separate port (5173 in development)',
    endpoints: {
      'POST /api/cron/fetch': 'Trigger RSS feed fetching for all categories (includes LinkedIn enrichment)',
      'POST /api/cron/fetch/:category': 'Trigger RSS feed fetching for specific category',
      'POST /api/cron/enrich': 'Trigger LinkedIn enrichment for pending products',
      'GET /api/cron/enrich/status': 'Get LinkedIn enrichment cache status and statistics',
      'POST /api/cron/enrich/clear-cache': 'Clear the LinkedIn search cache',
      'GET /api/cron/schedule/status': 'Get schedule status for all jobs',
      'POST /api/cron/schedule/force/:jobName': 'Force a job to be runnable',
      'POST /api/cron/cache/cleanup': 'Clean up expired cache entries',
      'GET /api/cron/cache/stats': 'Get detailed cache statistics',
      'POST /api/cron/resync-sheets': 'Resync approved products to Google Sheets (retry failed syncs) [AUTH REQUIRED]',
      'GET /api/cron/status': 'Get current status and statistics',
      'POST /api/cron/test/:category': 'Test RSS parsing for a category',
      'GET /api/products': 'Get all products (supports ?category and ?status filters)',
      'GET /api/products/category/:category': 'Get products by category',
      'GET /api/makers': 'Get all makers (supports ?status filter) [AUTH REQUIRED]',
      'POST /api/makers/:id/approve': 'Approve a maker (auto-syncs to Google Sheets) [AUTH REQUIRED]',
      'POST /api/makers/:id/reject': 'Reject a maker [AUTH REQUIRED]',
      'GET /api/sheets/status': 'Get Google Sheets sync status and statistics',
      'GET /api/debug/enriched': 'Get all products with LinkedIn profiles (for testing)',
      'GET /api/stats': 'Get database statistics',
      'GET /api/status': 'Get system status including cron runs and maker counts',
      'GET /api/health': 'Health check endpoint'
    },
    authentication: {
      method: process.env.AUTH_METHOD || 'basic',
      info: process.env.AUTH_METHOD === 'token' 
        ? 'Use ?token=YOUR_TOKEN or X-Auth-Token header for protected endpoints'
        : 'Use HTTP Basic Auth (username:password) for protected endpoints marked [AUTH REQUIRED]'
    },
    documentation: {
      categories: require('./config/rssCategories'),
      exampleRequests: {
        fetchAll: `POST ${req.protocol}://${req.get('host')}/api/cron/fetch`,
        fetchCategory: `POST ${req.protocol}://${req.get('host')}/api/cron/fetch/developer-tools`,
        getProducts: `GET ${req.protocol}://${req.get('host')}/api/products`,
        getByCategory: `GET ${req.protocol}://${req.get('host')}/api/products/category/saas`,
        getStatus: `GET ${req.protocol}://${req.get('host')}/api/status`
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    }
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'API endpoint not found',
      path: req.path
    }
  });
});

// Serve React app for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// Startup validation and debugging
async function validateStartup() {
  console.log('=== STARTUP VALIDATION ===');
  
  // Check critical dependencies
  console.log('Checking dependencies...');
  try {
    const GoogleSearchResults = require('google-search-results-nodejs');
    console.log('✓ google-search-results-nodejs:', typeof GoogleSearchResults);
    
    const { google } = require('googleapis');
    console.log('✓ googleapis:', typeof google);
  } catch (error) {
    console.error('✗ Dependency check failed:', error.message);
  }
  
  // Check environment variables
  console.log('\nEnvironment Variables:');
  console.log('• NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('• PORT:', process.env.PORT || '5000');
  console.log('• SERPAPI_API_KEY:', !!process.env.SERPAPI_API_KEY ? '[SET]' : '[NOT SET]');
  console.log('• GOOGLE_SHEETS_ID:', !!process.env.GOOGLE_SHEETS_ID ? '[SET]' : '[NOT SET]');
  console.log('• GOOGLE_SERVICE_ACCOUNT_EMAIL:', !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '[SET]' : '[NOT SET]');
  console.log('• GOOGLE_PRIVATE_KEY:', !!process.env.GOOGLE_PRIVATE_KEY ? '[SET]' : '[NOT SET]');
  console.log('• GOOGLE_SERVICE_ACCOUNT_KEY:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? '[SET]' : '[NOT SET]');
  
  // Test Google Sheets service
  console.log('\nTesting Google Sheets service...');
  try {
    const sheetsStatus = await googleSheetsService.getSyncStatus();
    if (sheetsStatus.available) {
      console.log('✓ Google Sheets service: Available');
    } else {
      console.log('✗ Google Sheets service: Not available -', sheetsStatus.error);
    }
  } catch (error) {
    console.log('✗ Google Sheets service: Error -', error.message);
  }
  
  console.log('=== STARTUP VALIDATION COMPLETE ===\n');
}

// Start server
app.listen(PORT, async () => {
  console.log('=================================');
  console.log('🚀 Product Hunt Finder Server');
  console.log('=================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log('=================================');
  
  // Run startup validation
  await validateStartup();
  
  console.log('Available endpoints:');
  console.log(`• POST /api/cron/fetch - Trigger RSS fetch`);
  console.log(`• GET /api/products - Get all products`);
  console.log(`• GET /api/stats - Get statistics`);
  console.log(`• GET /api/status - Get system status`);
  console.log(`• GET /api/health - Health check`);
  console.log(`• GET /api/makers - Get makers [AUTH REQUIRED]`);
  console.log('=================================');
  
  // Log RSS categories
  const rssCategories = require('./config/rssCategories');
  console.log('RSS Categories configured:');
  rssCategories.forEach(category => console.log(`• ${category}`));
  console.log('=================================');
  
  // Log authentication info
  const authMethod = process.env.AUTH_METHOD || 'basic';
  console.log('Authentication:');
  console.log(`• Method: ${authMethod.toUpperCase()}`);
  if (authMethod === 'basic') {
    console.log(`• Username: ${process.env.ADMIN_USERNAME || 'admin'}`);
    console.log(`• Password: ${process.env.ADMIN_PASSWORD ? '[SET]' : '[DEFAULT: admin123]'}`);
  } else {
    console.log(`• Token: ${process.env.ADMIN_TOKEN ? '[SET]' : '[DEFAULT: secure-admin-token-123]'}`);
  }
  console.log('=================================');
});

module.exports = app;
