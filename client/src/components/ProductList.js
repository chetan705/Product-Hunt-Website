import React, { useState } from 'react';

function ProductList({ products, selectedCategory, selectedStatus }) {
  if (!products || products.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-6">🔍</div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-4">No products found</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          {selectedCategory !== 'all' || selectedStatus !== 'all'
            ? 'Try adjusting your filters or fetch new products from RSS feeds.'
            : 'Click "Fetch Latest Products" to get started and populate the database with Product Hunt listings.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Products Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {selectedCategory !== 'all'
            ? `${selectedCategory.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Products`
            : 'All Products'
          }
          {selectedStatus !== 'all' && ` (${selectedStatus})`}
        </h2>
        <p className="text-gray-600">Showing {products.length} product{products.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
          />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product }) {
  const [upvotes, setUpvotes] = useState(product.upvotes || 0);
  const [isUpvoting, setIsUpvoting] = useState(false);
  const [hasVoted, setHasVoted] = useState(() => {
    try {
      const voted = JSON.parse(localStorage.getItem('phf_voted') || '{}');
      return !!voted[product.id];
    } catch {
      return false;
    }
  });

  const getCategoryDisplayName = (category) => {
    return category
      ? category
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      : 'Uncategorized';
  };

  const getStatusBadgeClasses = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleUpvote = async () => {
    if (isUpvoting) return;
    setIsUpvoting(true);
    try {
      const endpoint = hasVoted ? 'unvote' : 'upvote';
      const response = await fetch(`/api/products/${product.id}/${endpoint}`, { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        setUpvotes(data.upvotes);
        setHasVoted(!hasVoted);
        const voted = JSON.parse(localStorage.getItem('phf_voted') || '{}');
        if (hasVoted) {
          delete voted[product.id];
        } else {
          voted[product.id] = true;
        }
        localStorage.setItem('phf_voted', JSON.stringify(voted));
      }
    } catch (error) {
      console.error('Vote toggle error:', error.message);
    } finally {
      setIsUpvoting(false);
    }
  };

  // Validate LinkedIn URL
  const isValidLinkedInUrl = product.linkedin && product.linkedin.includes('linkedin.com') && !product.linkedin.includes('producthunt.com');

  return (
    <div className="product-card bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 relative p-5">
      {/* Card Header */}
      <div className="card-header">
        <div className="flex justify-between items-start mb-4 pl-12">
          <h3 className="text-xl font-bold text-gray-900 leading-tight flex-1 mr-3">
            {product.name || 'Untitled Product'}
          </h3>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white whitespace-nowrap">
            {getCategoryDisplayName(product.category)}
          </span>
        </div>

        {/* Product Description */}
        <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-4 min-h-[80px] px-2">
          {product.description || 'No description available.'}
        </p>

        {/* Topics/Tags */}
        {product.phTopics && product.phTopics.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {product.phTopics.slice(0, 3).map((topic, index) => (
              <span key={index} className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Company Information Section */}
      <div className="mt-4 py-4 bg-orange-50 border border-orange-100 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center px-4">
          <svg className="w-4 h-4 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Company Information
        </h4>
        
        <div className="space-y-2 px-4">
          {/* Domain - Company Info - Launch Year */}
          <div className="text-sm text-gray-700 font-medium">
            {product.companyWebsite ? (
              <a 
                href={product.companyWebsite} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-600 hover:text-orange-800"
              >
                {product.companyWebsite.replace(/^https?:\/\//, '')}
              </a>
            ) : 'Website Not Available'}
            
            <span className="mx-2">–</span>
            
            <span>
              {product.companyInfo || 'Company Info Not Available'}
            </span>
            
            <span className="mx-2">–</span>
            
            <span>
              {product.launchDate ? `Launched in ${product.launchDate}` : 'Launch Year Not Available'}
            </span>
          </div>
          
          {product.accelerator && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded">
                {product.accelerator}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Social Links Section */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-4 h-4 text-[#0077b5] mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
            </svg>
            <span className="text-sm text-gray-600">
              {isValidLinkedInUrl ? (
                <a 
                  href={product.linkedin} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-[#0077b5] hover:underline"
                >
                  {product.makerName || 'View LinkedIn Profile'}
                </a>
              ) : (
                product.makerName || 'LinkedIn Not Available'
              )}
            </span>
          </div>
          
          {product.phGithub && (
            <div className="flex items-center">
              <svg className="w-4 h-4 text-gray-900 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0a12 12 0 00-3.79 23.39c.6.11.82-.26.82-.58v-2.06c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.49 11.49 0 016.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58A12 12 0 0012 0z"/>
              </svg>
              <a 
                href={product.phGithub} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm text-gray-900 hover:underline"
              >
                GitHub
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={handleUpvote}
            disabled={isUpvoting}
            className={`flex items-center justify-center px-3 py-1 rounded-full border transition-all duration-200 ${
              hasVoted
                ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
            } ${isUpvoting ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={hasVoted ? 'Remove Upvote' : 'Upvote'}
          >
            <svg className="w-5 h-5 mr-1" fill={hasVoted ? 'currentColor' : 'none'} stroke={hasVoted ? 'none' : 'currentColor'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/>
            </svg>
            <span className="text-sm font-medium">{upvotes}</span>
          </button>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeClasses(product.status)}`}>
            {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
          </span>
        </div>
        <a
          href={product.phLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-600 hover:text-gray-900 font-medium"
        >
          View on Product Hunt
        </a>
      </div>
    </div>
  );
}

export default ProductList;