#!/bin/bash

# Script to view recent waitlist signups from production database
# Usage: ./waitlist-recent.sh [hours] (default: 24 hours)

HOURS=${1:-24}

echo "📅 Recent Waitlist Signups (Last ${HOURS} hours)"
echo "=============================================="

# Source production environment variables
source .env.prod

psql "$POSTGRES_URL" -c "
SELECT 
    email, 
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_ago
FROM waitlist_signups 
WHERE created_at >= NOW() - INTERVAL '${HOURS} hours'
ORDER BY created_at DESC;
" 