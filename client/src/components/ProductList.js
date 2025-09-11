import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSwipeable } from 'react-swipeable';

// Utility to debounce API calls
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    return new Promise(resolve => {
      timeout = setTimeout(() => resolve(func(...args)), wait);
    });
  };
};

function ProductList({ products, selectedCategory, selectedStatus, selectedSort, formatDate, onEnrich, onStatusChange }) {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [normalizedProducts, setNormalizedProducts] = useState([]);

  // Check for mobile view
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Normalize product URLs and reset current card index when products change
  useEffect(() => {
    const normalizePhLink = (link) => {
      if (!link) return null;
      let normalized = link.trim();
      if (normalized.includes('/posts/')) {
        normalized = normalized.replace('/posts/', '/products/');
      }
      // Use product overview URL instead of launches
      if (normalized.endsWith('/launches')) {
        normalized = normalized.replace('/launches', '');
      }
      try {
        new URL(normalized);
        return normalized;
      } catch {
        return null;
      }
    };

    const updatedProducts = products.map(product => ({
      ...product,
      phLink: normalizePhLink(product.phLink || product.productHuntLink)
    }));
    setNormalizedProducts(updatedProducts);
    setCurrentCardIndex(0);
  }, [products]);

  // Handle next card after swipe
  const handleNextCard = () => {
    setCurrentCardIndex(prevIndex => {
      if (prevIndex >= normalizedProducts.length - 1) {
        return prevIndex;
      }
      return prevIndex + 1;
    });
  };

  if (!normalizedProducts || normalizedProducts.length === 0) {
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
        <p className="text-gray-600">Showing {normalizedProducts.length} product{normalizedProducts.length !== 1 ? 's' : ''}</p>
      </div>
      {isMobile && currentCardIndex >= normalizedProducts.length ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-6">✅</div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">No more products to review</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            You've reviewed all {selectedStatus !== 'all' ? selectedStatus : ''} products. Try adjusting filters or fetching new products.
          </p>
        </div>
      ) : (
        <div className={`${isMobile ? 'mobile-admin-swipe-container relative min-h-[450px]' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'}`}>
          {normalizedProducts.map((product, index) => (
            <div 
              key={product.id} 
              className={`${isMobile ? `admin-swipe-card-container absolute top-0 w-[95%] left-[2.5%] ${index === currentCardIndex ? 'block' : 'hidden'}` : ''}`}
            >
              <ProductCard 
                product={product} 
                formatDate={formatDate} 
                onEnrich={onEnrich}
                onStatusChange={onStatusChange}
                onSwipeComplete={isMobile ? handleNextCard : undefined}
                isMobile={isMobile}
                selectedStatus={selectedStatus}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, formatDate, onEnrich, onStatusChange, onSwipeComplete, isMobile, selectedStatus }) {
  const [upvotes, setUpvotes] = useState(product.upvotes || product.phUpvotes || 'N/A');
  const [isFetchingUpvotes, setIsFetchingUpvotes] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState(null);
  const [enrichedData, setEnrichedData] = useState(product.linkedInData || null);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [swipeAction, setSwipeAction] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

  const getCategoryDisplayName = (category) => {
    return category
      ? category
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      : 'Uncategorized';
  };

  const getCategoryBadgeClasses = (category) => {
    return 'category-badge bg-orange-100 text-orange-800';
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

  // Debounced fetch with retry logic for upvotes
  const debouncedFetchPhUpvotes = debounce(async (retries = 3, delay = 5000) => {
    try {
      const phLink = product.phLink || product.productHuntLink;
      if (!phLink || !product.id) {
        throw new Error(`Missing required fields: phLink=${phLink}, id=${product.id}`);
      }

      // Use cached upvotes if available
      if (product.upvotes !== undefined && product.upvotes !== null) {
        setUpvotes(product.upvotes);
        setIsFetchingUpvotes(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/ph-upvotes?url=${encodeURIComponent(phLink)}&productId=${encodeURIComponent(product.id)}`, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.status === 429 && retries > 0) {
        setFetchError('Rate limit exceeded, retrying...');
        console.log(`Rate limit hit for ${product.name}, retrying after ${delay}ms (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return debouncedFetchPhUpvotes(retries - 1, delay * 2);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${response.status} ${errorData.error?.details || errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      if (data.success) {
        setUpvotes(data.upvotes);
        setFetchError(null);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch upvotes');
      }
    } catch (error) {
      console.error(`Error fetching PH upvotes for ${product.name}: ${error.message}`, { phLink: product.phLink, id: product.id });
      setFetchError(
        error.message.includes('401') ? 'Invalid Product Hunt API token' :
        error.message.includes('429') ? 'Rate limit exceeded, please try again later' :
        error.message.includes('Invalid Product Hunt URL') ? 'Invalid Product Hunt URL' :
        'Failed to fetch upvotes'
      );
      setUpvotes(product.upvotes || product.phUpvotes || 'N/A');
    } finally {
      setIsFetchingUpvotes(false);
    }
  }, 500);

  useEffect(() => {
    if (product.phLink || product.productHuntLink) {
      debouncedFetchPhUpvotes();
    } else {
      setFetchError('No Product Hunt link available');
      setIsFetchingUpvotes(false);
      setUpvotes('N/A');
    }
  }, [product.id, product.phLink, product.productHuntLink, product.name, product.upvotes]);

  const isValidLinkedInUrl = product.linkedin &&
    typeof product.linkedin === 'string' &&
    product.linkedin.includes('linkedin.com/company/') &&
    product.linkedin !== 'https://www.linkedin.com/company/producthunt';

  const handleEnrichLinkedIn = async () => {
    if (!isValidLinkedInUrl || isEnriching) return;
    
    setIsEnriching(true);
    setEnrichError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/linkedin/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedin_url: product.linkedin })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      const companyData = data[0];
      
      if (!companyData) {
        throw new Error('No enrichment data returned');
      }
      
      const extracted = {
        operating_status: companyData.operating_status,
        regions: companyData.regions,
        founded_year: companyData.founded_year,
        founders: companyData.founders,
        founder_info: companyData.founder_info,
        founder_count: companyData.founder_count,
        employee_count: companyData.employee_count,
        employee_count_range: companyData.employee_count_range,
        city: companyData.hq?.city,
        state: companyData.hq?.state,
        country: companyData.hq?.country,
        phone_number: companyData.contact?.phone_number,
        email: companyData.contact?.email,
        growth_stage: companyData.growth_stage
      };
      
      const persistResponse = await fetch(`${API_BASE_URL}/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedInData: extracted })
      });
      
      if (!persistResponse.ok) {
        console.error('Failed to persist enriched data');
      }
      
      setEnrichedData(extracted);
      if (onEnrich) {
        onEnrich(product.id, extracted);
      }
      
      if (swipeDirection === 'up') {
        setSwipeAction('enriched');
        setTimeout(() => {
          setSwipeDirection(null);
          setSwipeAction(null);
          if (onSwipeComplete) onSwipeComplete();
        }, 500);
      }
    } catch (error) {
      console.error('LinkedIn enrichment error:', error);
      setEnrichError(error.message);
      
      if (swipeDirection === 'up') {
        setSwipeAction('error');
        setTimeout(() => {
          setSwipeDirection(null);
          setSwipeAction(null);
          if (onSwipeComplete) onSwipeComplete();
        }, 500);
      }
    } finally {
      setIsEnriching(false);
    }
  };

  const updateProductStatus = async (status) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update product status: ${errorText}`);
      }
      
      if (onStatusChange) {
        onStatusChange(product.id, status);
      }
      
      if (swipeDirection) {
        setSwipeAction(status === 'approved' ? 'accept' : 'reject');
        setTimeout(() => {
          setSwipeDirection(null);
          setSwipeAction(null);
          if (onSwipeComplete) onSwipeComplete();
        }, 500);
      }
    } catch (error) {
      console.error('Error updating product status:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwipe = (direction) => {
    if (isProcessing) return;

    if (selectedStatus === 'rejected' && product.status === 'rejected') {
      if (direction === 'right') {
        setSwipeDirection(direction);
        updateProductStatus('approved');
      }
    } else if (selectedStatus === 'approved' && product.status === 'approved') {
      if (direction === 'left') {
        setSwipeDirection(direction);
        updateProductStatus('rejected');
      }
    } else if (selectedStatus === 'pending' && product.status === 'pending') {
      if (direction === 'left') {
        setSwipeDirection(direction);
        updateProductStatus('rejected');
      } else if (direction === 'right') {
        setSwipeDirection(direction);
        updateProductStatus('approved');
      } else if (direction === 'up' && isValidLinkedInUrl && !isEnriching) {
        setSwipeDirection(direction);
        handleEnrichLinkedIn();
      }
    } else if (selectedStatus === 'all') {
      if (product.status === 'rejected' && direction === 'right') {
        setSwipeDirection(direction);
        updateProductStatus('approved');
      } else if (product.status === 'approved' && direction === 'left') {
        setSwipeDirection(direction);
        updateProductStatus('rejected');
      } else if (product.status === 'pending') {
        if (direction === 'left') {
          setSwipeDirection(direction);
          updateProductStatus('rejected');
        } else if (direction === 'right') {
          setSwipeDirection(direction);
          updateProductStatus('approved');
        } else if (direction === 'up' && isValidLinkedInUrl && !isEnriching) {
          setSwipeDirection(direction);
          handleEnrichLinkedIn();
        }
      }
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedUp: () => handleSwipe('up'),
    onSwipedLeft: () => handleSwipe('left'),
    onSwipedRight: () => handleSwipe('right'),
    preventDefaultTouchmoveEvent: true,
    trackMouse: false
  });

  const getSwipeCardStyle = () => {
    if (swipeDirection) {
      if (swipeDirection === 'up') {
        return {
          transform: 'translateY(-100vh)',
          opacity: 0,
          transition: 'transform 0.5s ease, opacity 0.5s ease'
        };
      } else if (swipeDirection === 'left') {
        return {
          transform: 'translateX(-120vw) rotate(-30deg)',
          opacity: 0,
          transition: 'transform 0.5s ease, opacity 0.5s ease'
        };
      } else if (swipeDirection === 'right') {
        return {
          transform: 'translateX(120vw) rotate(30deg)',
          opacity: 0,
          transition: 'transform 0.5s ease, opacity 0.5s ease'
        };
      }
    }
    return {
      transform: 'translateY(0) translateX(0) rotate(0deg)',
      opacity: 1,
      transition: 'transform 0.3s ease, opacity 0.3s ease'
    };
  };

  const renderSwipeOverlay = () => {
    if (!swipeAction) return null;
    
    let overlayClass = '';
    let overlayText = '';
    
    if (swipeAction === 'enriched') {
      overlayClass = 'enriched';
      overlayText = '✅ LinkedIn Enriched';
    } else if (swipeAction === 'error') {
      overlayClass = 'error';
      overlayText = '❌ Enrichment Failed';
    } else if (swipeAction === 'accept') {
      overlayClass = 'accept';
      overlayText = '✓ Accepted';
    } else if (swipeAction === 'reject') {
      overlayClass = 'reject';
      overlayText = '✕ Rejected';
    }
    
    return (
      <div className={`product-swipe-overlay ${overlayClass}`}>
        <div className="text-white text-xl font-bold">
          {overlayText}
        </div>
      </div>
    );
  };

  const displayData = enrichedData || product.linkedInData;

  return (
    <div 
      {...(isMobile ? swipeHandlers : {})}
      className={`product-card admin-swipe-card bg-gradient-to-br from-white to-[#fef7f5] rounded-xl shadow-md border border-gray-200 overflow-y-auto p-4 space-y-2 w-full ${isMobile ? 'h-[450px]' : 'h-[400px]'} hover:shadow-lg transition-all duration-200 relative`}
      style={isMobile ? getSwipeCardStyle() : {}}
    >
      {isMobile && renderSwipeOverlay()}
      <div className="card-header relative">
        <div className="flex items-center gap-2 mb-2">
          {product.thumbnail?.url ? (
            <img
              loading="lazy"
              src={product.thumbnail.url}
              alt={`${product.name || 'Product'} thumbnail`}
              className="rounded-lg shadow-sm"
              style={{ width: isMobile ? '28px' : '36px', height: isMobile ? '28px' : '36px' }}
            />
          ) : (
            <div className={`w-${isMobile ? '7' : '9'} h-${isMobile ? '7' : '9'} bg-gray-200 rounded-lg flex items-center justify-center shadow-sm`}>
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 4h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 9h7V6H4v7zm14-9h-4v2h4v12H8v-4H6v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-5 4h-2v4H8v2h3v4h2v-4h3v-2h-3V8z"/>
              </svg>
            </div>
          )}
          <h3 className={`text-${isMobile ? 'base' : 'lg'} font-semibold text-gray-800`}>{product.name || 'Untitled Product'}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`inline-block ${getCategoryBadgeClasses(product.category)} text-xs px-2 py-1 rounded-md shadow-sm`}>
            {getCategoryDisplayName(product.category)}
          </span>
          {product.launchLabel && (
            <span className="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-md shadow-sm">
              {product.launchLabel}
            </span>
          )}
        </div>
      </div>
      <div className="card-body space-y-2 overflow-y-auto" style={{ maxHeight: displayData ? '100px' : '150px' }}>
        {product.description && (
          <p className={`text-gray-600 text-${isMobile ? 'xs' : 'sm'} max-h-32`}>{product.description || 'No description available.'}</p>
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
        <h4 className={`text-${isMobile ? 'xs' : 'sm'} font-semibold text-gray-900 mb-2 flex items-center px-4`}>
          <svg className="w-4 h-4 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Company Information
        </h4>
        <div className="space-y-2 px-4">
          <div className={`text-${isMobile ? 'xs' : 'sm'} text-gray-700 font-medium`}>
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
            <div className={`text-${isMobile ? 'xs' : 'sm'} text-gray-700 font-medium`}>
              Maker: {product.makerName}
            </div>
          )}
        </div>
      </div>
      
      {displayData && (
        <div className="py-2 bg-blue-50 border border-blue-100 rounded-lg shadow-sm overflow-y-auto enriched-data" style={{ maxHeight: '150px' }}>
          <h4 className={`text-${isMobile ? 'xs' : 'sm'} font-semibold text-gray-900 mb-2 flex items-center px-4`}>
            <svg className="w-4 h-4 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            Enriched Data
          </h4>
          <div className={`space-y-1 px-4 text-${isMobile ? 'xs' : 'sm'} text-gray-700`}>
            <p>Operating Status: {displayData.operating_status || 'N/A'}</p>
            <p>Regions: {displayData.regions?.join(', ') || 'N/A'}</p>
            <p>Founded Year: {displayData.founded_year || 'N/A'}</p>
            <p>Founders: {displayData.founders?.join(', ') || 'N/A'}</p>
            <p>Founder Count: {displayData.founder_count || 'N/A'}</p>
            <p>Employee Count: {displayData.employee_count || 'N/A'}</p>
            <p>Employee Range: {displayData.employee_count_range || 'N/A'}</p>
            {(displayData.city || displayData.state || displayData.country) && (
              <p>
                HQ: {(displayData.city || displayData.state || displayData.country)
                  ? `${displayData.city || ''}${displayData.city && displayData.state ? ', ' : ''}${displayData.state || ''}${displayData.state && displayData.country ? ', ' : ''}${displayData.country || ''}`
                  : 'N/A'}
              </p>
            )}
            <p>Phone: {displayData.phone_number || 'N/A'}</p>
            <p>Email: {displayData.email || 'N/A'}</p>
            <p>Growth Stage: {displayData.growth_stage || 'N/A'}</p>
            {displayData.founder_info && displayData.founder_info.length > 0 && (
              <div>
                <p>Founder Info:</p>
                {displayData.founder_info.map((info, idx) => (
                  <p key={idx}> - {info.full_name}: {info.title} ({info.departments?.join(', ') || 'N/A'})</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {fetchError && (
        <div className="px-4 py-1 text-xs text-red-500">
          {fetchError}
        </div>
      )}
      <div className="px-4 py-2 flex justify-between items-center mt-2 sticky bottom-0 bg-gradient-to-t from-white to-transparent">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center px-3 py-1 rounded-full border bg-gray-100 text-gray-700 border-gray-200 shadow-sm">
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/>
            </svg>
            <span className="text-sm font-medium">
              {isFetchingUpvotes ? 'Loading...' : `↑ ${upvotes}`}
            </span>
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-sm ${getStatusBadgeClasses(product.status)}`}>
            {product.status ? product.status.charAt(0).toUpperCase() + product.status.slice(1) : 'Unknown'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isMobile && product.status === 'pending' && (
            <>
              <button
                onClick={() => updateProductStatus('approved')}
                disabled={isProcessing}
                className={`px-3 py-1 text-sm font-medium rounded-md shadow-sm ${
                  isProcessing ? 'bg-green-100 text-green-700 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {isProcessing ? 'Processing...' : 'Accept'}
              </button>
              <button
                onClick={() => updateProductStatus('rejected')}
                disabled={isProcessing}
                className={`px-3 py-1 text-sm font-medium rounded-md shadow-sm ${
                  isProcessing ? 'bg-red-100 text-red-700 cursor-not-allowed' : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {isProcessing ? 'Processing...' : 'Reject'}
              </button>
            </>
          )}
          {(product.phLink || product.productHuntLink) ? (
            <a
              href={product.phLink || product.productHuntLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-${isMobile ? 'xs' : 'sm'} text-gray-600 hover:text-gray-900 font-medium hover:underline transition-colors duration-200 px-3 py-1 bg-orange-50 rounded-md shadow-sm`}
            >
              View on Product Hunt
            </a>
          ) : (
            <span className={`text-${isMobile ? 'xs' : 'sm'} text-gray-400 font-medium px-3 py-1 bg-orange-50 rounded-md shadow-sm cursor-not-allowed`}>
              No Product Hunt Link
            </span>
          )}
        </div>
      </div>
      {isMobile && (
        <div className="text-center text-gray-600 text-xs mt-2 swipe-instructions">
          {selectedStatus === 'rejected' ? (
            <span>
              Swipe <span className="text-green-500 font-bold">→ right</span> to accept
            </span>
          ) : selectedStatus === 'approved' ? (
            <span>
              Swipe <span className="text-red-500 font-bold">← left</span> to reject
            </span>
          ) : (
            <span>
              Swipe <span className="text-red-500 font-bold">← left</span> to reject or{' '}
              <span className="text-green-500 font-bold">→ right</span> to accept
            </span>
          )}
        </div>
      )}
      {isValidLinkedInUrl && (
        <div className="px-4 py-2 flex items-center">
          <svg className="w-4 h-4 text-[#0077b5] mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
          </svg>
          <a
            href={product.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-${isMobile ? 'xs' : 'sm'} text-[#0077b5] hover:underline font-medium transition-colors duration-200`}
          >
            LinkedIn
          </a>
          <button
            onClick={handleEnrichLinkedIn}
            disabled={isEnriching || !!displayData}
            className={`ml-2 px-2 py-1 text-xs font-medium rounded-md shadow-sm ${!!displayData ? 'bg-green-100 text-green-700 cursor-default' : isEnriching ? 'bg-blue-100 text-blue-700 animate-pulse' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
            title={!!displayData ? 'Already enriched' : 'Enrich LinkedIn profile'}
          >
            {!!displayData ? '✓ Enriched' : isEnriching ? 'Enriching...' : 'Enrich LinkedIn'}
          </button>
          {enrichError && <span className="text-xs text-red-500 ml-2">{enrichError}</span>}
        </div>
      )}
      {product.phGithub && (
        <div className="px-4 py-2 flex items-center">
          <svg className="w-4 h-4 text-gray-900 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0a12 12 0 00-3.79 23.39c.6.11.82-.26.82-.58v-2.06c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.49 11.49 0 016.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58A12 12 0 0012 0z"/>
          </svg>
          <a
            href={product.phGithub}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-${isMobile ? 'xs' : 'sm'} text-gray-900 hover:underline font-medium transition-colors duration-200`}
          >
            GitHub
          </a>
        </div>
      )}
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
      phUpvotes: PropTypes.number, // Backward compatibility
      phTopics: PropTypes.arrayOf(PropTypes.string),
      dayRank: PropTypes.string,
      companyWebsite: PropTypes.string,
      companyInfo: PropTypes.string,
      launchDate: PropTypes.string,
      accelerator: PropTypes.string,
      linkedin: PropTypes.string,
      makerName: PropTypes.string,
      phGithub: PropTypes.string,
      phLink: PropTypes.string,
      productHuntLink: PropTypes.string,
      linkedInData: PropTypes.object,
      thumbnail: PropTypes.shape({
        url: PropTypes.string
      })
    })
  ).isRequired,
  selectedCategory: PropTypes.string,
  selectedStatus: PropTypes.string,
  selectedSort: PropTypes.string,
  formatDate: PropTypes.func,
  onEnrich: PropTypes.func,
  onStatusChange: PropTypes.func
};

ProductCard.propTypes = {
  product: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    description: PropTypes.string,
    category: PropTypes.string,
    status: PropTypes.string,
    upvotes: PropTypes.number,
    phUpvotes: PropTypes.number, // Backward compatibility
    phTopics: PropTypes.arrayOf(PropTypes.string),
    dayRank: PropTypes.string,
    companyWebsite: PropTypes.string,
    companyInfo: PropTypes.string,
    launchDate: PropTypes.string,
    accelerator: PropTypes.string,
    linkedin: PropTypes.string,
    makerName: PropTypes.string,
    phGithub: PropTypes.string,
    phLink: PropTypes.string,
    productHuntLink: PropTypes.string,
    linkedInData: PropTypes.object,
    thumbnail: PropTypes.shape({
      url: PropTypes.string
    })
  }).isRequired,
  formatDate: PropTypes.func,
  onEnrich: PropTypes.func,
  onStatusChange: PropTypes.func,
  onSwipeComplete: PropTypes.func,
  isMobile: PropTypes.bool,
  selectedStatus: PropTypes.string
};

export default ProductList;
