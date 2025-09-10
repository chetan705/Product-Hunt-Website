import React, { useState, useEffect } from 'react';
import ProductList from './ProductList';

const MainDashboard = () => {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSort, setSelectedSort] = useState('upvotes'); // Default to upvotes

  const categories = ['artificial-intelligence', 'developer-tools', 'saas'];

  // Load initial data
  useEffect(() => {
    loadProducts();
    loadStats();
  }, []);

  // Filter products when selection changes
  useEffect(() => {
    filterProducts();
  }, [products, selectedCategory, selectedStatus, selectedSort]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/products');
      const data = await response.json();
      
      if (data.success) {
        // Process the data
        const enrichedProducts = data.products.map(product => ({
          ...product,
          formattedDate: formatDate(new Date(product.publishedAt || product.createdAt))
        }));
        
        // Remove duplicates (if any)
        const uniqueProducts = enrichedProducts.filter((product, index, self) =>
          index === self.findIndex((p) => p.id === product.id)
        );
        
        setProducts(uniqueProducts);
      } else {
        setError(data.error?.message || 'Failed to load products');
      }
    } catch (err) {
      setError('Failed to load products');
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.database);
      } else {
        console.error('Error loading stats:', data.error?.message || 'Unknown error');
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const filterProducts = () => {
    let filtered = [...products];

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(product => product.status === selectedStatus);
    }

    // Apply sorting
    if (selectedSort === 'upvotes') {
      // Sort by local upvotes (descending), then by date for those with no upvotes
      filtered.sort((a, b) => {
        const votesA = a.upvotes || 0;
        const votesB = b.upvotes || 0;
        
        // If both have upvotes, sort by upvotes
        if (votesA !== votesB) {
          return votesB - votesA;
        }
        
        // If both have same upvotes, sort by date (newest first)
        return new Date(b.createdAt || b.publishedAt) - new Date(a.createdAt || a.publishedAt);
      });
    } else if (selectedSort === 'top50') {
      // Only items with upvotes > 0
      filtered = filtered.filter(p => (p.upvotes || 0) > 0);
      filtered.sort((a, b) => {
        const votesA = a.upvotes || 0;
        const votesB = b.upvotes || 0;
        if (votesA !== votesB) return votesB - votesA;
        return new Date(b.createdAt || b.publishedAt) - new Date(a.createdAt || a.publishedAt);
      });
      if (filtered.length > 50) filtered = filtered.slice(0, 50);
    } else if (selectedSort === 'linkedin-enriched') {
      // Filter products with LinkedIn profiles except for the specific URL
      filtered = filtered.filter(product => 
        product.linkedin && 
        typeof product.linkedin === 'string' && 
        product.linkedin.includes('linkedin.com') && 
        product.linkedin !== 'https://www.linkedin.com/company/producthunt'
      );
      // Sort by newest first
      filtered.sort((a, b) => new Date(b.createdAt || b.publishedAt) - new Date(a.createdAt || a.publishedAt));
    } else if (selectedSort === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt || b.publishedAt) - new Date(a.createdAt || a.publishedAt));
    } else if (selectedSort === 'oldest') {
      filtered.sort((a, b) => new Date(a.createdAt || a.publishedAt) - new Date(b.createdAt || b.publishedAt));
    }

    // Compute "Launched this week" for each filtered product
    const now = new Date();
    const enhancedFiltered = filtered.map(product => {
      const launchDate = new Date(product.publishedAt);
      const daysSinceLaunch = Math.floor((now - launchDate) / (1000 * 60 * 60 * 24));
      const launchLabel = daysSinceLaunch <= 7 ? 'Launched this week' : '';
      return { ...product, launchLabel };
    });

    setFilteredProducts(enhancedFiltered);
  };

  const handleFetchRSS = async () => {
    try {
      setFetching(true);
      setError(null);
      setMessage(null);

      const response = await fetch('/api/cron/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (data.success) {
        if (data.skipped) {
          // Handle skipped response (rate limited)
          setMessage({
            type: 'success',
            text: `RSS fetch skipped: ${data.reason}`
          });
        } else if (data.results && data.results.rss && data.results.rss.summary) {
          // Handle normal response with results
          const summary = data.results.rss.summary;
          
          // Create a more detailed message about duplicates
          let messageText = `RSS fetch completed! Processed: ${summary.totalProcessed}, New: ${summary.totalNew}, Duplicates: ${summary.totalDuplicates}`;
          
          // Add more context about duplicates if there are any
          if (summary.totalDuplicates > 0) {
            messageText += ` (duplicates are automatically filtered based on normalized Product Hunt links)`;
          }
          
          setMessage({
            type: 'success',
            text: messageText
          });
        } else {
          // Fallback for any other success response
          setMessage({
            type: 'success',
            text: 'RSS fetch completed successfully'
          });
        }
        
        // Reload products and stats so new cards inherit ranking and upvote defaults
        await loadProducts();
        await loadStats();
        
        // Auto switch to newest after fetch so latest fetched appear first
        setSelectedSort('newest');
      } else {
        setError(data.error?.message || 'RSS fetch failed');
      }
    } catch (err) {
      setError('Failed to trigger RSS fetch');
      console.error('Error fetching RSS:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleSingleEnrich = (id, data) => {
    setProducts(prevProducts => 
      prevProducts.map(product => 
        product.id === id 
          ? { ...product, linkedInEnriched: true, linkedInData: data } 
          : product
      )
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',  
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const clearMessage = () => {
    setMessage(null);
    setError(null);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header Stats Section */}
      <header className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white py-12 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <p className="text-xl text-gray-100 mb-6">
              Discover and track the latest products from Product Hunt by category
            </p>
          </div>
          
          {/* Active Filters Display */}
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                Category: {selectedCategory.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                <button onClick={() => setSelectedCategory('all')} className="ml-2 text-blue-600 hover:text-blue-800">×</button>
              </span>
            )}
            {selectedStatus !== 'all' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                Status: {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}
                <button onClick={() => setSelectedStatus('all')} className="ml-2 text-green-600 hover:text-green-800">×</button>
              </span>
            )}
            {selectedSort === 'upvotes' && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800">
                🔥 Most Upvoted
                <button onClick={() => setSelectedSort('newest')} className="ml-2 text-orange-600 hover:text-orange-800">×</button>
              </span>
            )}
          </div>
          
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="bg-white bg-opacity-10 rounded-lg p-4">
                <div className="text-3xl font-bold mb-2">{stats.totalProducts}</div>
                <div className="text-sm text-gray-200">Total Products</div>
              </div>
              <div className="bg-white bg-opacity-10 rounded-lg p-4">
                <div className="text-3xl font-bold mb-2">{Object.keys(stats.byCategory || {}).length}</div>
                <div className="text-sm text-gray-200">Categories</div>
              </div>
              <div className="bg-white bg-opacity-10 rounded-lg p-4">
                <div className="text-3xl font-bold mb-2">{stats.byStatus?.pending || 0}</div>
                <div className="text-sm text-gray-200">Pending Review</div>
              </div>
              <div className="bg-white bg-opacity-10 rounded-lg p-4">
                <div className="text-3xl font-bold mb-2">{stats.byStatus?.approved || 0}</div>
                <div className="text-sm text-gray-200">Approved</div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Controls - Single Line */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <div className="flex-grow min-w-[180px] max-w-xs">
              <select
                id="category-filter"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="form-input w-full py-2 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex-grow min-w-[150px] max-w-xs">
              <select
                id="status-filter"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="form-input w-full py-2 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Sort Filter */}
            <div className="flex-grow min-w-[180px] max-w-xs">
              <select
                id="sort-filter"
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value)}
                className="form-input w-full py-2 px-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="upvotes">Most Upvoted</option>
                <option value="top50">Top 50 by Upvotes</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="linkedin-enriched">LinkedIn Profiles</option>
              </select>
            </div>

            {/* Fetch Button */}
            <button
              className="flex-shrink-0 bg-[#ea5d38] hover:bg-[#dc2626] text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center"
              onClick={handleFetchRSS}
              disabled={fetching}
            >
              {fetching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Fetching...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Fetch Latest Products
                </>
              )}
            </button>

            {/* Refresh Button */}
            <button
              onClick={loadProducts}
              disabled={loading}
              className="flex-shrink-0 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                  Refreshing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="error-message relative mb-6">
            <strong>Error:</strong> {error}
            <button onClick={clearMessage} className="absolute top-4 right-4 text-red-500 hover:text-red-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {message && (
          <div className="success-message relative mb-6">
            <strong>Success:</strong> {message.text}
            <button onClick={clearMessage} className="absolute top-4 right-4 text-green-500 hover:text-green-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Products */}
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading products...</p>
          </div>
        ) : (
          <ProductList 
            products={filteredProducts}
            formatDate={formatDate}
            selectedCategory={selectedCategory}
            selectedStatus={selectedStatus}
            selectedSort={selectedSort}
            onEnrich={handleSingleEnrich}
          />
        )}
      </main>
    </div>
  );
};

export default MainDashboard;
