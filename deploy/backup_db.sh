#!/bin/bash
# ==============================================================================
# Automated Database Backup Script for Hostinger VPS KVM 4
# Add to crontab: 0 3 * * * /var/www/erp/deploy/backup_db.sh > /dev/null 2>&1
# ==============================================================================

BACKUP_DIR="/var/backups/erp"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

# Check if PostgreSQL is being used
if command -v pg_dump > /dev/null 2>&1; then
    BACKUP_FILE="$BACKUP_DIR/erp_db_$TIMESTAMP.sql.gz"
    echo "Creating PostgreSQL backup: $BACKUP_FILE"
    sudo -u postgres pg_dump erp_db | gzip > "$BACKUP_FILE"
fi

# Also backup SQLite if present
if [ -f "/var/www/erp/backend/db.sqlite3" ]; then
    SQLITE_BACKUP="$BACKUP_DIR/sqlite_db_$TIMESTAMP.sqlite3.gz"
    echo "Creating SQLite backup: $SQLITE_BACKUP"
    gzip -c /var/www/erp/backend/db.sqlite3 > "$SQLITE_BACKUP"
fi

# Remove backups older than 14 days
find "$BACKUP_DIR" -type f -name "*.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed successfully."

