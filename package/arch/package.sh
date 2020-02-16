#!/usr/bin/bash

rm -Rf ./build
mkdir -p ./build

cp ../../stockdb ../../config-dist.toml ../../zsh-completions ../../bash-completions ../stockdb.service ../sysusers.d build
(cd build && tar cfz stockdb.tar.gz .)

commit=$(git rev-parse --short HEAD)
checksum=$(cd build && md5sum stockdb.tar.gz)
arch=$(uname -m)

sed -e "s/COMMIT/$commit/g" -e "s/ARCH/$arch/g" -e "s/CHECKSUM/${checksum%% *}/g" PKGBUILD > build/PKGBUILD
cp stockdb.install build

(cd build && makepkg)
