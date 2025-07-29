#!/bin/bash

# Script to view waitlist statistics from production database

echo "📊 OmniLens Waitlist Statistics"
echo "================================"

# Source production environment variables
source .env.prod

echo "🔍 All Waitlist Signups:"
psql "$POSTGRES_URL" -c "SELECT email, created_at FROM waitlist_signups ORDER BY created_at DESC;"

echo ""
echo "📈 Summary Statistics:"
psql "$POSTGRES_URL" -c "
SELECT 
    COUNT(*) as total_signups,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
    MIN(created_at) as first_signup,
    MAX(created_at) as latest_signup
FROM waitlist_signups;
" 