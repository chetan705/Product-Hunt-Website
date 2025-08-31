# 🚀 Product Hunt Finder

A comprehensive web application that discovers, enriches, and manages Product Hunt products and their makers. This tool automates the process of finding promising products and their creators, then helps you connect with them through an intuitive admin interface.

## ✨ What It Does

Product Hunt Finder is a complete pipeline for discovering and managing Product Hunt products:

1. **🔍 Auto-Discovery**: Fetches the latest products from Product Hunt RSS feeds by category
2. **🔗 LinkedIn Enrichment**: Automatically finds LinkedIn profiles for product makers using intelligent search
3. **👨‍💼 Admin Review**: Provides a clean interface to review and approve/reject makers
4. **📊 Google Sheets Export**: Pushes approved makers to Google Sheets for outreach and follow-up
5. **📈 Analytics**: Tracks statistics and provides insights into your discovery pipeline

## 🎯 Key Features

### RSS Feed Processing
- **Multi-Category Support**: AI, Developer Tools, SaaS, and more
- **Automatic Scheduling**: Can be triggered manually or via cron jobs
- **Duplicate Prevention**: Smart detection to avoid processing the same products twice
- **Robust Error Handling**: Graceful failure handling with detailed logging

### LinkedIn Profile Enrichment
- **Intelligent Search**: Uses Google Search API to find LinkedIn profiles
- **Smart Matching**: Advanced algorithms to match maker names with LinkedIn profiles
- **Caching System**: Prevents duplicate searches and optimizes API usage
- **Fallback Support**: Works with or without external APIs

### Admin Panel
- **Authentication**: Secure access with username/password or token-based auth
- **Review Interface**: Clean, responsive UI for reviewing makers
- **Bulk Actions**: Approve or reject makers with loading indicators
- **Filtering**: Filter by status (pending/approved/rejected) and category
- **Mobile Responsive**: Works seamlessly on desktop and mobile devices

### Google Sheets Integration
- **Automatic Export**: Approved makers are automatically added to Google Sheets
- **Customizable Fields**: Choose which data to export
- **Real-time Sync**: Immediate updates when makers are approved
- **Error Recovery**: Handles API failures gracefully

### Modern UI
- **Tailwind CSS**: Clean, modern design with utility-first styling
- **Responsive Design**: Optimized for all screen sizes
- **Interactive Elements**: Loading states, hover effects, and smooth transitions
- **Accessibility**: WCAG compliant with proper semantic markup

## 🛠️ Tech Stack

### Frontend
- **React 18**: Modern React with hooks and functional components
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **React Router**: Client-side routing for single-page application
- **Responsive Design**: Mobile-first approach with breakpoint optimization

### Backend
- **Node.js**: JavaScript runtime for server-side logic
- **Express**: Web framework for API endpoints and middleware
- **JSON File Storage**: Simple, lightweight data persistence
- **SerpAPI**: Google Search integration for LinkedIn discovery
- **Google Sheets API**: Direct integration for data export

### Deployment
- **Replit**: Cloud-based development and hosting platform
- **Replit Autoscale**: Automatic scaling based on demand
- **Environment Variables**: Secure configuration management
- **Cron Jobs**: Scheduled tasks via cron-job.org integration

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn
- [SerpAPI](https://serpapi.com/) account (optional but recommended)
- [Google Cloud Platform](https://console.cloud.google.com/) account for Sheets integration
- [Replit](https://replit.com/) account for deployment

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd ProductHuntFinder
```

2. **Install dependencies**
```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```bash
# Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
AUTH_TOKEN=your-secure-token-123

# APIs
SERPAPI_API_KEY=your_serpapi_key_here
GOOGLE_SHEETS_ID=your_google_sheets_id

# Google Cloud (base64 encoded service account JSON)
GOOGLE_CLOUD_CREDENTIALS=your_base64_encoded_service_account_json

# Server Configuration
NODE_ENV=development
PORT=3000
```

4. **Start the development servers**

Terminal 1 (Backend):
```bash
npm run dev
```

Terminal 2 (Frontend):
```bash
cd client
npm start
```

5. **Access the application**
- Frontend: `http://localhost:3001`
- Backend API: `http://localhost:3000`

### Replit Deployment

1. **Import to Replit**
   - Go to [Replit](https://replit.com/)
   - Click "Create Repl" → "Import from GitHub"
   - Enter your repository URL

2. **Configure Secrets**
   - Go to your Repl → Secrets (lock icon)
   - Add all environment variables from `.env.example`

3. **Start the application**
   - Click the "Run" button
   - Your app will be available at `https://your-repl-name.your-username.repl.co`

## 🔧 Configuration Guide

### Setting Up SerpAPI (LinkedIn Search)

1. Sign up at [SerpAPI](https://serpapi.com/)
2. Get your API key from the dashboard
3. Add `SERPAPI_API_KEY=your_key_here` to your environment
4. Free tier includes 100 searches/month

### Setting Up Google Sheets Integration

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one

2. **Enable Google Sheets API**
   - Navigate to "APIs & Services" → "Library"
   - Search for "Google Sheets API" and enable it

3. **Create Service Account**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "Service Account"
   - Download the JSON key file

4. **Configure Environment**
   ```bash
   # Base64 encode your service account JSON
   cat service-account.json | base64 -w 0
   
   # Add to .env
   GOOGLE_CLOUD_CREDENTIALS=your_base64_encoded_json
   ```

5. **Create Google Sheet**
   - Create a new Google Sheet
   - Share it with your service account email
   - Copy the Sheet ID from the URL
   - Add `GOOGLE_SHEETS_ID=your_sheet_id` to environment

### Authentication Setup

The app supports two authentication methods:

**Username/Password (Default)**
```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

**Token-based (Alternative)**
```bash
AUTH_TOKEN=your-secure-token-123
```

## 📖 How to Use

### 1. Fetching Products

**Manual Trigger**
- Visit `/admin` and click "Fetch Latest Products"
- Or make a POST request to `/api/cron/fetch`

**Automated with Cron**
- Set up a cron job at [cron-job.org](https://cron-job.org/)
- Schedule: `POST https://your-app.com/api/cron/fetch`
- Recommended: Every 4-6 hours

### 2. Accessing Admin Panel

1. Navigate to `https://your-app.com/admin`
2. Login with your configured credentials
3. Review pending makers
4. Approve or reject based on your criteria

### 3. Managing Data

**Filter by Status**
- Pending: Newly discovered makers awaiting review
- Approved: Makers you've approved for outreach
- Rejected: Makers you've decided not to pursue

**Filter by Category**
- AI: Artificial intelligence products
- Developer Tools: Tools for developers
- SaaS: Software as a Service products

### 4. Google Sheets Export

Approved makers are automatically exported to your configured Google Sheet with:
- Product name and description
- Maker name and LinkedIn profile
- Product Hunt link
- Category and publish date
- Approval timestamp

## 🔌 API Reference

### RSS & Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cron/fetch` | Fetch latest products from all categories |
| `POST` | `/api/cron/fetch/:category` | Fetch products from specific category |
| `GET` | `/api/products` | Get all products (supports filtering) |
| `GET` | `/api/stats` | Get database statistics |

### Admin Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/makers` | Get all makers (authenticated) |
| `POST` | `/api/makers/:id/approve` | Approve a maker (authenticated) |
| `POST` | `/api/makers/:id/reject` | Reject a maker (authenticated) |

### LinkedIn Enrichment

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/cron/enrich` | Run LinkedIn enrichment for pending makers |
| `GET` | `/api/cron/enrich/status` | Get enrichment cache status |
| `POST` | `/api/cron/enrich/clear-cache` | Clear enrichment cache |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check endpoint |
| `GET` | `/` | System info and status |

## 📊 Monitoring & Analytics

### Dashboard Statistics

The main dashboard shows:
- **Total Products**: All discovered products
- **Categories**: Number of different categories
- **Pending Review**: Makers awaiting your decision
- **Approved**: Makers you've approved for outreach

### Admin Panel Metrics

- Real-time counts by status (pending/approved/rejected)
- Category breakdown
- Recent activity and processing logs

### API Monitoring

```bash
# Check system health
curl https://your-app.com/api/health

# Get detailed statistics
curl https://your-app.com/api/stats

# Monitor enrichment status
curl https://your-app.com/api/cron/enrich/status
```

## 🎯 Best Practices

### Scheduling Recommendations

- **RSS Fetching**: Every 4-6 hours during business days
- **LinkedIn Enrichment**: Runs automatically after RSS fetch
- **Manual Review**: Check admin panel daily for new pending makers

### Data Management

- **Regular Backups**: Export your Google Sheet periodically
- **Cache Clearing**: Clear enrichment cache monthly to refresh stale data
- **Status Hygiene**: Regularly review and process pending makers

### Performance Optimization

- **API Limits**: SerpAPI free tier allows 100 searches/month
- **Rate Limiting**: Built-in delays prevent API overload
- **Caching**: Automatic caching reduces redundant API calls
- **Error Handling**: Graceful degradation ensures uptime

## 🐛 Troubleshooting

### Common Issues

**"Authentication Failed"**
- Check your username/password or token in environment variables
- Ensure credentials match your configuration

**"LinkedIn Enrichment Not Working"**
- Verify SERPAPI_API_KEY is set correctly
- Check API quota usage at SerpAPI dashboard
- Review logs for specific error messages

**"Google Sheets Export Failed"**
- Verify service account JSON is properly base64 encoded
- Ensure sheet is shared with service account email
- Check Google Sheets API is enabled in your project

**"No Products Found"**
- Run manual RSS fetch: `POST /api/cron/fetch`
- Check RSS feed availability
- Review server logs for fetch errors

### Debug Endpoints

```bash
# Check enriched products
curl https://your-app.com/api/debug/enriched

# View system configuration
curl https://your-app.com

# Test authentication
curl -H "Authorization: Basic base64(username:password)" https://your-app.com/api/makers
```

## 🚀 Deployment Notes

### Replit-Specific Setup

**Secrets Configuration**
- Use Replit Secrets for all environment variables
- Never commit sensitive data to your repository
- Secrets are automatically loaded as environment variables

**Scheduled Pings**
- Set up [cron-job.org](https://cron-job.org/) to ping your app
- Prevents Replit from sleeping during inactivity
- Recommended: ping every 30 minutes during active hours

**File Persistence**
- Data is stored in JSON files in the `/data` directory
- Files persist across Repl restarts
- Consider periodic backups for important data

### Production Considerations

**Security**
- Use strong passwords and tokens
- Enable HTTPS (automatic on Replit)
- Regularly rotate API keys
- Monitor access logs

**Scaling**
- Replit Autoscale handles traffic spikes automatically
- Monitor API usage to avoid quota exhaustion
- Consider upgrading SerpAPI plan for higher volume

**Monitoring**
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Monitor API error rates
- Track Google Sheets export success rates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 What's Next?

This application is production-ready and includes all major features for Product Hunt discovery and maker management. Future enhancements could include:

- **Advanced Analytics**: Deeper insights into product trends and maker patterns
- **Team Collaboration**: Multi-user support with role-based access
- **Integration Ecosystem**: Webhooks and API integrations with CRM systems
- **AI-Powered Scoring**: Automatic scoring of products and makers based on criteria
- **Advanced Filtering**: More sophisticated search and filtering options

---

*Built with ❤️ for the Product Hunt community*
