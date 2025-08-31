# Production Error Debugging Guide

## Issues Fixed

### 1. GoogleSearchResults Constructor Error

**Error:** `GoogleSearchResults is not a constructor`

**Root Cause:** Incorrect import statement in `server/services/linkedinEnrichmentService.js`

**Fix Applied:**
```javascript
// BEFORE (incorrect)
const { GoogleSearchResults } = require('google-search-results-nodejs');

// AFTER (correct)
const GoogleSearchResults = require('google-search-results-nodejs');
```

**Explanation:** The `google-search-results-nodejs` package exports the constructor directly, not as a named export.

### 2. Google Sheets Service Not Available

**Error:** `Please set up google-credentials.json or environment variables` and `Failed to sync to Google Sheets: Google Sheets service not available`

**Root Cause:** Missing or incorrectly configured Google Sheets credentials

**Fix Applied:** Enhanced error handling and multiple credential loading methods

## Environment Variables Setup

### Required for LinkedIn Enrichment
```bash
SERPAPI_API_KEY=your-serpapi-key-here
```

### Required for Google Sheets Integration

**Method 1: Individual Environment Variables (Recommended for Production)**
```bash
GOOGLE_SHEETS_ID=your-google-sheets-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=your-google-project-id
GOOGLE_SHEET_NAME=Approved Makers
```

**Method 2: JSON Credentials String**
```bash
GOOGLE_SHEETS_ID=your-google-sheets-id
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
GOOGLE_SHEET_NAME=Approved Makers
```

**Method 3: Credentials File (Local Development)**
```bash
GOOGLE_SHEETS_ID=your-google-sheets-id
GOOGLE_SHEET_NAME=Approved Makers
```
Plus create `google-credentials.json` in project root with service account credentials.

## Files Modified

1. **server/services/linkedinEnrichmentService.js**
   - Fixed GoogleSearchResults import
   - Added comprehensive debugging logs
   - Enhanced error handling with stack traces
   - Added dependency type checking

2. **server/services/googleSheetsService.js**
   - Enhanced initialization with detailed logging
   - Added support for multiple credential loading methods
   - Improved error messages with specific setup instructions
   - Added credential validation

3. **server/app.js**
   - Added startup validation function
   - Added dependency checking
   - Added environment variable validation
   - Added Google Sheets service testing on startup

4. **.env.example**
   - Updated with correct environment variable names
   - Added multiple setup methods
   - Added detailed comments and examples

## Debugging Features Added

### 1. Startup Validation
The server now performs comprehensive validation on startup:
- Dependency checking
- Environment variable validation
- Google Sheets service testing
- Detailed logging of configuration status

### 2. Enhanced Error Logging
- Stack traces for all errors
- Detailed debugging information
- Service availability status
- Configuration validation results

### 3. Debug Endpoints
- `GET /api/sheets/status` - Google Sheets service status
- `GET /api/debug/enriched` - View enriched products
- `GET /api/status` - System status and statistics

## Testing the Fixes

### 1. Test LinkedIn Enrichment
```bash
# Check if the service starts without constructor errors
curl -X POST http://localhost:3001/api/cron/enrich
```

### 2. Test Google Sheets Integration
```bash
# Check Google Sheets status
curl http://localhost:3001/api/sheets/status

# Test manual sync (requires auth)
curl -X POST http://localhost:3001/api/cron/resync-sheets \
  -u admin:admin123
```

### 3. Monitor Startup Logs
Look for these validation messages in the startup logs:
```
=== STARTUP VALIDATION ===
Checking dependencies...
✓ google-search-results-nodejs: function
✓ googleapis: object

Environment Variables:
• SERPAPI_API_KEY: [SET] or [NOT SET]
• GOOGLE_SHEETS_ID: [SET] or [NOT SET]
...

Testing Google Sheets service...
✓ Google Sheets service: Available
=== STARTUP VALIDATION COMPLETE ===
```

## Production Deployment Checklist

### 1. Environment Variables
- [ ] `SERPAPI_API_KEY` is set (for LinkedIn enrichment)
- [ ] `GOOGLE_SHEETS_ID` is set (for Google Sheets sync)
- [ ] Google credentials are properly configured (one of the three methods)
- [ ] `NODE_ENV=production`

### 2. Google Sheets Setup
- [ ] Service account created in Google Cloud Console
- [ ] Service account has access to the target Google Sheet
- [ ] Credentials are properly formatted (especially private key with `\n` characters)

### 3. Testing
- [ ] Server starts without errors
- [ ] Startup validation passes
- [ ] LinkedIn enrichment works (if SERPAPI_KEY is set)
- [ ] Google Sheets sync works (if credentials are set)

## Common Issues and Solutions

### Issue: "GoogleSearchResults is not a constructor"
**Solution:** Ensure the import is `const GoogleSearchResults = require('google-search-results-nodejs');` (not destructured)

### Issue: "Google Sheets service not available"
**Solutions:**
1. Check that `GOOGLE_SHEETS_ID` is set
2. Verify credentials are properly configured
3. Ensure service account has access to the sheet
4. Check that private key is properly escaped with `\n` characters

### Issue: "SERPAPI_API_KEY not set"
**Solution:** This is optional. The service will use fallback search (limited functionality) if not set.

## Monitoring

The enhanced logging will help monitor:
- Service initialization status
- API call success/failure rates
- Environment configuration issues
- Dependency loading problems

Check the startup logs and API responses for detailed debugging information.
