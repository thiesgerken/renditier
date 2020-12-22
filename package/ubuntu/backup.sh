#!/bin/bash
mkdir -p /var/backups/stockdb

if [ -x /usr/bin/stockdb ]; then
  DATE=$(date +%Y-%m-%d-%H%M%S)

  UF=/var/backups/stockdb/$DATE-userdata.json.xz
  sudo -u stockdb bash -c "stockdb export" | xz -z > $UF
  chmod 777 $UF
  echo "Exported database to $UF"

  DF=/var/backups/stockdb/$DATE-prices.json.xz
  sudo -u stockdb bash -c "stockdb data --export" | xz -z > $DF
  chmod 777 $DF
  echo "Exported database to $DF"
fi
