#!/usr/bin/bash

rm -Rf build/stockdb
mkdir -p build/stockdb

mkdir -p build/stockdb/DEBIAN
cp deb-control.txt build/stockdb/DEBIAN/control

cp deb-postinst.sh build/stockdb/DEBIAN/postinst
chmod 755 build/stockdb/DEBIAN/postinst

cp deb-prerm.sh build/stockdb/DEBIAN/prerm
chmod 755 build/stockdb/DEBIAN/prerm

cp deb-preinst.sh build/stockdb/DEBIAN/preinst
chmod 755 build/stockdb/DEBIAN/preinst

mkdir -p build/stockdb/usr/bin
cp ../../stockdb build/stockdb/usr/bin
chmod 755 build/stockdb/usr/bin/stockdb

mkdir -p build/stockdb/etc/stockdb
cp ../../config-dist.toml build/stockdb/etc/stockdb/config-dist.toml

mkdir -p build/stockdb/etc/systemd/system
cp ../stockdb.service build/stockdb/etc/systemd/system/
cp ../stockdb-backup.service build/stockdb/etc/systemd/system/
cp ../stockdb-backup.timer build/stockdb/etc/systemd/system/

mkdir -p build/stockdb/var/backups
cp backup.sh build/stockdb/var/backups/backup-stockdb.sh

mkdir -p build/stockdb/usr/lib/sysusers.d
cp ../sysusers.d build/stockdb/usr/lib/sysusers.d/stockdb.conf

mkdir -p build/stockdb/usr/share/zsh/vendor-completions
cp ../../zsh-completions build/stockdb/usr/share/zsh/vendor-completions/_stockdb

mkdir -p build/stockdb/usr/share/bash-completion/completions
cp ../../zsh-completions build/stockdb/usr/share/bash-completion/completions/stockdb

(cd build && dpkg-deb --build stockdb)
