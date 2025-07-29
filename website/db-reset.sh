#!/bin/bash

# Script to reset the waitlist database
# Usage: ./db-reset.sh

DB_HOST="localhost"
DB_PORT="5432"
DB_USER="omnilens_user"
DB_NAME="omnilens_waitlist"

echo "🚨 WARNING: This will delete ALL waitlist signups!"
echo "Current signup count:"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as total_signups FROM waitlist_signups;"

echo ""
read -p "Are you sure you want to delete all signups? (type 'yes' to confirm): " confirmation

if [ "$confirmation" = "yes" ]; then
    echo "Deleting all waitlist signups..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DELETE FROM waitlist_signups;"
    
    echo ""
    echo "✅ Database reset complete!"

    echo ""
    echo "New signup count:"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) as total_signups FROM waitlist_signups;"
else
    echo "❌ Reset cancelled. No data was deleted."
fi 