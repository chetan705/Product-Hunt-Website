const crypto = require('crypto');

/**
 * Basic HTTP Authentication middleware for admin routes
 */
const basicAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return sendAuthChallenge(res);
  }

  try {
    // Extract credentials from Basic auth header
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    // Get credentials from environment variables
    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'admin123';

    // Verify credentials
    if (username === validUsername && password === validPassword) {
      next();
    } else {
      return sendAuthChallenge(res);
    }
  } catch (error) {
    console.error('Authentication error:', error.message);
    return sendAuthChallenge(res);
  }
};

/**
 * Token-based authentication middleware (alternative to basic auth)
 */
const tokenAuth = (req, res, next) => {
  const token = req.query.token || req.headers['x-auth-token'];
  const validToken = process.env.ADMIN_TOKEN || 'secure-admin-token-123';
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Authentication required',
        details: 'No authentication token provided. Add ?token=YOUR_TOKEN to the URL or include X-Auth-Token header.'
      }
    });
  }

  if (token !== validToken) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid authentication token',
        details: 'The provided token is not valid.'
      }
    });
  }

  next();
};

/**
 * Flexible authentication middleware that supports both methods
 */
const auth = (req, res, next) => {
  const authMethod = process.env.AUTH_METHOD || 'basic'; // 'basic' or 'token'
  
  if (authMethod === 'token') {
    return tokenAuth(req, res, next);
  } else {
    return basicAuth(req, res, next);
  }
};

/**
 * Send authentication challenge response
 */
const sendAuthChallenge = (res) => {
  res.set('WWW-Authenticate', 'Basic realm="Admin Panel"');
  res.status(401).json({
    success: false,
    error: {
      message: 'Authentication required',
      details: 'Please provide valid admin credentials to access this endpoint.'
    }
  });
};

/**
 * Middleware to log authentication attempts
 */
const logAuthAttempt = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  
  console.log(`Auth attempt: ${req.method} ${req.path} from ${ip} (${userAgent})`);
  next();
};

module.exports = {
  auth,
  basicAuth,
  tokenAuth,
  logAuthAttempt
};
