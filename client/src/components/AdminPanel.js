import React, { useState, useEffect, useRef } from 'react';
import { useSwipeable } from 'react-swipeable';

const AdminPanel = () => {
  const [makers, setMakers] = useState([]);
  const [filteredMakers, setFilteredMakers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [processingIds, setProcessingIds] = useState(new Set());
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [swipeAction, setSwipeAction] = useState(null);
  const swipeTimeoutRef = useRef(null);
  
  // Authentication state
  const [authMethod, setAuthMethod] = useState('basic'); // 'basic' or 'token'
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    token: ''
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    // Load authentication method from server info
    fetchAuthInfo();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadMakers();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    filterMakers();
  }, [makers, statusFilter, categoryFilter]);

  const fetchAuthInfo = async () => {
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        // Server is running, use default authentication method
        setAuthMethod('basic');
      }
    } catch (err) {
      console.log('Could not fetch auth info, using default');
      setAuthMethod('basic');
    }
  };

  const getAuthHeaders = () => {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (authMethod === 'token' && credentials.token) {
      headers['X-Auth-Token'] = credentials.token;
    } else if (authMethod === 'basic' && credentials.username && credentials.password) {
      const base64Credentials = btoa(`${credentials.username}:${credentials.password}`);
      headers['Authorization'] = `Basic ${base64Credentials}`;
    }

    return headers;
  };

  const makeAuthenticatedRequest = async (url, options = {}) => {
    const headers = getAuthHeaders();
    
    const requestOptions = {
      ...options,
      headers: {
        ...headers,
        ...options.headers
      }
    };

    const response = await fetch(url, requestOptions);
    
    if (response.status === 401) {
      setIsAuthenticated(false);
      setAuthError('Authentication failed. Please check your credentials.');
      throw new Error('Authentication required');
    }
    
    return response;
  };

  const loadMakers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await makeAuthenticatedRequest('/api/makers');
      const data = await response.json();
      
      if (data.success) {
        setMakers(data.makers);
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setError(data.error?.message || 'Failed to load makers');
      }
    } catch (err) {
      if (err.message === 'Authentication required') {
        // Auth error is already handled
        return;
      }
      setError('Failed to connect to server');
      console.error('Error loading makers:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterMakers = () => {
    let filtered = [...makers];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(maker => maker.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(maker => maker.category === categoryFilter);
    }

    setFilteredMakers(filtered);
    setCurrentCardIndex(0); // Reset card index when filters change
  };

  const handleApprove = async (makerId) => {
    if (processingIds.has(makerId)) return;

    try {
      setProcessingIds(prev => new Set(prev).add(makerId));
      setError(null);

      const response = await makeAuthenticatedRequest(`/api/makers/${makerId}/approve`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: 'Maker approved successfully!'
        });
        
        // Update the maker's status in the local state
        setMakers(prev => prev.map(maker => 
          maker.id === makerId 
            ? { ...maker, status: 'approved', updatedAt: new Date().toISOString() }
            : maker
        ));
        
        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        setError(data.error?.message || 'Failed to approve maker');
      }
    } catch (err) {
      setError('Failed to approve maker');
      console.error('Error approving maker:', err);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(makerId);
        return newSet;
      });
    }
  };

  const handleReject = async (makerId) => {
    if (processingIds.has(makerId)) return;

    try {
      setProcessingIds(prev => new Set(prev).add(makerId));
      setError(null);

      const response = await makeAuthenticatedRequest(`/api/makers/${makerId}/reject`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setMessage({
          type: 'success',
          text: 'Maker rejected successfully!'
        });
        
        // Update the maker's status in the local state
        setMakers(prev => prev.map(maker => 
          maker.id === makerId 
            ? { ...maker, status: 'rejected', updatedAt: new Date().toISOString() }
            : maker
        ));
        
        // Clear message after 3 seconds
        setTimeout(() => setMessage(null), 3000);
      } else {
        setError(data.error?.message || 'Failed to reject maker');
      }
    } catch (err) {
      setError('Failed to reject maker');
      console.error('Error rejecting maker:', err);
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(makerId);
        return newSet;
      });
    }
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

  const isValidLinkedInUrl = (linkedin) =>
    linkedin &&
    typeof linkedin === 'string' &&
    linkedin.includes('linkedin.com') &&
    !linkedin.includes('producthunt.com');

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError(null);
    
    try {
      setLoading(true);
      await loadMakers(); // This will test authentication
    } catch (err) {
      // Error handling is done in loadMakers
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCredentials({ username: '', password: '', token: '' });
    setMakers([]);
    setFilteredMakers([]);
    setAuthError(null);
    setCurrentCardIndex(0);
  };

  const clearMessage = () => {
    setMessage(null);
    setError(null);
  };

  const handleSwipe = (direction) => {
    if (filteredMakers.length === 0 || currentCardIndex >= filteredMakers.length) return;
    
    const currentMaker = filteredMakers[currentCardIndex];
    if (!currentMaker || processingIds.has(currentMaker.id)) return;
    
    setSwipeDirection(direction);
    setSwipeAction(direction === 'right' ? 'accepted' : 'rejected');
    
    // Clear any existing timeout
    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current);
    }
    
    // Set a timeout to process the swipe action and reset the animation
    swipeTimeoutRef.current = setTimeout(() => {
      if (direction === 'right') {
        handleApprove(currentMaker.id);
      } else {
        handleReject(currentMaker.id);
      }
      
      // Move to the next card
      setCurrentCardIndex(prevIndex => prevIndex + 1);
      
      // Reset swipe animation state
      setSwipeDirection(null);
      setSwipeAction(null);
    }, 500); // Animation duration
  };
  
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('left'),
    onSwipedRight: () => handleSwipe('right'),
    preventDefaultTouchmoveEvent: true,
    trackMouse: false
  });
  
  const getSwipeCardStyle = (index) => {
    const isCurrent = index === currentCardIndex;
    
    if (!isCurrent) {
      return {
        display: 'none', // Hide non-active cards completely
        zIndex: 1000 - index
      };
    }
    
    if (swipeDirection) {
      return {
        transform: `translateX(${swipeDirection === 'right' ? 100 : -100}vw) rotate(${swipeDirection === 'right' ? 30 : -30}deg)`,
        opacity: 0,
        transition: 'transform 0.5s ease, opacity 0.5s ease',
        zIndex: 1000
      };
    }
    
    return {
      zIndex: 1000,
      transform: 'translateX(0) rotate(0deg)',
      opacity: 1,
      transition: 'transform 0.3s ease, opacity 0.3s ease'
    };
  };
  
  const renderSwipeOverlay = () => {
    if (!swipeAction) return null;
    
    return (
      <div className={`admin-swipe-overlay ${swipeAction === 'accepted' ? 'accept' : 'reject'}`}>
        <div className="text-white text-2xl font-bold">
          {swipeAction === 'accepted' ? '✅ Accepted' : '❌ Rejected'}
        </div>
      </div>
    );
  };

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">🔐 Admin Login</h1>
            <p className="text-gray-600">Please authenticate to access the admin panel</p>
          </div>

          {/* Login Form */}
          <div className="card mb-6">
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Authentication Method Selector */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="basic"
                      checked={authMethod === 'basic'}
                      onChange={(e) => setAuthMethod(e.target.value)}
                      className="text-primary-500 focus:ring-primary-500"
                    />
                    <span className="font-semibold text-gray-700">Username & Password</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      value="token"
                      checked={authMethod === 'token'}
                      onChange={(e) => setAuthMethod(e.target.value)}
                      className="text-primary-500 focus:ring-primary-500"
                    />
                    <span className="font-semibold text-gray-700">Access Token</span>
                  </label>
                </div>
              </div>

              {/* Conditional Form Fields */}
              {authMethod === 'basic' ? (
                <>
                  <div>
                    <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                      Username:
                    </label>
                    <input
                      type="text"
                      id="username"
                      value={credentials.username}
                      onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                      required
                      placeholder="Enter admin username"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                      Password:
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={credentials.password}
                      onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                      required
                      placeholder="Enter admin password"
                      className="form-input"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="token" className="block text-sm font-semibold text-gray-700 mb-2">
                    Access Token:
                  </label>
                  <input
                    type="password"
                    id="token"
                    value={credentials.token}
                    onChange={(e) => setCredentials(prev => ({ ...prev, token: e.target.value }))}
                    required
                    placeholder="Enter access token"
                    className="form-input"
                  />
                </div>
              )}

              {/* Error Message */}
              {authError && (
                <div className="error-message">
                  <strong>Authentication Error:</strong> {authError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="bg-[#ea5d38] hover:bg-[#dc2626] text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 w-full"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner"></div>
                    Authenticating...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-4 lg:mb-0">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">🛠️ Admin Panel</h1>
              <p className="text-gray-600">Review and approve or reject enriched makers from Product Hunt listings</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Authenticated via {authMethod.toUpperCase()}</span>
              <button onClick={handleLogout} className="btn-secondary">
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex flex-col">
                <label htmlFor="status-filter" className="block text-sm font-semibold text-gray-700 mb-2">
                  Filter by Status:
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="form-input max-w-xs"
                >
                  <option value="pending">Pending ({makers.filter(m => m.status === 'pending').length})</option>
                  <option value="approved">Approved ({makers.filter(m => m.status === 'approved').length})</option>
                  <option value="rejected">Rejected ({makers.filter(m => m.status === 'rejected').length})</option>
                  <option value="all">All ({makers.length})</option>
                </select>
              </div>

              <div className="flex flex-col">
                <label htmlFor="category-filter" className="block text-sm font-semibold text-gray-700 mb-2">
                  Filter by Category:
                </label>
                <select
                  id="category-filter"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="form-input max-w-xs"
                >
                  <option value="all">All Categories ({makers.length})</option>
                  <option value="artificial-intelligence">AI ({makers.filter(m => m.category === 'artificial-intelligence').length})</option>
                  <option value="developer-tools">Developer Tools ({makers.filter(m => m.category === 'developer-tools').length})</option>
                  <option value="saas">SaaS ({makers.filter(m => m.category === 'saas').length})</option>
                </select>
              </div>
            </div>

            <button
              onClick={loadMakers}
              disabled={loading}
              className="btn-secondary"
            >
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
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
          <div className="error-message relative">
            <strong>Error:</strong> {error}
            <button onClick={clearMessage} className="absolute top-4 right-4 text-red-500 hover:text-red-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {message && (
          <div className="success-message relative">
            <strong>Success:</strong> {message.text}
            <button onClick={clearMessage} className="absolute top-4 right-4 text-green-500 hover:text-green-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading makers...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {filteredMakers.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No makers found</h3>
                <p className="text-gray-600">No makers found with status: {statusFilter}</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Published</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Maker</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LinkedIn</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Links</th>
                        {statusFilter === 'pending' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredMakers.map(maker => (
                        <tr key={maker.id} className="hover:bg-gray-50 transition-colors duration-150">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-gray-900">{maker.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={getCategoryBadgeClasses(maker.category)}>
                              {getCategoryDisplayName(maker.category)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(maker.publishedAt)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 max-w-xs">
                              {maker.description || 'No description available.'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {maker.makerName || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isValidLinkedInUrl(maker.linkedin) ? (
                              <a 
                                href={maker.linkedin} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="linkedin-button"
                              >
                                LinkedIn
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ) : (
                              <span className="text-gray-400 italic text-sm">No LinkedIn</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {maker.phLink ? (
                              <a 
                                href={maker.phLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-orange-600 hover:text-orange-800 font-medium text-sm flex items-center"
                              >
                                Product Hunt
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ) : (
                              <span className="text-gray-400 italic text-sm">No Product Hunt Link</span>
                            )}
                          </td>
                          {statusFilter === 'pending' && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleApprove(maker.id)}
                                  disabled={processingIds.has(maker.id)}
                                  className="btn-approve"
                                >
                                  {processingIds.has(maker.id) ? (
                                    <div className="loading-spinner"></div>
                                  ) : (
                                    <span>✅</span>
                                  )}
                                  Approve
                                </button>
                                
                                <button
                                  onClick={() => handleReject(maker.id)}
                                  disabled={processingIds.has(maker.id)}
                                  className="btn-reject"
                                >
                                  {processingIds.has(maker.id) ? (
                                    <div className="loading-spinner"></div>
                                  ) : (
                                    <span>❌</span>
                                  )}
                                  Reject
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden">
                  {statusFilter === 'pending' ? (
                    <div className="mobile-admin-swipe-container">
                      {filteredMakers.length === 0 ? (
                        <div className="flex items-center justify-center h-[450px] bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                          <div className="text-center">
                            <span className="text-3xl mb-4 block">🎉</span>
                            <h3 className="text-xl font-semibold text-gray-900">No pending products to review!</h3>
                          </div>
                        </div>
                      ) : currentCardIndex >= filteredMakers.length ? (
                        <div className="flex items-center justify-center h-[450px] bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                          <div className="text-center">
                            <span className="text-3xl mb-4 block">🎉</span>
                            <h3 className="text-xl font-semibold text-gray-900">All products reviewed!</h3>
                          </div>
                        </div>
                      ) : (
                        <div className="admin-swipe-card-container">
                          {filteredMakers.map((maker, index) => (
                            <div 
                              key={maker.id} 
                              {...(index === currentCardIndex ? swipeHandlers : {})} 
                              className="admin-swipe-card"
                              style={getSwipeCardStyle(index)}
                            >
                              <div className="card-header">
                                <div className="flex items-center gap-2 mb-2">
                                  {maker.thumbnail?.url ? (
                                    <img
                                      loading="lazy"
                                      src={maker.thumbnail.url}
                                      alt={`${maker.name || 'Product'} thumbnail`}
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
                                  <h3 className="text-lg font-semibold text-gray-800">{maker.name || 'Untitled Product'}</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className={`inline-block ${getCategoryBadgeClasses(maker.category)} text-xs px-2 py-1 rounded-md shadow-sm`}>
                                    {getCategoryDisplayName(maker.category)}
                                  </span>
                                </div>
                              </div>
                              <div className="card-body space-y-2">
                                {maker.description && (
                                  <p className="text-gray-600 text-sm max-h-32 overflow-y-auto">{maker.description || 'No description available.'}</p>
                                )}
                                {maker.phTopics && maker.phTopics.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {maker.phTopics.slice(0, 3).map((topic, index) => (
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
                                    {maker.companyWebsite ? (
                                      <a
                                        href={maker.companyWebsite}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-orange-600 hover:text-orange-800 hover:underline transition-colors duration-200"
                                      >
                                        {maker.companyWebsite.replace(/^https?:\/\//, '')}
                                      </a>
                                    ) : 'Website Not Available'}
                                    <span className="mx-2">–</span>
                                    <span>{maker.companyInfo || 'Company Info Not Available'}</span>
                                    <span className="mx-2">–</span>
                                    <span>{maker.publishedAt ? `Launched in ${formatDate(maker.publishedAt)}` : 'Launch Date Not Available'}</span>
                                  </div>
                                  {maker.accelerator && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded shadow-sm">
                                        {maker.accelerator}
                                      </span>
                                    </div>
                                  )}
                                  {maker.makerName && (
                                    <div className="text-sm text-gray-700 font-medium">
                                      Maker: {maker.makerName}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-md shadow-sm mt-2">
                                <div className="flex items-center gap-4">
                                  {isValidLinkedInUrl(maker.linkedin) && (
                                    <div className="flex items-center">
                                      <svg className="w-4 h-4 text-[#0077b5] mr-2" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                      </svg>
                                      <a
                                        href={maker.linkedin}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-[#0077b5] hover:underline font-medium transition-colors duration-200"
                                      >
                                        LinkedIn
                                      </a>
                                    </div>
                                  )}
                                  {maker.phGithub && (
                                    <div className="flex items-center">
                                      <svg className="w-4 h-4 text-gray-900 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 0a12 12 0 00-3.79 23.39c.6.11.82-.26.82-.58v-2.06c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.49 11.49 0 016.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58A12 12 0 0012 0z"/>
                                      </svg>
                                      <a
                                        href={maker.phGithub}
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
                              <div className="card-footer">
                                <div className="flex items-center gap-4">
                                  <button
                                    className={`flex items-center justify-center px-3 py-1 rounded-full border transition-all duration-200 shadow-sm ${
                                      maker.upvotes > 0
                                        ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                                    } ${processingIds.has(maker.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    disabled={true}
                                    title="Upvote count (non-interactive)"
                                  >
                                    <svg className="w-5 h-5 mr-1" fill={maker.upvotes > 0 ? 'currentColor' : 'none'} stroke={maker.upvotes > 0 ? 'none' : 'currentColor'} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/>
                                    </svg>
                                    <span className="text-sm font-medium">{maker.upvotes || 0}</span>
                                  </button>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-sm ${getStatusBadgeClasses(maker.status)}`}>
                                    {maker.status ? maker.status.charAt(0).toUpperCase() + maker.status.slice(1) : 'Unknown'}
                                  </span>
                                </div>
                                {maker.phLink && (
                                  <a
                                    href={maker.phLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-gray-600 hover:text-gray-900 font-medium hover:underline transition-colors duration-200 px-3 py-1 bg-orange-50 rounded-md shadow-sm"
                                  >
                                    View on Product Hunt
                                  </a>
                                )}
                              </div>
                              {/* Swipe instructions */}
                              <div className="absolute bottom-4 left-0 right-0 text-center text-sm text-gray-500">
                                <div className="flex justify-center items-center space-x-8">
                                  <div className="flex flex-col items-center">
                                    <span className="text-red-500">←</span>
                                    <span>Swipe left to reject</span>
                                  </div>
                                  <div className="flex flex-col items-center">
                                    <span className="text-green-500">→</span>
                                    <span>Swipe right to approve</span>
                                  </div>
                                </div>
                              </div>
                              {/* Overlay for accept/reject animation */}
                              {index === currentCardIndex && renderSwipeOverlay()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredMakers.map(maker => (
                        <div key={maker.id} className="admin-swipe-card p-6 space-y-4">
                          <div className="card-header">
                            <div className="flex items-center gap-2 mb-2">
                              {maker.thumbnail?.url ? (
                                <img
                                  loading="lazy"
                                  src={maker.thumbnail.url}
                                  alt={`${maker.name || 'Product'} thumbnail`}
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
                              <h3 className="text-lg font-semibold text-gray-800">{maker.name || 'Untitled Product'}</h3>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className={`inline-block ${getCategoryBadgeClasses(maker.category)} text-xs px-2 py-1 rounded-md shadow-sm`}>
                                {getCategoryDisplayName(maker.category)}
                              </span>
                            </div>
                          </div>
                          <div className="card-body space-y-2">
                            {maker.description && (
                              <p className="text-gray-600 text-sm max-h-32 overflow-y-auto">{maker.description || 'No description available.'}</p>
                            )}
                            {maker.phTopics && maker.phTopics.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {maker.phTopics.slice(0, 3).map((topic, index) => (
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
                                {maker.companyWebsite ? (
                                  <a
                                    href={maker.companyWebsite}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-orange-600 hover:text-orange-800 hover:underline transition-colors duration-200"
                                  >
                                    {maker.companyWebsite.replace(/^https?:\/\//, '')}
                                  </a>
                                ) : 'Website Not Available'}
                                <span className="mx-2">–</span>
                                <span>{maker.companyInfo || 'Company Info Not Available'}</span>
                                <span className="mx-2">–</span>
                                <span>{maker.publishedAt ? `Launched in ${formatDate(maker.publishedAt)}` : 'Launch Date Not Available'}</span>
                              </div>
                              {maker.accelerator && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-1 rounded shadow-sm">
                                    {maker.accelerator}
                                  </span>
                                </div>
                              )}
                              {maker.makerName && (
                                <div className="text-sm text-gray-700 font-medium">
                                  Maker: {maker.makerName}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 rounded-md shadow-sm mt-2">
                            <div className="flex items-center gap-4">
                              {isValidLinkedInUrl(maker.linkedin) && (
                                <div className="flex items-center">
                                  <svg className="w-4 h-4 text-[#0077b5] mr-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                  </svg>
                                  <a
                                    href={maker.linkedin}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-[#0077b5] hover:underline font-medium transition-colors duration-200"
                                  >
                                    LinkedIn
                                  </a>
                                </div>
                              )}
                              {maker.phGithub && (
                                <div className="flex items-center">
                                  <svg className="w-4 h-4 text-gray-900 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0a12 12 0 00-3.79 23.39c.6.11.82-.26.82-.58v-2.06c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.21.09 1.85 1.24 1.85 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.49 11.49 0 016.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58A12 12 0 0012 0z"/>
                                  </svg>
                                  <a
                                    href={maker.phGithub}
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
                          <div className="card-footer">
                            <div className="flex items-center gap-4">
                              <button
                                className={`flex items-center justify-center px-3 py-1 rounded-full border transition-all duration-200 shadow-sm ${
                                  maker.upvotes > 0
                                    ? 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600'
                                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                                } ${processingIds.has(maker.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={true}
                                title="Upvote count (non-interactive)"
                              >
                                <svg className="w-5 h-5 mr-1" fill={maker.upvotes > 0 ? 'currentColor' : 'none'} stroke={maker.upvotes > 0 ? 'none' : 'currentColor'} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/>
                                </svg>
                                <span className="text-sm font-medium">{maker.upvotes || 0}</span>
                              </button>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border shadow-sm ${getStatusBadgeClasses(maker.status)}`}>
                                {maker.status ? maker.status.charAt(0).toUpperCase() + maker.status.slice(1) : 'Unknown'}
                              </span>
                            </div>
                            {maker.phLink && (
                              <a
                                href={maker.phLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-gray-600 hover:text-gray-900 font-medium hover:underline transition-colors duration-200 px-3 py-1 bg-orange-50 rounded-md shadow-sm"
                              >
                                View on Product Hunt
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;