#!/bin/bash

if [ -x /var/backups/backup-stockdb.sh ]; then
  /var/backups/backup-stockdb.sh
fi
