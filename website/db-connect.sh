#!/bin/bash

# Simple script to connect to the OmniLens database securely
# Usage: ./db-connect.sh [optional SQL command]

DB_HOST="localhost"
DB_PORT="5432"
DB_USER="omnilens_user"
DB_NAME="omnilens_waitlist"

if [ $# -eq 0 ]; then
    # Interactive mode
    echo "Connecting to OmniLens database..."
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
else
    # Execute command mode
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$1"
fi 