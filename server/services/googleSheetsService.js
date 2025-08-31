const { google } = require('googleapis');
const path = require('path');

class GoogleSheetsService {
  constructor() {
    this.auth = null;
    this.sheets = null;
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    this.sheetName = process.env.GOOGLE_SHEET_NAME || 'Approved Makers';
    this.initialized = false;
  }

  /**
   * Initialize Google Sheets authentication
   */
  async initialize() {
    try {
      if (this.initialized) {
        return true;
      }

      console.log('=== Google Sheets Service Initialization ===');
      console.log('DEBUG: Environment variables check:');
      console.log('- GOOGLE_SHEETS_ID:', !!process.env.GOOGLE_SHEETS_ID);
      console.log('- GOOGLE_SERVICE_ACCOUNT_EMAIL:', !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
      console.log('- GOOGLE_PRIVATE_KEY:', !!process.env.GOOGLE_PRIVATE_KEY);
      console.log('- GOOGLE_PROJECT_ID:', !!process.env.GOOGLE_PROJECT_ID);
      console.log('- GOOGLE_SERVICE_ACCOUNT_KEY:', !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY);

      // Check if we have the required environment variables
      if (!this.spreadsheetId) {
        console.warn('Google Sheets integration disabled: GOOGLE_SHEETS_ID not configured');
        console.warn('Please set GOOGLE_SHEETS_ID in your environment variables');
        return false;
      }

      let credentials;
      
      // Try to load credentials from file first (for local development)
      try {
        const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
        credentials = require(credentialsPath);
        console.log('✓ Using Google credentials from file: google-credentials.json');
      } catch (fileError) {
        console.log('✗ google-credentials.json not found, trying environment variables...');
        
        // Try to load from environment variables (for Replit/production)
        try {
          // Method 1: Individual environment variables
          if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
            credentials = {
              type: 'service_account',
              client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
              private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
              project_id: process.env.GOOGLE_PROJECT_ID || 'product-hunt-finder'
            };
            console.log('✓ Using Google credentials from individual environment variables');
          }
          // Method 2: JSON string in environment variable
          else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            try {
              credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
              console.log('✓ Using Google credentials from GOOGLE_SERVICE_ACCOUNT_KEY');
            } catch (parseError) {
              throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
            }
          } else {
            throw new Error('No Google credentials found in environment variables');
          }
        } catch (envError) {
          console.error('✗ Google Sheets integration disabled: No valid credentials found');
          console.error('Please set up one of the following:');
          console.error('1. Create google-credentials.json file in project root');
          console.error('2. Set individual environment variables:');
          console.error('   - GOOGLE_SERVICE_ACCOUNT_EMAIL');
          console.error('   - GOOGLE_PRIVATE_KEY');
          console.error('   - GOOGLE_PROJECT_ID (optional)');
          console.error('3. Set GOOGLE_SERVICE_ACCOUNT_KEY with full JSON credentials');
          console.error('');
          console.error('📋 For detailed setup instructions, see: GOOGLE_SHEETS_SETUP_COMPLETE.md');
          console.error('Error details:', envError.message);
          return false;
        }
      }

      // Validate credentials structure
      if (!credentials.client_email || !credentials.private_key) {
        console.error('✗ Invalid credentials: missing client_email or private_key');
        return false;
      }

      // Create auth client
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      // Initialize Sheets API
      this.sheets = google.sheets({ version: 'v4', auth: this.auth });

      // Test the connection
      await this.testConnection();
      
      this.initialized = true;
      console.log('✓ Google Sheets service initialized successfully');
      return true;
    } catch (error) {
      console.error('✗ Failed to initialize Google Sheets service:', error.message);
      console.error('Stack trace:', error.stack);
      return false;
    }
  }

  /**
   * Test the Google Sheets connection
   */
  async testConnection() {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId
      });
      console.log(`Connected to Google Sheet: ${response.data.properties.title}`);
      return true;
    } catch (error) {
      throw new Error(`Failed to connect to Google Sheet: ${error.message}`);
    }
  }

  /**
   * Ensure the header row exists in the sheet
   */
  async ensureHeaderRow() {
    try {
      if (!this.initialized) {
        const success = await this.initialize();
        if (!success) return false;
      }

      // Define the expected headers
      const headers = [
        'Date Approved',
        'Maker Name', 
        'LinkedIn',
        'Product Name',
        'Category',
        'Product Hunt Link'
      ];

      // Check if sheet exists and has headers
      try {
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetName}!A1:F1`
        });

        if (!response.data.values || response.data.values.length === 0) {
          // No headers exist, add them
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A1:F1`,
            valueInputOption: 'RAW',
            resource: {
              values: [headers]
            }
          });
          console.log('Added header row to Google Sheet');
        }
      } catch (sheetError) {
        // Sheet might not exist, try to create it
        if (sheetError.code === 400) {
          await this.createSheet();
          // Add headers to the new sheet
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A1:F1`,
            valueInputOption: 'RAW',
            resource: {
              values: [headers]
            }
          });
          console.log('Created new sheet with headers');
        } else {
          throw sheetError;
        }
      }

      return true;
    } catch (error) {
      console.error('Error ensuring header row:', error.message);
      return false;
    }
  }

  /**
   * Create a new sheet in the spreadsheet
   */
  async createSheet() {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: this.sheetName
              }
            }
          }]
        }
      });
      console.log(`Created new sheet: ${this.sheetName}`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        // Sheet already exists, that's fine
        return;
      }
      throw error;
    }
  }

  /**
   * Check if a maker already exists in the sheet to avoid duplicates
   */
  async checkForDuplicate(productName, makerName, phLink) {
    try {
      if (!this.initialized) {
        const success = await this.initialize();
        if (!success) return false;
      }

      // Get all data from the sheet
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:F`
      });

      if (!response.data.values || response.data.values.length <= 1) {
        return false; // No data rows (only headers or empty)
      }

      // Normalize the product hunt link if provided
      const normalizedLink = phLink ? this.normalizeLink(phLink) : null;

      // Check for duplicates (skip header row)
      const rows = response.data.values.slice(1);
      for (const row of rows) {
        const [, existingMakerName, , existingProductName, , existingPhLink] = row;
        
        // Check by name match
        const nameMatch = existingProductName === productName && existingMakerName === makerName;
        
        // Check by Product Hunt link if available
        let linkMatch = false;
        if (normalizedLink && existingPhLink) {
          linkMatch = this.normalizeLink(existingPhLink) === normalizedLink;
        }
        
        if (nameMatch || linkMatch) {
          return true; // Duplicate found
        }
      }

      return false; // No duplicate found
    } catch (error) {
      console.error('Error checking for duplicates:', error.message);
      return false; // Assume no duplicate on error to allow the addition
    }
  }
  
  /**
   * Normalize a URL to prevent duplicates with different formats
   * @param {string} url - URL to normalize
   * @returns {string} - Normalized URL
   */
  normalizeLink(url) {
    if (!url) return '';
    
    try {
      // Remove trailing slashes and query parameters
      const parsedUrl = new URL(url);
      return parsedUrl.origin + parsedUrl.pathname.replace(/\/$/, '');
    } catch (error) {
      console.warn(`Failed to normalize URL: ${url}`, error.message);
      return url;
    }
  }

  /**
   * Add a new approved maker to the Google Sheet
   */
  async addApprovedMaker(productData) {
    try {
      if (!this.initialized) {
        const success = await this.initialize();
        if (!success) {
          console.log('Google Sheets service not available, skipping sync');
          return false; // Return false instead of throwing error
        }
      }

      // Ensure headers exist
      await this.ensureHeaderRow();

      // Check for duplicates using both name and Product Hunt link
      const isDuplicate = await this.checkForDuplicate(
        productData.name, 
        productData.makerName,
        productData.phLink
      );
      
      if (isDuplicate) {
        console.log(`Skipping duplicate entry: ${productData.name} by ${productData.makerName}`);
        return true; // Return success to avoid retries
      }

      // Prepare the row data
      const rowData = [
        new Date().toISOString().split('T')[0], // Date Approved (YYYY-MM-DD format)
        productData.makerName || 'Unknown',
        productData.linkedin || '',
        productData.name || '',
        productData.category || '',
        productData.phLink || ''
      ];

      // Append the row to the sheet
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:F`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [rowData]
        }
      });

      console.log(`Added approved maker to Google Sheet: ${productData.name} by ${productData.makerName}`);
      return true;
    } catch (error) {
      console.error('Error adding approved maker to Google Sheet:', error.message);
      throw error;
    }
  }

  /**
   * Get sync status and statistics
   */
  async getSyncStatus() {
    try {
      if (!this.initialized) {
        const success = await this.initialize();
        if (!success) {
          return {
            available: false,
            error: 'Service not initialized'
          };
        }
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A:F`
      });

      const totalRows = response.data.values ? response.data.values.length - 1 : 0; // Subtract header row

      return {
        available: true,
        spreadsheetId: this.spreadsheetId,
        sheetName: this.sheetName,
        totalRows,
        lastUpdate: new Date().toISOString()
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }
}

module.exports = new GoogleSheetsService();
