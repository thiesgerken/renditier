#!/bin/sh

chmod 755 /usr/bin/stockdb
chown -R root:root /etc/stockdb

chmod 644 /etc/systemd/system/stockdb.service /usr/lib/sysusers.d/stockdb
chown root:root /etc/systemd/system/stockdb.service /usr/lib/sysusers.d/stockdb

systemctl daemon-reload
systemd-sysusers