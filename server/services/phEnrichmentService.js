const fetch = require('node-fetch');
const { parse } = require('node-html-parser');
const dbService = require('./dbService');
const cacheService = require('./cacheService');

class PhEnrichmentService {
  constructor() {
    this.cacheKeyPrefix = 'ph_enrichment_cache:';
    this.cacheExpiry = parseInt(process.env.PH_ENRICHMENT_CACHE_EXPIRY_HOURS || '24') * 60 * 60 * 1000; // Default 24 hours
  }

  async enrichProduct(product) {
    if (!product || !product.phLink) {
      console.log(`Skipping enrichment for product: ${product?.name || 'unknown'} (No phLink)`);
      return null;
    }

    const cacheKey = `${this.cacheKeyPrefix}${product.id}`;
    const cachedData = await cacheService.getItem(cacheKey);

    if (cachedData && cachedData.phEnrichedAt) {
      const cacheTime = new Date(cachedData.phEnrichedAt).getTime();
      const now = new Date().getTime();
      const cacheAge = now - cacheTime;
      if (cacheAge < 12 * 60 * 60 * 1000) {
        console.log(`PH Enrichment cache hit for product: ${product.name} (Cache age: ${cacheAge / 1000 / 60} minutes)`);
        return { ...product, ...cachedData };
      } else {
        console.log(`PH Enrichment cache expired for product: ${product.name} (Cache age: ${cacheAge / 1000 / 60} minutes)`);
      }
    } else {
      console.log(`No cache found for product: ${product.name}`);
    }

    console.log(`Fetching PH details for: ${product.name} from ${product.phLink}`);
    try {
      const response = await this.fetchWithRetry(product.phLink, 5);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const root = parse(html);

      // Extract day rank
      let phDayRank = null;
      const rankSelectors = [
        '[data-sentry-component="CategoryTags"] a[href*="/categories/"]',
        '[data-test="header"] div:contains("#")',
        '[data-test="product-rank"]',
        '.styles_rankNumber__3m4Vq',
        '.daily-rank',
        '[class*="rank"]'
      ];
      for (const selector of rankSelectors) {
        const rankElement = root.querySelector(selector);
        if (rankElement) {
          const rankText = rankElement.textContent.trim();
          const rankMatch = rankText.match(/#(\d+)/);
          if (rankMatch) {
            phDayRank = parseInt(rankMatch[1], 10);
            console.log(`Found rank for ${product.name}: ${phDayRank} (Selector: ${selector})`);
            break;
          }
        }
      }

      // Extract topics
      const phTopics = [];
      const topicSelectors = [
        '[data-sentry-component="CategoryTags"] a[href*="/categories/"]',
        '[data-test="topic-tag"]',
        '.styles_topic__3qmXI',
        '.tag-link',
        '.category-tag',
        'a[href*="/topics/"]'
      ];
      for (const selector of topicSelectors) {
        const topicElements = root.querySelectorAll(selector);
        for (const element of topicElements) {
          const topicText = element.textContent.trim();
          if (topicText && !phTopics.includes(topicText)) {
            phTopics.push(topicText);
          }
          if (phTopics.length >= 5) break;
        }
        if (phTopics.length > 0) {
          console.log(`Found topics for ${product.name}: ${phTopics.join(', ')} (Selector: ${selector})`);
          break;
        }
      }

      // Extract company website
      let companyWebsite = null;
      const websiteSelectors = [
        'a[data-test="visit-website-button"][href*="?ref=producthunt"]',
        'a[href^="http"]:not([href*="producthunt.com"])',
        '.website-link a',
        '[data-sentry-component="Status"] a[href*="?ref=producthunt"]'
      ];
      for (const selector of websiteSelectors) {
        const websiteElement = root.querySelector(selector);
        if (websiteElement) {
          const href = websiteElement.getAttribute('href');
          if (href && href.startsWith('http') && !href.includes('producthunt.com')) {
            companyWebsite = href.split('?')[0];
            console.log(`Found company website for ${product.name}: ${companyWebsite} (Selector: ${selector})`);
            break;
          }
        }
      }

      // Extract company info
      let companyInfo = null;
      const companyInfoSelectors = [
        '[data-sentry-component="Description"]',
        '.styles_madeBy__2QhJN',
        '[data-test="company-info"]',
        '.post-body',
        '.product-description',
        '[class*="description"]'
      ];
      for (const selector of companyInfoSelectors) {
        const infoElement = root.querySelector(selector);
        if (infoElement) {
          const infoText = infoElement.textContent.trim();
          if (infoText.length > 0) {
            companyInfo = infoText.substring(0, 500);
            console.log(`Found company info for ${product.name}: ${companyInfo.substring(0, 50)}... (Selector: ${selector})`);
            break;
          }
        }
      }
      if (!companyInfo) {
        const metaDesc = root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim();
        if (metaDesc && metaDesc.length > 0) {
          companyInfo = metaDesc.substring(0, 500);
          console.log(`Found meta description for ${product.name}: ${companyInfo.substring(0, 50)}...`);
        }
      }

      // Extract launch date
      let launchDate = null;
      const launchSelectors = [
        '[data-sentry-component="Status"] div:contains("Launched in")',
        '[data-test="header"] div:contains("Launched this")',
        '[data-sentry-component="Status"]',
        '[class*="launched"]'
      ];
      for (const selector of launchSelectors) {
        const launchElement = root.querySelector(selector);
        if (launchElement) {
          const launchText = launchElement.textContent.trim();
          const launchMatch = launchText.match(/Launched in (\d{4})/i) || launchText.match(/Launched this/i);
          if (launchMatch && launchMatch[1]) {
            launchDate = launchMatch[1];
            console.log(`Found launch date for ${product.name}: ${launchDate} (Selector: ${selector})`);
          } else if (launchText.includes('Launched this')) {
            launchDate = new Date().getFullYear().toString();
            console.log(`Found launch date for ${product.name}: ${launchDate} (Inferred from "Launched this week")`);
          }
          break;
        }
      }

      // Extract accelerator
      let accelerator = null;
      const acceleratorSelectors = [
        '[data-sentry-component="Description"]',
        '[data-sentry-component="Status"]',
        '.company-info',
        '[class*="accelerator"]'
      ];
      for (const selector of acceleratorSelectors) {
        const infoElement = root.querySelector(selector);
        if (infoElement) {
          const infoText = infoElement.textContent.trim();
          if (infoText.includes('Y Combinator') || infoText.includes('YC')) {
            accelerator = 'Y Combinator';
            console.log(`Found accelerator for ${product.name}: ${accelerator} (Selector: ${selector})`);
            break;
          }
        }
      }

      // Extract LinkedIn URL with validation
      let linkedinUrl = null;
      const linkedinSelectors = [
        '[data-sentry-component="SocialLinks"] a[href*="linkedin.com/in/"]',
        '.social-link--linkedin',
        '[data-test="linkedin-link"]',
        'a[href*="linkedin.com/in/"]'
      ];
      for (const selector of linkedinSelectors) {
        const linkedinElement = root.querySelector(selector);
        if (linkedinElement) {
          const href = linkedinElement.getAttribute('href');
          if (href && href.includes('linkedin.com') && !href.includes('producthunt.com')) {
            linkedinUrl = href;
            console.log(`Found LinkedIn for ${product.name}: ${linkedinUrl} (Selector: ${selector})`);
            break;
          }
        }
      }

      // Extract GitHub URL
      let phGithub = null;
      const githubSelectors = [
        '[data-sentry-component="Status"] a[href*="github.com"]',
        '.social-link--github',
        '[data-test="github-link"]',
        'a[href*="github.com"]'
      ];
      for (const selector of githubSelectors) {
        const githubElement = root.querySelector(selector);
        if (githubElement) {
          const href = githubElement.getAttribute('href');
          if (href && href.includes('github.com') && !href.includes('login') && !href.includes('producthunt.com')) {
            phGithub = href.split('?')[0];
            console.log(`Found GitHub for ${product.name}: ${phGithub} (Selector: ${selector})`);
            break;
          }
        }
      }

      // Extract product thumbnail image
      let thumbnail = null;
      const thumbnailSelectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        '[data-test="thumbnail"] img',
        '[data-sentry-component="Header"] img',
        '.styles_thumbnail__1Pg2J img',
        '.thumbnail img',
        '[class*="thumbnail"] img',
        '[class*="logo"] img',
        'img[src*="ph-files.imgix.net"]',
        'img[src*="producthunt"][src*="image"]'
      ];
      for (const selector of thumbnailSelectors) {
        const thumbnailElement = root.querySelector(selector);
        if (thumbnailElement) {
          let src = thumbnailElement.getAttribute('content') || thumbnailElement.getAttribute('src');
          if (src && src.startsWith('http')) {
            // Prefer the highest resolution from srcset if available
            const srcset = thumbnailElement.getAttribute('srcset');
            if (srcset) {
              const sources = srcset.split(',').map(s => s.trim().split(' '));
              const highestRes = sources.reduce((max, [url, res]) => {
                const resNum = parseInt(res) || 1;
                return resNum > max.res ? {url, res: resNum} : max;
              }, {url: src, res: 1});
              src = highestRes.url;
            }
            thumbnail = { url: src };
            console.log(`Found thumbnail for ${product.name}: ${src} (Selector: ${selector})`);
            break;
          }
        }
      }

      const enrichedData = {
        phDayRank: phDayRank > 0 ? phDayRank : (product.phDayRank || null),
        phTopics: phTopics.length > 0 ? phTopics : (product.phTopics || []),
        companyWebsite: companyWebsite || product.companyWebsite || null,
        companyInfo: companyInfo || product.companyInfo || null,
        launchDate: launchDate || product.launchDate || null,
        accelerator: accelerator || product.accelerator || null,
        linkedin: linkedinUrl || product.linkedin || null,
        phGithub: phGithub || product.phGithub || null,
        thumbnail: thumbnail || product.thumbnail || null,
        phEnrichedAt: new Date().toISOString()
      };

      console.log(`Saving enriched data for ${product.name}:`, JSON.stringify(enrichedData, null, 2));
      await cacheService.setItem(cacheKey, enrichedData, this.cacheExpiry);
      await dbService.updateProductPhDetails(product.id, enrichedData);

      return { ...product, ...enrichedData };
    } catch (error) {
      console.error(`Error enriching PH details for ${product.name}:`, error.message);
      return product;
    }
  }

  async enrichNewProducts(products) {
    console.log(`Starting enrichNewProducts for ${products.length} products...`);
    let enrichedCount = 0;
    const errors = [];

    for (const product of products) {
      // Skip products that are already enriched and have a recent phEnrichedAt timestamp
      if (product.phEnrichedAt) {
        const enrichedTime = new Date(product.phEnrichedAt).getTime();
        const now = new Date().getTime();
        const age = now - enrichedTime;
        if (age < this.cacheExpiry) {
          console.log(`Skipping already enriched product: ${product.name} (Enriched ${age / 1000 / 60} minutes ago)`);
          continue;
        }
      }

      console.log(`Processing new or unenriched product: ${product.name} (ID: ${product.id})`);
      const updatedProduct = await this.enrichProduct(product);
      if (updatedProduct && (
        updatedProduct.phDayRank !== product.phDayRank ||
        updatedProduct.phTopics.length !== product.phTopics.length ||
        updatedProduct.companyWebsite !== product.companyWebsite ||
        updatedProduct.companyInfo !== product.companyInfo ||
        updatedProduct.launchDate !== product.launchDate ||
        updatedProduct.accelerator !== product.accelerator ||
        updatedProduct.linkedin !== product.linkedin ||
        updatedProduct.phGithub !== product.phGithub ||
        (updatedProduct.thumbnail?.url !== product.thumbnail?.url)
      )) {
        enrichedCount++;
        console.log(`Product updated: ${product.name}`);
      } else {
        console.log(`No updates needed for: ${product.name}`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
    }

    console.log(`New products enrichment completed. ${enrichedCount} products updated. ${errors.length} errors.`);
    return { totalEnriched: enrichedCount, errors };
  }

  async fetchWithRetry(url, retries = 5) {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`Fetching ${url} (Attempt ${i + 1}/${retries})`);
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        if (!response.ok) {
          console.error(`Fetch failed for ${url}: HTTP ${response.status} ${response.statusText}`);
          throw new Error(`HTTP error: ${response.status}`);
        }
        console.log(`Fetch successful for ${url}`);
        return response;
      } catch (error) {
        console.error(`Fetch attempt ${i + 1} failed for ${url}: ${error.message}`);
        if (i === retries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 3000 * (i + 1)));
      }
    }
  }
}

module.exports = new PhEnrichmentService();
