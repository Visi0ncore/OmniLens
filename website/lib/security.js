// In-memory stores for rate limiting (in production, use Redis)
const ipAttempts = new Map();
const emailAttempts = new Map();
const blockedIPs = new Set();

// Configuration
const RATE_LIMITS = {
  PER_IP_PER_HOUR: 5,        // Max 5 signups per IP per hour
  PER_EMAIL_PER_DAY: 1,      // Max 1 signup per email per day (duplicate protection)
  BURST_LIMIT: 3,            // Max 3 requests per minute from same IP
  BLOCK_DURATION: 60 * 60 * 1000, // 1 hour block
};

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  // Clean IP attempts older than 1 hour
  for (const [ip, data] of ipAttempts.entries()) {
    data.attempts = data.attempts.filter(time => now - time < oneHour);
    if (data.attempts.length === 0) {
      ipAttempts.delete(ip);
    }
  }
  
  // Clean email attempts older than 24 hours
  const oneDay = 24 * 60 * 60 * 1000;
  for (const [email, timestamp] of emailAttempts.entries()) {
    if (now - timestamp > oneDay) {
      emailAttempts.delete(email);
    }
  }
}, 10 * 60 * 1000);

function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
}

function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

function sanitizeEmail(email) {
  return email.toLowerCase().trim();
}

function checkRateLimit(ip, email) {
  const now = Date.now();
  
  // Check if IP is blocked
  if (blockedIPs.has(ip)) {
    return { allowed: false, reason: 'IP temporarily blocked due to abuse' };
  }
  
  // Check burst protection (3 requests per minute)
  if (!ipAttempts.has(ip)) {
    ipAttempts.set(ip, { attempts: [], blocked: false });
  }
  
  const ipData = ipAttempts.get(ip);
  const oneMinute = 60 * 1000;
  const recentAttempts = ipData.attempts.filter(time => now - time < oneMinute);
  
  if (recentAttempts.length >= RATE_LIMITS.BURST_LIMIT) {
    // Block this IP for 1 hour
    blockedIPs.add(ip);
    setTimeout(() => blockedIPs.delete(ip), RATE_LIMITS.BLOCK_DURATION);
    return { allowed: false, reason: 'Too many requests. Please try again later.' };
  }
  
  // Check hourly limit per IP
  const oneHour = 60 * 60 * 1000;
  const hourlyAttempts = ipData.attempts.filter(time => now - time < oneHour);
  
  if (hourlyAttempts.length >= RATE_LIMITS.PER_IP_PER_HOUR) {
    return { allowed: false, reason: 'Too many signups from this location. Please try again later.' };
  }
  
  // Check if email was recently used
  if (emailAttempts.has(email)) {
    const lastAttempt = emailAttempts.get(email);
    const oneDay = 24 * 60 * 60 * 1000;
    
    if (now - lastAttempt < oneDay) {
      return { allowed: false, reason: 'This email was recently used. Please try again tomorrow.' };
    }
  }
  
  return { allowed: true };
}

function recordAttempt(ip, email) {
  const now = Date.now();
  
  // Record IP attempt
  if (!ipAttempts.has(ip)) {
    ipAttempts.set(ip, { attempts: [] });
  }
  ipAttempts.get(ip).attempts.push(now);
  
  // Record email attempt
  emailAttempts.set(email, now);
}

function securityMiddleware(req, res, next) {
  const ip = getClientIP(req);
  
  // Log attempt for monitoring
  console.log(`Waitlist attempt from IP: ${ip} at ${new Date().toISOString()}`);
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
}

function validateAndRateLimit(req, res) {
  const ip = getClientIP(req);
  const { email } = req.body;
  
  // Basic input validation
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required', status: 400 };
  }
  
  const sanitizedEmail = sanitizeEmail(email);
  
  // Email format validation
  if (!isValidEmail(sanitizedEmail)) {
    return { valid: false, error: 'Please enter a valid email address', status: 400 };
  }
  
  // Check for suspicious patterns
  if (sanitizedEmail.includes('+') && sanitizedEmail.split('+').length > 2) {
    return { valid: false, error: 'Invalid email format', status: 400 };
  }
  
  // Rate limiting check
  const rateCheck = checkRateLimit(ip, sanitizedEmail);
  if (!rateCheck.allowed) {
    return { valid: false, error: rateCheck.reason, status: 429 };
  }
  
  // Record this attempt
  recordAttempt(ip, sanitizedEmail);
  
  return { valid: true, email: sanitizedEmail };
}

module.exports = {
  securityMiddleware,
  validateAndRateLimit
}; 