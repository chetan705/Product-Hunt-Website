# Google Cloud Console Setup Guide
## Getting Service Account Credentials for Environment Variables

Perfect choice! Environment variables are more secure and production-ready. Here's the complete step-by-step process:

## 🔧 **Step 1: Google Cloud Console Setup**

### 1.1 Create/Select Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your **Project ID** (you'll need this for `GOOGLE_PROJECT_ID`)

### 1.2 Enable Google Sheets API
1. Go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click "Enable"

### 1.3 Create Service Account
1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Fill out:
   - **Name**: `product-hunt-finder-sheets`
   - **Description**: `Service account for Product Hunt Finder Google Sheets integration`
4. Click "Create and Continue"
5. **Role**: Select "Editor" (or create custom role with Sheets access)
6. Click "Continue" → "Done"

### 1.4 Generate Service Account Key
1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Select **JSON** format
5. Download the JSON file

## 🔑 **Step 2: Extract Credentials from JSON**

The downloaded JSON file contains all the credentials. Here's how to extract them:

### Example JSON Structure:
```json
{
  "type": "service_account",
  "project_id": "your-project-id-12345",
  "private_key_id": "abcd1234...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n",
  "client_email": "product-hunt-finder-sheets@your-project-id-12345.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

### Extract These Values:
- **GOOGLE_PROJECT_ID** = `project_id` field
- **GOOGLE_SERVICE_ACCOUNT_EMAIL** = `client_email` field  
- **GOOGLE_PRIVATE_KEY** = `private_key` field (keep the \n characters!)

## 📝 **Step 3: Update Your .env File**

```env
# Google Sheets Configuration
GOOGLE_SHEETS_ID=your_spreadsheet_id_here

# Google Service Account Credentials
GOOGLE_SERVICE_ACCOUNT_EMAIL=product-hunt-finder-sheets@your-project-id-12345.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=your-project-id-12345
```

**⚠️ Important Notes:**
- Keep the quotes around `GOOGLE_PRIVATE_KEY`
- Don't remove the `\n` characters in the private key
- Don't commit this .env file to version control

## 🔗 **Step 4: Share Google Sheet**

1. Create your Google Sheet at [sheets.google.com](https://sheets.google.com)
2. Click "Share" button
3. Add the **service account email** (from `GOOGLE_SERVICE_ACCOUNT_EMAIL`)
4. Give it "Editor" permissions
5. Click "Send"

## ✅ **Step 5: Test Connection**

1. **Restart your server** (important!)
2. **Test status:**
   ```bash
   curl http://localhost:3000/api/sheets/status
   ```
   Should return: `"available": true`

3. **Sync your approved makers:**
   ```bash
   curl -X POST http://localhost:3000/api/cron/resync-sheets
   ```

4. **Check your Google Sheet** - you should see all 8 approved makers!

## 🔒 **Security Best Practices**

### For Development:
- Add `.env` to `.gitignore` (already done)
- Never commit credentials to version control

### For Production/Replit:
- Use Replit Secrets instead of .env file
- Set each variable individually in secrets
- Consider using Google Cloud Secret Manager for extra security

## 🚨 **Troubleshooting**

### "The caller does not have permission"
- Make sure you shared the Google Sheet with the service account email
- Verify the service account has "Editor" permissions

### "Invalid private key"
- Ensure the private key includes the full BEGIN/END markers
- Keep all `\n` characters intact
- Make sure it's properly quoted in the .env file

### "Service not initialized"
- Check that all 3 environment variables are set
- Restart the server after updating .env
- Verify the JSON was parsed correctly

## 📊 **Expected Result**

Once set up, your Google Sheet will automatically receive:

| Date Approved | Maker Name | LinkedIn | Product Name | Category | Product Hunt Link |
|---------------|------------|----------|--------------|----------|-------------------|
| 2025-06-22 | Adarsh Yadav | | Hello Pet Dreams | artificial-intelligence | https://www.producthunt.com/posts/hello-pet-dreams |
| 2025-06-22 | Zac Zuo | | Oakley Meta Glasses | artificial-intelligence | https://www.producthunt.com/posts/oakley-meta-glasses |
| ...and more |

The integration will then work automatically - every time you approve a maker in the admin panel, they'll be instantly added to your Google Sheet!
