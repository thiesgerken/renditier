#!/bin/sh

chmod 755 /usr/bin/stockdb
chown -R root:root /etc/stockdb

chmod 644 /etc/systemd/system/stockdb.service /etc/systemd/system/stockdb-backup.service /etc/systemd/system/stockdb-backup.timer /usr/lib/sysusers.d/stockdb.conf
chown root:root /etc/systemd/system/stockdb.service /etc/systemd/system/stockdb-backup.service /etc/systemd/system/stockdb-backup.timer /usr/lib/sysusers.d/stockdb.conf

chmod 755 /var/backups/backup-stockdb.sh
chown root:root /var/backups/backup-stockdb.sh

systemctl daemon-reload
systemd-sysusers

systemctl enable stockdb.service && systemctl start stockdb.service
systemctl enable stockdb-backup.timer && systemctl start stockdb-backup.timer
