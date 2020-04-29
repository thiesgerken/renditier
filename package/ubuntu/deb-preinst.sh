#!/bin/bash
mkdir -p /var/backups

if [ -x /usr/bin/stockdb ]; then
  DATE=$(date +%Y-%m-%d-%H%M%S)

  sudo -u stockdb bash -c "stockdb export > /tmp/stockdb-$DATE.json"
  mv /tmp/stockdb-$DATE.json /var/backups/
  echo "Exported database to /var/backups/stockdb-$DATE.json"

  sudo -u stockdb bash -c "stockdb data --export > /tmp/stockdb-prices-$DATE.json"
  mv /tmp/stockdb-prices-$DATE.json /var/backups/
  echo "Exported database to /var/backups/stockdb-prices-$DATE.json"
fi
