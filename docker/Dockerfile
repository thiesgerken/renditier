FROM archlinux/base
RUN pacman -Syyuu --noconfirm
RUN pacman -S base-devel --noconfirm

# install rust
RUN pacman -S rustup --noconfirm 
RUN rustup default stable

# add aarch64 target
# RUN pacman -S aarch64-linux-gnu-gcc --noconfirm
# RUN rustup target add aarch64-unknown-linux-gnu
# RUN mkdir -p ~/.cargo && echo "[target.aarch64-unknown-linux-gnu]" >> ~/.cargo/config && echo "linker = \"aarch64-linux-gnu-gcc\"" >> ~/.cargo/config 
