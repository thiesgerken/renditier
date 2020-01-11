FROM archlinux/base 

RUN pacman -Syyuu --noconfirm && pacman -S base-devel --noconfirm && pacman -S postgresql-libs clang rustup --noconfirm 
RUN rustup default nightly
