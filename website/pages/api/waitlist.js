const { Pool } = require('pg');
const { validateAndRateLimit } = require('../../lib/security');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      // Apply security validation and rate limiting
      const validation = validateAndRateLimit(req, res);
      
      if (!validation.valid) {
        return res.status(validation.status).json({ 
          success: false, 
          message: validation.error 
        });
      }

      const email = validation.email;
      const client = await pool.connect();
      
      try {
        // Check if email already exists (additional protection)
        const existingCheck = await client.query(
          'SELECT id FROM waitlist_signups WHERE email = $1',
          [email]
        );
        
        if (existingCheck.rows.length > 0) {
          return res.status(400).json({ 
            success: false, 
            message: 'This email is already on the waitlist' 
          });
        }

        // Insert email
        await client.query(
          'INSERT INTO waitlist_signups (email) VALUES ($1)',
          [email]
        );

        // Get total count
        const countResult = await client.query('SELECT COUNT(*) FROM waitlist_signups');
        const count = parseInt(countResult.rows[0].count);
        
        // Log successful signup for monitoring
        console.log(`✅ Successful signup: ${email} (Total: ${count})`);
        
        res.status(200).json({ 
          success: true, 
          message: "Thanks for joining the waitlist!\nWe'll notify you when OmniLens is ready.",
          count 
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ Waitlist error:', error);
      
      // Don't expose internal errors to potential attackers
      res.status(500).json({ 
        success: false, 
        message: "Something went wrong. Please try again later." 
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ 
      success: false, 
      message: `Method ${req.method} Not Allowed` 
    });
  }
} 