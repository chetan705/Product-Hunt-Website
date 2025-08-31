# Google Sheets Integration Setup Guide

This guide will help you set up Google Sheets integration for automatically exporting approved makers to a Google Sheets document.

## Overview

When a maker is approved from the admin UI, their information is automatically added as a row to a specified Google Sheet with the following columns:

- **Date Approved**: YYYY-MM-DD format
- **Maker Name**: Name of the maker
- **LinkedIn**: LinkedIn profile URL (if available)
- **Product Name**: Name of the product
- **Category**: Product category
- **Product Hunt Link**: URL to the Product Hunt listing

## Prerequisites

- Google account
- Google Cloud Console access
- A Google Sheets document where you want to export the data

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet or use an existing one
3. Note the spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/1abc123def456ghi789jkl/edit
                                    ^^^^^^^^^^^^^^^^^^^
                                    This is your Spreadsheet ID
   ```

## Step 2: Set up Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

## Step 3: Create Service Account

1. In Google Cloud Console, go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Enter a name (e.g., "product-hunt-finder-sheets")
4. Click "Create and Continue"
5. For role, select "Editor" or create a custom role with Sheets access
6. Click "Continue" and then "Done"

## Step 4: Generate Service Account Key

1. Click on the service account you just created
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format
5. Download the JSON file

## Step 5: Share Google Sheet with Service Account

1. Open your Google Sheet
2. Click the "Share" button
3. Add the service account email (found in the JSON file as `client_email`)
4. Give it "Editor" permissions
5. Click "Send"

## Step 6: Configure Environment Variables

### Option A: Using JSON file (Local Development)

1. Rename the downloaded JSON file to `google-credentials.json`
2. Place it in the root directory of your project (same level as `package.json`)
3. Add to your `.env` file:
   ```env
   GOOGLE_SHEETS_ID=your_spreadsheet_id_here
   GOOGLE_SHEET_NAME=Approved Makers
   ```

### Option B: Using Environment Variables (Replit/Production)

Extract the following values from your JSON file and add them to your `.env` file:

```env
GOOGLE_SHEETS_ID=your_spreadsheet_id_here
GOOGLE_SHEET_NAME=Approved Makers
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=your-project-id
```

**Important Notes:**
- The private key must include the full key with `\n` characters for line breaks
- In Replit, you can use Secrets instead of the `.env` file for sensitive data

## Step 7: Test the Integration

1. Start your server:
   ```bash
   npm start
   ```

2. Check if Google Sheets integration is working:
   ```bash
   curl http://localhost:3000/api/sheets/status
   ```

3. If successful, you should see a response indicating the Google Sheets service is available.

## API Endpoints

### Check Google Sheets Status
```http
GET /api/sheets/status
```

Returns the current status of Google Sheets integration and sync statistics.

### Manual Resync
```http
POST /api/cron/resync-sheets
```

Manually triggers a resync of all approved products that haven't been synced to Google Sheets yet.

### Approve Maker (with auto-sync)
```http
POST /api/makers/:id/approve
```

Approves a maker and automatically attempts to sync to Google Sheets. If the sync fails, the approval still succeeds and can be retried later.

## Troubleshooting

### Common Issues

1. **"Google Sheets integration disabled: GOOGLE_SHEETS_ID not configured"**
   - Make sure you've set the `GOOGLE_SHEETS_ID` environment variable

2. **"Failed to connect to Google Sheet: The caller does not have permission"**
   - Make sure you've shared the Google Sheet with the service account email
   - Verify the service account has "Editor" permissions

3. **"No Google credentials found in environment"**
   - For local development: Ensure `google-credentials.json` exists in the root directory
   - For production: Ensure all required environment variables are set correctly

4. **"Invalid private key"**
   - Make sure the private key includes proper line breaks (`\n`)
   - Ensure the key is properly quoted in the environment variable

### Enable Debug Logging

Add this to your `.env` file to see detailed Google Sheets API logs:
```env
DEBUG=googleapis:*
```

### Test Individual Components

1. **Test database sync status tracking:**
   ```bash
   curl http://localhost:3000/api/stats
   ```
   Look for `syncedToSheets` and `needingSheetsSync` in the response.

2. **Test manual resync:**
   ```bash
   curl -X POST http://localhost:3000/api/cron/resync-sheets
   ```

## Security Considerations

1. **Never commit credentials to version control**
   - Add `google-credentials.json` to your `.gitignore`
   - Use environment variables or secrets management for production

2. **Limit service account permissions**
   - Only grant the minimum required permissions
   - Consider creating a custom role with only Google Sheets API access

3. **Rotate credentials regularly**
   - Generate new service account keys periodically
   - Delete old keys from Google Cloud Console

## Production Deployment

### Replit
1. Use Replit Secrets for sensitive environment variables
2. Set each variable individually:
   - `GOOGLE_SHEETS_ID`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `GOOGLE_PROJECT_ID`

### Other Platforms
1. Use the platform's environment variable management
2. Ensure all required variables are set
3. Test the integration after deployment

## Sheet Format

The Google Sheet will automatically have the following structure:

| Date Approved | Maker Name | LinkedIn | Product Name | Category | Product Hunt Link |
|---------------|------------|-----------|--------------|----------|-------------------|
| 2025-01-15    | John Doe   | https... | My App       | SaaS     | https...          |

- Headers are automatically created if they don't exist
- Each approved maker gets one row
- Duplicate entries are automatically prevented
- Data is appended to the bottom of the sheet

## Monitoring and Maintenance

1. **Regular Health Checks**
   - Monitor the `/api/sheets/status` endpoint
   - Set up alerts for sync failures

2. **Manual Resync**
   - Run `/api/cron/resync-sheets` periodically to catch any failed syncs
   - Consider setting up a cron job for automatic retries

3. **Sheet Maintenance**
   - Regularly review the Google Sheet for data accuracy
   - Consider setting up data validation rules in the sheet
   - Monitor sheet permissions and access

## Support

If you encounter issues not covered in this guide:

1. Check the server logs for detailed error messages
2. Verify all environment variables are correctly set
3. Test the Google Sheets API connection independently
4. Ensure the service account has proper permissions

For additional help, refer to the [Google Sheets API documentation](https://developers.google.com/sheets/api) or [Google Cloud Service Account documentation](https://cloud.google.com/iam/docs/service-accounts).
