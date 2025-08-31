# Google Sheets Integration Setup Guide

This guide will help you set up Google Sheets integration so that approved makers are automatically synced to your Google Sheet.

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it something like "Product Hunt Makers" or "Approved Makers"
4. Copy the spreadsheet ID from the URL:
   - URL: `https://docs.google.com/spreadsheets/d/1ABC123DEF456GHI789/edit`
   - ID: `1ABC123DEF456GHI789`

## Step 2: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Note your project ID

## Step 3: Enable Google Sheets API

1. In Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click on it and press "Enable"

## Step 4: Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Fill in the details:
   - Name: `product-hunt-sheets-service`
   - Description: `Service account for Product Hunt Finder Google Sheets integration`
4. Click "Create and Continue"
5. Skip the optional steps and click "Done"

## Step 5: Generate Service Account Key

1. In the Credentials page, find your service account
2. Click on the service account email
3. Go to the "Keys" tab
4. Click "Add Key" > "Create New Key"
5. Choose "JSON" format
6. Download the JSON file

## Step 6: Share Your Google Sheet

1. Open your Google Sheet
2. Click the "Share" button
3. Add the service account email (from the JSON file) as an editor
4. The email looks like: `product-hunt-sheets-service@your-project.iam.gserviceaccount.com`

## Step 7: Configure Environment Variables

Open your `.env` file and add the following:

```env
# Google Sheets Integration
GOOGLE_SHEETS_ID=your-spreadsheet-id-here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
Your private key content here (from the JSON file)
-----END PRIVATE KEY-----
GOOGLE_PROJECT_ID=your-google-project-id
```

### Alternative Method: JSON File

Instead of individual environment variables, you can also:

1. Save the downloaded JSON file as `google-credentials.json` in your project root
2. Only set `GOOGLE_SHEETS_ID` in your `.env` file

## Step 8: Test the Integration

1. Restart your server
2. Go to the admin panel
3. Approve a maker
4. Check your Google Sheet - the approved maker should appear automatically!

## Troubleshooting

### Common Issues:

1. **"Service not initialized" error**
   - Check that all environment variables are set correctly
   - Ensure the private key includes the BEGIN/END lines
   - Verify the service account email is correct

2. **"Failed to connect to Google Sheet" error**
   - Make sure you shared the sheet with the service account email
   - Verify the spreadsheet ID is correct
   - Check that the Google Sheets API is enabled

3. **"Permission denied" error**
   - The service account needs editor access to the sheet
   - Re-share the sheet with the service account email

### Testing Commands:

```bash
# Check if Google Sheets service is working
curl http://localhost:3000/api/sheets/status

# Test approval (replace ID with actual product ID)
curl -X POST "http://localhost:3000/api/makers/PRODUCT_ID/approve" \
  -H "Authorization: Basic YWRtaW46YWRtaW4xMjM=" \
  -H "Content-Type: application/json"

# Manually sync approved makers to sheets
curl -X POST "http://localhost:3000/api/cron/resync-sheets" \
  -H "Authorization: Basic YWRtaW46YWRtaW4xMjM=" \
  -H "Content-Type: application/json"
```

## Sheet Structure

The system will automatically create headers in your sheet:

| Date Approved | Maker Name | LinkedIn | Product Name | Category | Product Hunt Link |
|---------------|------------|----------|--------------|----------|-------------------|
| 2025-06-25    | John Doe   | linkedin.com/in/johndoe | Amazing App | saas | producthunt.com/posts/amazing-app |

## Security Notes

- Keep your service account credentials secure
- Don't commit the JSON file or private keys to version control
- Use environment variables or secure secret management
- The service account only has access to sheets you explicitly share with it

## Need Help?

If you encounter issues:

1. Check the server logs for detailed error messages
2. Verify all steps above are completed correctly
3. Test the Google Sheets API connection using the status endpoint
4. Use the manual resync endpoint to retry failed syncs
