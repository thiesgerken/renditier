FROM archlinux/base
RUN pacman -Syyuu --noconfirm
RUN pacman -S base-devel --noconfirm
RUN pacman -S postgresql-libs --noconfirm 

# install rust
RUN pacman -S rustup --noconfirm 
RUN rustup default stable
