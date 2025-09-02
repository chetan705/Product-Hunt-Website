import React, { useState } from 'react';
import PropTypes from 'prop-types';
import TinderCard from 'react-tinder-card';

function ProductList({ products, selectedCategory, selectedStatus }) {
  if (!products || products.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-6">🔍</div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-4">No products found</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          {selectedCategory !== 'all' || selectedStatus !== 'all'
            ? 'Try adjusting your filters or fetch new products from RSS feeds.'
            : 'Click "Fetch Latest Products" to get started and populate the database with Product Hunt listings.'}
        </p>
      </div>
    );
  }

  return (
    <div className="product-list space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          {selectedCategory !== 'all'
            ? `${selectedCategory.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Products`
            : 'All Products'}
          {selectedStatus !== 'all' && ` (${selectedStatus})`}
        </h2>
        <p className="text-gray-600">Showing {products.length} product{products.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
            <div key={product.id} className="product-card-container">
              <ProductCard product={product} />
            </div>
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

  const getCategoryBadgeClasses = (category) => {
    if (category === 'artificial-intelligence' || category === 'developer-tools') {
      return 'category-badge artificial-intelligence';
    }
    return 'category-badge bg-gray-100 text-gray-700';
  };

  const getStatusBadgeClasses = (status) => {
    switch (status?.toLowerCase()) {
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

  const isValidLinkedInUrl = product.linkedin &&
    typeof product.linkedin === 'string' &&
    product.linkedin.includes('linkedin.com') &&
    !product.linkedin.includes('producthunt.com');

  return (
    <div className="product-card bg-gradient-to-br from-white to-[#fef7f5] rounded-xl shadow-md border border-gray-200 overflow-y-auto p-4 space-y-2 w-full h-full hover:shadow-lg transition-all duration-200">
      <div className="card-header">
        <div className="flex items-center gap-2 mb-2">
          {product.thumbnail?.url ? (
            <img
              loading="lazy"
              src={product.thumbnail.url}
              alt={`${product.name || 'Product'} thumbnail`}
              className="rounded-lg shadow-sm"
              style={{ width: '36px', height: '36px' }}
            />
          ) : (
            <div className="w-9 h-9 bg-gray-200 rounded-lg flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 4h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 9h7V6H4v7zm14-9h-4v2h4v12H8v-4H6v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-5 4h-2v4H8v2h3v4h2v-4h3v-2h-3V8z"/>
              </svg>
            </div>
          )}
          <h3 className="text-lg font-semibold text-gray-800">{product.name || 'Untitled Product'}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-block ${getCategoryBadgeClasses(product.category)} text-xs px-2 py-1 rounded-md shadow-sm`}>
            {getCategoryDisplayName(product.category)}
          </span>
        </div>
      </div>
      <div className="card-body space-y-2">
        {product.description && (
          <p className="text-gray-600 text-sm max-h-32 overflow-y-auto">{product.description || 'No description available.'}</p>
        )}
        {product.phTopics && product.phTopics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.phTopics.slice(0, 3).map((topic, index) => (
              <span key={index} className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium shadow-sm hover:bg-gray-200 transition-colors duration-200">
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="py-2 bg-orange-50 border border-orange-100 rounded-lg shadow-sm">
        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center px-4">
          <svg className="w-4 h-4 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Company Information
        </h4>
        <div className="space-y-2 px-4">
          <div className="text-sm text-gray-700 font-medium">
            {product.companyWebsite ? (
              <a
                href={product.companyWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-600 hover:text-orange-800 hover:underline transition-colors duration-200"
              >
                {product.companyWebsite.replace(/^https?:\/\//, '')}
              </a>
            ) : 'Website Not Available'}
            <span className="mx-2">–</span>
            <span>{product.companyInfo || 'Company Info Not Available'}</span>
            <span className="mx-2">–</span>
            <span>{product.launchDate ? `Launched in ${product.launchDate}` : 'Launch Year Not Available'}</span>
          </div>
          {product.accelerator && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded shadow-sm">
                {product.accelerator}
              </span>
            </div>
          )}
          {product.makerName && (
            <div className="text-sm text-gray-700 font-medium">
              Maker: {product.makerName}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-md shadow-sm mt-2">
        <div className="flex items-center gap-4">
          {isValidLinkedInUrl && (
            <div className="flex items-center">
              <svg className="w-4 h-4 text-[#0077b5] mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
              <a
                href={product.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#0077b5] hover:underline font-medium transition-colors duration-200"
              >
                LinkedIn
              </a>
            </div>
          )}
          {product.phGithub && (
            <div className="flex items-center">
              <svg className="w-4 h-4 text-gray-900 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0a12 12 0 00-3.79 23.39c.6.11.82-.26.82-.58v-2.06c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.49 11.49 0 016.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58A12 12 0 0012 0z"/>
              </svg>
              <a
                href={product.phGithub}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-900 hover:underline font-medium transition-colors duration-200"
              >
                GitHub
              </a>
            </div>
          )}
        </div>
      </div>
      <div className="px-4 py-2 flex justify-between items-center mt-2">
        <div className="flex items-center gap-4">
          <button
            onClick={handleUpvote}
            disabled={isUpvoting}
            className={`flex items-center justify-center px-3 py-1 rounded-full border transition-all duration-200 shadow-sm ${
              hasVoted
                ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
            } ${isUpvoting ? 'opacity-50 cursor-not-allowed' : 'hover:transform hover:scale-105'}`}
            title={hasVoted ? 'Remove Upvote' : 'Upvote'}
          >
            <svg className="w-5 h-5 mr-1" fill={hasVoted ? 'currentColor' : 'none'} stroke={hasVoted ? 'none' : 'currentColor'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/>
            </svg>
            <span className="text-sm font-medium">{upvotes}</span>
          </button>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-sm ${getStatusBadgeClasses(product.status)}`}>
            {product.status ? product.status.charAt(0).toUpperCase() + product.status.slice(1) : 'Unknown'}
          </span>
        </div>
        <a
          href={product.phLink || product.productHuntLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-600 hover:text-gray-900 font-medium hover:underline transition-colors duration-200 px-3 py-1 bg-orange-50 rounded-md shadow-sm"
        >
          View on Product Hunt
        </a>
      </div>
    </div>
  );
}

ProductList.propTypes = {
  products: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string,
      description: PropTypes.string,
      category: PropTypes.string,
      status: PropTypes.string,
      upvotes: PropTypes.number,
      phTopics: PropTypes.arrayOf(PropTypes.string),
      dayRank: PropTypes.string,
      votes: PropTypes.number,
      companyWebsite: PropTypes.string,
      companyInfo: PropTypes.string,
      launchDate: PropTypes.string,
      accelerator: PropTypes.string,
      linkedin: PropTypes.string,
      makerName: PropTypes.string,
      phGithub: PropTypes.string,
      phLink: PropTypes.string,
      productHuntLink: PropTypes.string,
      thumbnail: PropTypes.shape({
        url: PropTypes.string
      })
    })
  ).isRequired,
  selectedCategory: PropTypes.string.isRequired,
  selectedStatus: PropTypes.string.isRequired
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    description: PropTypes.string,
    category: PropTypes.string,
    status: PropTypes.string,
    upvotes: PropTypes.number,
    phTopics: PropTypes.arrayOf(PropTypes.string),
    dayRank: PropTypes.string,
    votes: PropTypes.number,
    companyWebsite: PropTypes.string,
    companyInfo: PropTypes.string,
    launchDate: PropTypes.string,
    accelerator: PropTypes.string,
    linkedin: PropTypes.string,
    makerName: PropTypes.string,
    phGithub: PropTypes.string,
    phLink: PropTypes.string,
    productHuntLink: PropTypes.string,
    thumbnail: PropTypes.shape({
      url: PropTypes.string
    })
  }).isRequired
};

export default ProductList;