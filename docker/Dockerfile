FROM archlinux/base
RUN pacman -Syyuu --noconfirm
RUN pacman -S base-devel --noconfirm

# install rust and dependencies
RUN pacman -S postgresql-libs clang rustup --noconfirm 
RUN rustup default stable
