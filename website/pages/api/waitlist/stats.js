const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const client = await pool.connect();
      
      try {
        // Get total count of all signups
        const countResult = await client.query('SELECT COUNT(*) FROM waitlist_signups');
        const count = parseInt(countResult.rows[0].count);

        // Get recent signups (last 24 hours)
        const recentResult = await client.query(
          "SELECT COUNT(*) FROM waitlist_signups WHERE created_at >= NOW() - INTERVAL '24 hours'"
        );
        const latestSignups = parseInt(recentResult.rows[0].count);

        res.status(200).json({
          count: count || 0,
          latestSignups: latestSignups || 0
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch stats',
        count: 0,
        latestSignups: 0
      });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).json({ 
      error: `Method ${req.method} Not Allowed` 
    });
  }
} 