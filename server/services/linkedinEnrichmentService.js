const { GoogleSearch } = require('google-search-results-nodejs');
const https = require('https');
const dbService = require('./dbService');
const cacheService = require('./cacheService');

class LinkedInEnrichmentService {
  constructor() {
    this.serpApiKey = process.env.SERPAPI_API_KEY;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Enrich products with LinkedIn profiles
   * @param {Array} products - Array of products to enrich (optional, will fetch if not provided)
   * @returns {Promise<Object>} - Enrichment results
   */
  async enrichProducts(products = null) {
    const startTime = Date.now();
    console.log('=== LinkedIn Enrichment Started ===');

    try {
      // Get products that need enrichment if not provided
      if (!products) {
        products = await dbService.getProductsNeedingEnrichment();
      }

      console.log(`Found ${products.length} products needing LinkedIn enrichment`);

      const results = {
        totalProcessed: 0,
        successfulEnrichments: 0,
        failedEnrichments: 0,
        cacheHits: 0,
        errors: []
      };

      // Process each product
      for (const product of products) {
        try {
          console.log(`Processing: ${product.name} (Maker: ${product.makerName})`);
          
          const linkedinUrl = await this.findLinkedInProfile(product.makerName);
          
          // Update product with LinkedIn information
          await dbService.updateProductLinkedIn(product.id, linkedinUrl);
          
          results.totalProcessed++;
          if (linkedinUrl) {
            results.successfulEnrichments++;
          } else {
            results.failedEnrichments++;
          }

          // Check if this was a cache hit
          const cachedResult = await cacheService.getLinkedInCache(product.makerName);
          if (cachedResult !== null && cachedResult === linkedinUrl) {
            results.cacheHits++;
          }

          // Add delay between requests to be respectful
          await this.delay(500);

        } catch (error) {
          console.error(`Error enriching product ${product.name}:`, error.message);
          results.errors.push({
            productId: product.id,
            productName: product.name,
            makerName: product.makerName,
            error: error.message
          });
          results.failedEnrichments++;
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log('=== LinkedIn Enrichment Completed ===');
      console.log(`Duration: ${duration}ms`);
      console.log(`Total processed: ${results.totalProcessed}`);
      console.log(`Successful: ${results.successfulEnrichments}`);
      console.log(`Failed: ${results.failedEnrichments}`);
      console.log(`Cache hits: ${results.cacheHits}`);

      return results;

    } catch (error) {
      console.error('LinkedIn enrichment failed:', error.message);
      throw error;
    }
  }

  /**
   * Find LinkedIn profile for a maker
   * @param {string} makerName - Name of the maker
   * @returns {Promise<string|null>} - LinkedIn profile URL or null
   */
  async findLinkedInProfile(makerName) {
    if (!makerName || makerName.trim().length === 0) {
      return null;
    }

    // Check cache first using the new cache service
    const cachedResult = await cacheService.getLinkedInCache(makerName);
    if (cachedResult !== null) {
      return cachedResult;
    }

    try {
      let linkedinUrl = null;

      // Try SerpAPI first if available
      if (this.serpApiKey) {
        linkedinUrl = await this.searchWithSerpAPI(makerName);
      } else {
        // Fallback to simple search (limited functionality)
        console.log('No SerpAPI key found, using fallback search method');
        linkedinUrl = await this.searchWithFallback(makerName);
      }

      // Cache the result using the new cache service
      await cacheService.setLinkedInCache(makerName, linkedinUrl);
      
      return linkedinUrl;

    } catch (error) {
      console.error(`Error searching for LinkedIn profile of ${makerName}:`, error.message);
      
      // Cache null result to avoid repeated failed searches
      await cacheService.setLinkedInCache(makerName, null);
      return null;
    }
  }

  /**
   * Search using SerpAPI
   * @param {string} makerName - Maker name
   * @returns {Promise<string|null>} - LinkedIn profile URL or null
   */
  async searchWithSerpAPI(makerName) {
    try {
      // Debug: Check if GoogleSearch is properly imported
      console.log('DEBUG: GoogleSearch type:', typeof GoogleSearch);
      console.log('DEBUG: SerpAPI key available:', !!this.serpApiKey);
      
      if (!GoogleSearch) {
        throw new Error('GoogleSearch is not properly imported');
      }
      
      if (typeof GoogleSearch !== 'function') {
        throw new Error(`GoogleSearch is not a constructor. Type: ${typeof GoogleSearch}`);
      }

      const search = new GoogleSearch(this.serpApiKey);
      const cleanMakerName = this.cleanMakerName(makerName);
      const searchQuery = `"${cleanMakerName}" site:linkedin.com/in`;

      console.log(`SerpAPI search: ${searchQuery}`);

      return new Promise((resolve, reject) => {
        search.json({
          q: searchQuery,
          num: 5, // Get top 5 results
          safe: 'active'
        }, (result) => {
          try {
            if (result.error) {
              console.error('SerpAPI error:', result.error);
              return resolve(null);
            }

            const organicResults = result.organic_results || [];
            
            // Find the best LinkedIn profile match
            const linkedinProfile = this.findBestLinkedInMatch(organicResults, makerName);
            
            if (linkedinProfile) {
              console.log(`Found LinkedIn profile: ${linkedinProfile}`);
            } else {
              console.log(`No LinkedIn profile found for: ${makerName}`);
            }

            resolve(linkedinProfile);

          } catch (error) {
            console.error('Error processing SerpAPI results:', error.message);
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error(`Error in searchWithSerpAPI for ${makerName}:`, error.message);
      console.error('Stack trace:', error.stack);
      return null;
    }
  }

  /**
   * Fallback search method (limited functionality)
   * @param {string} makerName - Maker name
   * @returns {Promise<string|null>} - LinkedIn profile URL or null
   */
  async searchWithFallback(makerName) {
    const cleanMakerName = this.cleanMakerName(makerName);
    // This is a very basic fallback - in production, you might want to use
    // other search APIs or scraping methods
    console.log(`Fallback search for: ${cleanMakerName}`);
    
    // For now, just return null as we can't effectively search without proper API
    // In a real implementation, you might use other search APIs or methods
    return null;
  }

  /**
   * Find the best LinkedIn profile match from search results
   * @param {Array} results - Search results
   * @param {string} makerName - Original maker name
   * @returns {string|null} - Best LinkedIn profile URL or null
   */
  findBestLinkedInMatch(results, makerName) {
    if (!results || results.length === 0) {
      return null;
    }

    // Filter LinkedIn results
    const linkedinResults = results.filter(result => 
      result.link && result.link.includes('linkedin.com/in/')
    );

    if (linkedinResults.length === 0) {
      return null;
    }

    // Score results based on title and snippet matching
    const scoredResults = linkedinResults.map(result => {
      const title = (result.title || '').toLowerCase();
      const snippet = (result.snippet || '').toLowerCase();
      const makerNameLower = makerName.toLowerCase();
      
      let score = 0;

      // Higher score for exact name match in title
      if (title.includes(makerNameLower)) {
        score += 10;
      }

      // Score for partial name matches
      const nameWords = makerNameLower.split(/\s+/);
      nameWords.forEach(word => {
        if (word.length > 2) { // Ignore very short words
          if (title.includes(word)) score += 2;
          if (snippet.includes(word)) score += 1;
        }
      });

      return {
        ...result,
        score
      };
    });

    // Sort by score (highest first)
    scoredResults.sort((a, b) => b.score - a.score);

    // Return the best match if it has a reasonable score
    if (scoredResults[0].score > 0) {
      return scoredResults[0].link;
    }

    return null;
  }

  /**
   * Clean maker name for searching
   * @param {string} makerName - Raw maker name
   * @returns {string} - Cleaned maker name
   */
  cleanMakerName(makerName) {
    return makerName
      .replace(/[^\w\s\-\.]/g, '') // Remove special characters except hyphens and dots
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 50); // Limit length
  }

  /**
   * Add delay between requests
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} - Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear the search cache
   */
  async clearCache() {
    const results = await cacheService.clearLinkedInCache();
    console.log('LinkedIn search cache cleared:', results);
    return results;
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} - Cache statistics
   */
  async getCacheStats() {
    return await cacheService.getCacheStats();
  }
}

module.exports = new LinkedInEnrichmentService();
