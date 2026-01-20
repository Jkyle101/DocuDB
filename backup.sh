#!/bin/bash

# DocuDB Backup Script
# This script creates backups of the MongoDB database and uploaded files

# Configuration
BACKUP_DIR="/var/backups/docudb"
PROJECT_DIR="/path/to/docudb"  # Update this path
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Starting DocuDB backup at $TIMESTAMP..."

# Backup MongoDB database
echo "Backing up MongoDB database..."
mongodump --db docudb --out "$BACKUP_DIR/mongodb_backup_$TIMESTAMP"

if [ $? -eq 0 ]; then
    echo "MongoDB backup completed successfully"
else
    echo "MongoDB backup failed"
    exit 1
fi

# Backup uploaded files
echo "Backing up uploaded files..."
tar -czf "$BACKUP_DIR/uploads_backup_$TIMESTAMP.tar.gz" -C "$PROJECT_DIR/server" uploads/

if [ $? -eq 0 ]; then
    echo "File backup completed successfully"
else
    echo "File backup failed"
    exit 1
fi

# Compress MongoDB backup
echo "Compressing MongoDB backup..."
tar -czf "$BACKUP_DIR/mongodb_backup_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "mongodb_backup_$TIMESTAMP"
rm -rf "$BACKUP_DIR/mongodb_backup_$TIMESTAMP"

# Clean up old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "Backup completed successfully at $(date)"
echo "Backup location: $BACKUP_DIR"

# Optional: Send notification (uncomment and configure as needed)
# curl -X POST -H 'Content-type: application/json' \
# --data '{"text":"DocuDB backup completed successfully"}' \
# YOUR_SLACK_WEBHOOK_URL
