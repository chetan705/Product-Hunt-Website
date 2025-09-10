const Parser = require('rss-parser');
const rssCategories = require('../config/rssCategories');
const dbService = require('./dbService');

class RSSService {
  constructor() {
    this.parser = new Parser({
      customFields: {
        item: [
          ['content:encoded', 'content'],
          ['description', 'rawDescription'],
          ['creator', 'creator'],
          ['author', 'author'],
        ],
      },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    });
    this.baseUrl = 'https://www.producthunt.com/feed';
  }

  /**
   * Fetch and process RSS feeds for all configured categories
   * @returns {Promise<Object>} - Summary of processing results
   */
  async fetchAllCategories() {
    const results = {
      categories: [],
      totalProcessed: 0,
      totalNew: 0,
      totalDuplicates: 0,
      errors: [],
      newItems: [], // Add newItems to collect new products
    };

    console.log(`Starting RSS fetch for ${rssCategories.length} categories...`);

    for (const category of rssCategories) {
      try {
        console.log(`Processing category: ${category}`);
        const categoryResult = await this.fetchCategory(category);

        results.categories.push({
          category,
          processed: categoryResult.processed,
          newProducts: categoryResult.newProducts,
          duplicates: categoryResult.duplicates,
        });

        results.totalProcessed += categoryResult.processed;
        results.totalNew += categoryResult.newProducts;
        results.totalDuplicates += categoryResult.duplicates;
        results.newItems.push(...(categoryResult.newItems || []));
      } catch (error) {
        const errorMessage = error.message.includes('403')
          ? `Failed to fetch RSS feed for ${category}: Status code 403 (Possible authentication required or rate limit)`
          : error.message;
        console.error(`Error processing category ${category}:`, errorMessage);
        results.errors.push({
          category,
          error: errorMessage,
        });
      }
    }

    console.log(
      `RSS fetch completed. Total: ${results.totalProcessed} processed, ${results.totalNew} new, ${results.totalDuplicates} duplicates`
    );
    return results;
  }

  /**
   * Fetch and process RSS feed for a specific category
   * @param {string} category - Product Hunt category
   * @returns {Promise<Object>} - Processing results for the category
   */
  async fetchCategory(category) {
    const url = `${this.baseUrl}?category=${category}`;
    console.log(`Fetching RSS feed: ${url}`);

    try {
      const feed = await this.parser.parseURL(url);
      console.log(`Found ${feed.items.length} items in ${category} feed`);

      const results = {
        processed: 0,
        newProducts: 0,
        duplicates: 0,
        newItems: [], // Track new products
      };

      for (const item of feed.items) {
        try {
          const productData = this.extractProductData(item, category);

          if (productData) {
            const savedProduct = await dbService.saveProduct(productData);
            results.processed++;

            // Enrich with Product Hunt specific details
            try {
              const phEnrichmentService = await import('./phEnrichmentService.js');
              await phEnrichmentService.default.enrichProduct(savedProduct);
            } catch (enrichError) {
              console.warn(
                `Enrichment failed for ${savedProduct.name}:`,
                enrichError.message
              );
            }

            // Check if it was a new product or duplicate
            if (savedProduct.createdAt === savedProduct.updatedAt) {
              results.newProducts++;
              results.newItems.push(savedProduct); // Add to newItems
            } else {
              results.duplicates++;
            }
          }
        } catch (error) {
          console.error(`Error processing item in ${category}:`, error.message);
          console.error('Item data:', JSON.stringify(item, null, 2));
        }
      }

      return results;
    } catch (error) {
      const errorMessage = error.message.includes('403')
        ? `Failed to fetch RSS feed for ${category}: Status code 403 (Possible authentication required or rate limit)`
        : error.message;
      console.error(`Failed to fetch RSS feed for ${category}:`, errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Extract product data from RSS item
   * @param {Object} item - RSS feed item
   * @param {string} category - Product category
   * @returns {Object|null} - Extracted product data or null if invalid
   */
  extractProductData(item, category) {
    try {
      // Basic validation
      if (!item.title || !item.link) {
        console.warn('Skipping item: missing title or link');
        return null;
      }

      // Normalize the Product Hunt link to prevent duplicates
      const normalizedLink = this.normalizeLink(item.link);

      // Extract description from various possible fields
      let description = '';
      if (item.content) {
        description = item.content;
      } else if (item.description) {
        description = item.description;
      } else if (item.rawDescription) {
        description = item.rawDescription;
      }

      // Extract maker name from various possible fields
      let makerName = null;
      if (item.creator) {
        makerName = item.creator;
      } else if (item.author) {
        makerName = item.author;
      } else if (description) {
        makerName = this.extractMakerFromContent(description);
      }

      // Clean and format the data
      const productData = {
        name: this.cleanTitle(item.title),
        description: this.cleanDescription(description),
        category: category,
        publishedAt: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : new Date().toISOString(),
        phLink: normalizedLink,
        originalLink: item.link,
        makerName: makerName ? this.cleanMakerName(makerName) : null,
        upvotes: 0,
        phTopics: [],
        companyWebsite: null,
        companyInfo: null,
        launchDate: null,
        accelerator: null,
        linkedin: null,
      };

      // Validate that we have meaningful data
      if (productData.name.length < 3) {
        console.warn('Skipping item: title too short');
        return null;
      }

      return productData;
    } catch (error) {
      console.error('Error extracting product data:', error.message);
      return null;
    }
  }

  /**
   * Clean and format product title
   * @param {string} title - Raw title from RSS
   * @returns {string} - Cleaned title
   */
  cleanTitle(title) {
    return title
      .replace(/^Product Hunt:\s*/i, '')
      .replace(/\s*-\s*Product Hunt$/i, '')
      .trim()
      .substring(0, 200);
  }

  /**
   * Normalize a URL to prevent duplicates with different formats
   * @param {string} url - URL to normalize
   * @returns {string} - Normalized URL
   */
  normalizeLink(url) {
    if (!url) return '';

    try {
      const parsedUrl = new URL(url);
      return parsedUrl.origin + parsedUrl.pathname.replace(/\/$/, '');
    } catch (error) {
      console.warn(`Failed to normalize URL: ${url}`, error.message);
      return url;
    }
  }

  /**
   * Clean and format product description
   * @param {string} description - Raw description from RSS
   * @returns {string} - Cleaned description
   */
  cleanDescription(description) {
    if (!description) return '';

    let cleaned = description
      .replace(/<[^>]*>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    cleaned = cleaned
      .replace(/Discussion\s*\|\s*Link\s*$/i, '')
      .replace(/Discussion\s*$/i, '')
      .replace(/\|\s*Link\s*$/i, '')
      .trim();

    if (
      cleaned.length < 10 ||
      cleaned.toLowerCase() === 'no description' ||
      cleaned === '|'
    ) {
      return '';
    }

    return cleaned.substring(0, 500);
  }

  /**
   * Extract maker name from content
   * @param {string} content - Content to search
   * @returns {string|null} - Extracted maker name or null
   */
  extractMakerFromContent(content) {
    if (!content) return null;

    const patterns = [
      /by\s+([^<>\n,]+)/i,
      /maker[:\s]+([^<>\n,]+)/i,
      /created by\s+([^<>\n,]+)/i,
      /from\s+([^<>\n,]+)/i,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return this.cleanMakerName(match[1]);
      }
    }

    return null;
  }

  /**
   * Clean and format maker name
   * @param {string} maker - Raw maker name
   * @returns {string} - Cleaned maker name
   */
  cleanMakerName(maker) {
    return maker
      .replace(/<[^>]*>/g, '')
      .replace(/[@#]/g, '')
      .trim()
      .substring(0, 100);
  }

  /**
   * Get RSS feed URL for a category
   * @param {string} category - Product Hunt category
   * @returns {string} - Full RSS URL
   */
  getFeedUrl(category) {
    return `${this.baseUrl}?category=${category}`;
  }

  /**
   * Test RSS parsing for a single category (for debugging)
   * @param {string} category - Category to test
   * @returns {Promise<Object>} - Test results
   */
  async testCategory(category) {
    console.log(`Testing RSS parsing for category: ${category}`);

    try {
      const url = this.getFeedUrl(category);
      const feed = await this.parser.parseURL(url);

      const testResult = {
        category,
        url,
        feedTitle: feed.title,
        itemCount: feed.items.length,
        sampleItems: feed.items.slice(0, 3).map((item) => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          hasDescription: !!item.description,
          hasContent: !!item.content,
        })),
      };

      console.log('Test result:', JSON.stringify(testResult, null, 2));
      return testResult;
    } catch (error) {
      const errorMessage = error.message.includes('403')
        ? `Failed to fetch RSS feed for ${category}: Status code 403 (Possible authentication required or rate limit)`
        : error.message;
      console.error(`Test failed for ${category}:`, errorMessage);
      throw new Error(errorMessage);
    }
  }
}

module.exports = new RSSService();
