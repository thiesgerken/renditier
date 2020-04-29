#!/bin/bash
mkdir -p /var/backups

if [ -x /usr/bin/stockdb ]; then
  DATE=$(date +%Y-%m-%d-%H%M%S)

  sudo -u stockdb bash -c "stockdb export" > /var/backups/stockdb-$DATE.json
  echo "Exported database to /var/backups/stockdb-$DATE.json"

  sudo -u stockdb bash -c "stockdb data --export" > /var/backups/stockdb-prices-$DATE.json
  echo "Exported database to /var/backups/stockdb-prices-$DATE.json"
fi
