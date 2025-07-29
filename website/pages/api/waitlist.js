import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const { email } = req.body;

      // Basic email validation
      if (!email || !email.includes('@')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please enter a valid email address' 
        });
      }

      const client = await pool.connect();
      
      try {
        // Insert email with conflict handling
        await client.query(
          'INSERT INTO waitlist_signups (email) VALUES ($1) ON CONFLICT (email) DO NOTHING',
          [email]
        );

        // Get total count
        const countResult = await client.query('SELECT COUNT(*) FROM waitlist_signups');
        const count = parseInt(countResult.rows[0].count);
        
        res.status(200).json({ 
          success: true, 
          message: "Thanks for joining the waitlist!\nWe'll notify you when OmniLens is ready.",
          count 
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Waitlist error:', error);
      res.status(500).json({ 
        success: false, 
        message: "Something went wrong. Please try again." 
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