const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

class DatabaseService {
  constructor() {
    this.storage = 'local';
    this.dbPath = path.join(process.cwd(), 'data', 'products.json');
    this.initLocalStorage();
  }

  async initLocalStorage() {
    try {
      const dir = path.dirname(this.dbPath);
      await fs.mkdir(dir, { recursive: true });
      
      try {
        await fs.access(this.dbPath);
      } catch {
        await fs.writeFile(this.dbPath, JSON.stringify({
          products: {},
          productList: [],
          metadata: {
            lastUpdated: null,
            totalCount: 0
          },
          cache: {},
          schedule: {},
          misc: {}
        }, null, 2));
        console.log(`Initialized database at ${this.dbPath}`);
      }
    } catch (error) {
      console.error('Error initializing local storage:', error.message);
    }
  }

  async readLocalData() {
    try {
      const data = await fs.readFile(this.dbPath, 'utf8');
      const parsed = JSON.parse(data);
      
      if (!parsed.cache) parsed.cache = {};
      if (!parsed.schedule) parsed.schedule = {};
      if (!parsed.misc) parsed.misc = {};
      
      return parsed;
    } catch (error) {
      console.error('Error reading local data:', error.message);
      return { 
        products: {}, 
        productList: [],
        metadata: { lastUpdated: null, totalCount: 0 },
        cache: {},
        schedule: {},
        misc: {}
      };
    }
  }

  async writeLocalData(data) {
    try {
      await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
      console.log('Database updated successfully');
    } catch (error) {
      console.error('Error writing local data:', error.message);
    }
  }

  async getItem(key) {
    try {
      const data = await this.readLocalData();
      
      if (!data.cache) data.cache = {};
      if (!data.schedule) data.schedule = {};
      if (!data.misc) data.misc = {};
      
      if (key === 'product:list') {
        return data.productList;
      } else if (key.startsWith('product:')) {
        const productId = key.replace('product:', '');
        return data.products[productId] || null;
      } else if (key === 'metadata') {
        return data.metadata;
      } else if (key.startsWith('linkedin_cache:') || key.startsWith('ph_enrichment_cache:')) {
        return data.cache[key] || null;
      } else if (key.startsWith('schedule:')) {
        return data.schedule[key] || null;
      } else {
        return data.misc[key] || null;
      }
    } catch (error) {
      console.error(`Error getting item ${key}:`, error.message);
      return null;
    }
  }

  async setItem(key, value) {
    try {
      const data = await this.readLocalData();
      
      if (!data.cache) data.cache = {};
      if (!data.schedule) data.schedule = {};
      if (!data.misc) data.misc = {};
      
      if (key === 'product:list') {
        data.productList = value;
      } else if (key.startsWith('product:')) {
        const productId = key.replace('product:', '');
        data.products[productId] = value;
        data.metadata.totalCount = Object.keys(data.products).length;
        data.metadata.lastUpdated = new Date().toISOString();
      } else if (key === 'metadata') {
        data.metadata = value;
      } else if (key.startsWith('linkedin_cache:') || key.startsWith('ph_enrichment_cache:')) {
        data.cache[key] = value;
      } else if (key.startsWith('schedule:')) {
        data.schedule[key] = value;
      } else {
        data.misc[key] = value;
      }
      
      await this.writeLocalData(data);
      return true;
    } catch (error) {
      console.error(`Error setting item ${key}:`, error.message);
      return false;
    }
  }

  async getProductList() {
    const list = await this.getItem('product:list');
    return list || [];
  }

  async addToProductList(productId) {
    const list = await this.getProductList();
    if (!list.includes(productId)) {
      list.push(productId);
      await this.setItem('product:list', list);
    }
  }

  async saveProduct(productData) {
    try {
      const existingProduct = await this.findProductByLink(productData.phLink);
      if (existingProduct) {
        if (existingProduct.status === 'rejected') {
          console.log(`Skipping previously rejected product: ${productData.name}`);
          return existingProduct;
        }
        
        console.log(`Product already exists: ${productData.name} (${productData.phLink})`);
        return existingProduct;
      }

      const product = {
        id: uuidv4(),
        name: productData.name,
        description: productData.description,
        category: productData.category,
        publishedAt: productData.publishedAt,
        phLink: productData.phLink,
        makerName: productData.makerName || null,
        linkedin: productData.linkedin || null,
        phUpvotes: productData.phUpvotes || 0, // Use phUpvotes instead of upvotes
        phVotes: productData.phVotes || 0,
        phDayRank: productData.phDayRank || null,
        phTopics: productData.phTopics || [],
        companyWebsite: productData.companyWebsite || null,
        companyInfo: productData.companyInfo || null,
        launchDate: productData.launchDate || null,
        accelerator: productData.accelerator || null,
        phGithub: productData.phGithub || null,
        thumbnail: productData.thumbnail || null,
        status: 'pending',
        syncedToSheets: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const key = `product:${product.id}`;
      await this.setItem(key, product);
      await this.addToProductList(product.id);

      console.log(`Product saved: ${product.name} [${product.category}]`);
      return product;
    } catch (error) {
      console.error('Error saving product:', error.message);
      throw error;
    }
  }

  async findProductByLink(phLink) {
    try {
      if (!phLink) {
        console.warn('Cannot find product with empty link');
        return null;
      }
      
      const normalizedLink = this.normalizeProductHuntLink(phLink);
      const productIds = await this.getProductList();
      
      for (const id of productIds) {
        const product = await this.getItem(`product:${id}`);
        if (product && this.normalizeProductHuntLink(product.phLink) === normalizedLink) {
          return product;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding product by link:', error.message);
      return null;
    }
  }
  
  normalizeProductHuntLink(link) {
    if (!link) return '';
    
    try {
      const url = new URL(link);
      return url.origin + url.pathname.replace(/\/$/, '');
    } catch (error) {
      return link;
    }
  }

  async getAllProducts() {
    try {
      const productIds = await this.getProductList();
      const products = [];

      for (const id of productIds) {
        const product = await this.getItem(`product:${id}`);
        if (product) {
          products.push(product);
        }
      }

      return products.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    } catch (error) {
      console.error('Error getting all products:', error.message);
      return [];
    }
  }

  async getProductsByCategory(category) {
    try {
      const allProducts = await this.getAllProducts();
      return allProducts.filter(product => product.category === category);
    } catch (error) {
      console.error('Error getting products by category:', error.message);
      return [];
    }
  }

  async getProductsByStatus(status) {
    try {
      const allProducts = await this.getAllProducts();
      return allProducts.filter(product => product.status === status);
    } catch (error) {
      console.error('Error getting products by status:', error.message);
      return [];
    }
  }

  async updateProductLinkedIn(productId, linkedin) {
    try {
      const product = await this.getItem(`product:${productId}`);
      if (!product) {
        console.error(`Product not found: ${productId}`);
        return null;
      }

      product.linkedin = linkedin;
      product.updatedAt = new Date().toISOString();

      await this.setItem(`product:${productId}`, product);
      
      console.log(`Updated LinkedIn for product: ${product.name} -> ${linkedin || 'null'}`);
      return product;
    } catch (error) {
      console.error('Error updating product LinkedIn:', error.message);
      return null;
    }
  }

  async updateProductStatus(productId, status) {
    try {
      const product = await this.getItem(`product:${productId}`);
      if (!product) {
        console.error(`Product not found: ${productId}`);
        return false;
      }

      product.status = status;
      product.updatedAt = new Date().toISOString();
      
      if (status === 'approved') {
        product.approvedAt = new Date().toISOString();
      }

      await this.setItem(`product:${productId}`, product);
      
      console.log(`Updated status for product: ${product.name} -> ${status}`);
      return true;
    } catch (error) {
      console.error('Error updating product status:', error.message);
      return false;
    }
  }

  async getProductsNeedingEnrichment() {
    try {
      const allProducts = await this.getAllProducts();
      return allProducts.filter(product => 
        product.status === 'pending' && 
        (product.linkedin === null || product.linkedin === undefined) && 
        product.makerName !== null
      );
    } catch (error) {
      console.error('Error getting products needing enrichment:', error.message);
      return [];
    }
  }

  async updateProductSheetsSyncStatus(productId, synced) {
    try {
      const product = await this.getItem(`product:${productId}`);
      if (!product) {
        console.error(`Product not found: ${productId}`);
        return false;
      }

      product.syncedToSheets = synced;
      product.updatedAt = new Date().toISOString();
      
      if (synced) {
        product.syncedToSheetsAt = new Date().toISOString();
      }

      await this.setItem(`product:${productId}`, product);
      
      console.log(`Updated sheets sync status for product: ${product.name} -> ${synced}`);
      return true;
    } catch (error) {
      console.error('Error updating product sheets sync status:', error.message);
      return false;
    }
  }

  async getApprovedProductsNeedingSync() {
    try {
      const allProducts = await this.getAllProducts();
      return allProducts.filter(product => 
        product.status === 'approved' && 
        !product.syncedToSheets
      );
    } catch (error) {
      console.error('Error getting approved products needing sync:', error.message);
      return [];
    }
  }

  async getStats() {
    try {
      const products = await this.getAllProducts();
      
      const enrichedCount = products.filter(p => p.hasOwnProperty('linkedin')).length;
      
      const needingEnrichmentCount = products.filter(p => 
        p.status === 'pending' && 
        !p.hasOwnProperty('linkedin') && 
        p.makerName !== null
      ).length;

      const stats = {
        totalProducts: products.length,
        enrichedProducts: enrichedCount,
        needingEnrichment: needingEnrichmentCount,
        linkedinFound: products.filter(p => p.linkedin && p.linkedin !== null).length,
        approvedProducts: products.filter(p => p.status === 'approved').length,
        syncedToSheets: products.filter(p => p.syncedToSheets === true).length,
        needingSheetsSync: products.filter(p => p.status === 'approved' && !p.syncedToSheets).length,
        totalUpvotes: products.reduce((sum, p) => sum + (p.phUpvotes || p.upvotes || 0), 0), // Use phUpvotes, fallback to upvotes
        byCategory: {},
        byStatus: {},
        lastUpdated: products.length > 0 ? products[0].createdAt : null
      };

      products.forEach(product => {
        stats.byCategory[product.category] = (stats.byCategory[product.category] || 0) + 1;
        stats.byStatus[product.status] = (stats.byStatus[product.status] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting stats:', error.message);
      return { totalProducts: 0, byCategory: {}, byStatus: {}, totalUpvotes: 0 };
    }
  }

  async deleteItem(key) {
    try {
      const data = await this.readLocalData();
      
      if (key === 'product:list') {
        data.productList = [];
      } else if (key.startsWith('product:')) {
        const productId = key.replace('product:', '');
        if (data.products[productId]) {
          delete data.products[productId];
          const index = data.productList.indexOf(productId);
          if (index > -1) {
            data.productList.splice(index, 1);
          }
        }
      } else if (key.startsWith('linkedin_cache:') || key.startsWith('ph_enrichment_cache:')) {
        if (data.cache[key]) {
          delete data.cache[key];
        }
      } else if (key.startsWith('schedule:')) {
        if (data.schedule[key]) {
          delete data.schedule[key];
        }
      } else {
        if (data.misc[key]) {
          delete data.misc[key];
        }
      }
      
      await this.writeLocalData(data);
      console.log(`Deleted item: ${key}`);
      return true;
    } catch (error) {
      console.error(`Error deleting item ${key}:`, error.message);
      return false;
    }
  }

  async getKeysByPattern(pattern) {
    try {
      const data = await this.readLocalData();
      const keys = [];
      
      if (pattern.startsWith('product:')) {
        if (pattern === 'product:*') {
          data.productList.forEach(id => keys.push(`product:${id}`));
        }
      } else if (pattern.startsWith('linkedin_cache:') || key.startsWith('ph_enrichment_cache:')) {
        Object.keys(data.cache).forEach(key => {
          if (this.matchPattern(key, pattern)) {
            keys.push(key);
          }
        });
      } else if (pattern.startsWith('schedule:')) {
        Object.keys(data.schedule).forEach(key => {
          if (this.matchPattern(key, pattern)) {
            keys.push(key);
          }
        });
      } else {
        Object.keys(data.misc).forEach(key => {
          if (this.matchPattern(key, pattern)) {
            keys.push(key);
          }
        });
      }
      
      console.log(`Found ${keys.length} keys for pattern: ${pattern}`);
      return keys;
    } catch (error) {
      console.error(`Error getting keys by pattern ${pattern}:`, error.message);
      return [];
    }
  }

  matchPattern(key, pattern) {
    if (!pattern.includes('*')) {
      return key === pattern;
    }
    
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }

  async updateProductPhDetails(productId, phDetails) {
    try {
      const data = await this.readLocalData();

      if (!data.products[productId]) {
        console.error(`Product not found: ${productId}`);
        return {
          success: false,
          error: 'Product not found'
        };
      }

      data.products[productId] = {
        ...data.products[productId],
        ...phDetails,
        phGithub: phDetails.phGithub,
        thumbnail: phDetails.thumbnail || data.products[productId].thumbnail,
        updatedAt: new Date().toISOString()
      };

      await this.writeLocalData(data);

      console.log(`Updated PH details for product: ${data.products[productId].name}`);
      return {
        success: true,
        product: data.products[productId]
      };
    } catch (error) {
      console.error(`Error updating PH details for product ${productId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateProductFields(productId, fields) {
    try {
      const product = await this.getItem(`product:${productId}`);
      if (!product) {
        console.error(`Product not found: ${productId}`);
        return null;
      }
      const updated = { ...product, ...fields, updatedAt: new Date().toISOString() };
      await this.setItem(`product:${productId}`, updated);
      console.log(`Updated fields for product: ${product.name}`);
      return updated;
    } catch (error) {
      console.error('Error updating product fields:', error.message);
      return null;
    }
  }
}

module.exports = new DatabaseService();
